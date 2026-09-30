import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

test('transform is deterministic and deduplicates two-sided follows', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zytrix-etl-'));
  const source = join(directory, 'firestore.jsonl');
  const authMap = join(directory, 'auth-map.json');
  const normalized = join(directory, 'normalized');
  const date = '2026-09-20T00:00:00.000Z';
  const rows = [
    { path: 'users/alice', data: { uid: 'alice', zytrixId: 'ZY-ALICE', email: 'alice@example.test', provider: 'password', createdAt: date, lastLoginAt: date } },
    { path: 'users/bob', data: { uid: 'bob', zytrixId: 'ZY-BOB01', email: 'bob@example.test', provider: 'google', createdAt: date, lastLoginAt: date } },
    { path: 'profiles/alice', data: { uid: 'alice', username: 'alice', photoURL: '', bio: '', createdAt: date, usernameUpdatedAt: date } },
    { path: 'profiles/bob', data: { uid: 'bob', username: 'bob', photoURL: '', bio: '', createdAt: date, usernameUpdatedAt: date } },
    { path: 'channels/alice', data: { ownerUid: 'alice', channelName: 'Alice Live', description: '', avatarURL: '', bannerURL: '', categoryId: 'Gaming', isLive: true, currentStreamId: 'live1', createdAt: date } },
    { path: 'featuredStreamers/alice', data: { active: true, position: 3 } },
    { path: 'streams/live1', data: { streamerUid: 'alice', channelId: 'alice', title: 'Test', description: '', categoryId: 'Gaming', thumbnailURL: '', status: 'live', playbackURL: 'https://twitch.tv/alice', startedAt: date, endedAt: null, createdAt: date, viewerCount: 0 } },
    { path: 'users/bob/following/alice', data: { channelId: 'alice', followedAt: date } },
    { path: 'channels/alice/followers/bob', data: { uid: 'bob', followedAt: date } },
    { path: 'streams/live1/polls/p1', data: { pollId: 'p1', kind: 'poll', question: 'A?', option0: 'Yes', option1: 'No', option2: '', option3: '', count0: 1, count1: 0, count2: 0, count3: 0, status: 'active', resultIndex: null, createdBy: 'alice', createdAt: date, updatedAt: date } },
    { path: 'streams/live1/polls/p1/votes/bob', data: { uid: 'bob', optionIndex: 0, createdAt: date } },
    { path: 'wallets/alice', data: { uid: 'alice', balance: 10, totalSent: 0, totalReceived: 10, createdAt: date, updatedAt: date } },
    { path: 'wallets/bob', data: { uid: 'bob', balance: 5, totalSent: 0, totalReceived: 0, createdAt: date, updatedAt: date } }
  ];
  await writeFile(source, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`);
  await writeFile(authMap, JSON.stringify({ alice: '11111111-1111-4111-8111-111111111111', bob: '22222222-2222-4222-8222-222222222222' }));
  await run(process.execPath, [new URL('../transform.mjs', import.meta.url).pathname, source, authMap, normalized]);
  const follows = (await readFile(join(normalized, 'follows.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const options = (await readFile(join(normalized, 'poll_options.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const votes = (await readFile(join(normalized, 'poll_votes.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  const featured = (await readFile(join(normalized, 'featured_streamers.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(follows.length, 1);
  assert.equal(options.length, 2);
  assert.equal(votes.length, 1);
  assert.equal(votes[0].option_id, options.find(option => option.position === 0).id);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].sort_order, 3);
  assert.equal(featured[0].active, true);
  assert.equal(featured[0].created_by, null);
});

test('Auth preflight detects provider shape and complete identity relations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zytrix-auth-preflight-'));
  const source = join(directory, 'firestore.jsonl');
  const auth = join(directory, 'firebase-auth.json');
  const reportFile = join(directory, 'report.json');
  const rows = ['alice', 'bob'].flatMap(uid => [
    { path: `users/${uid}`, data: { uid } },
    { path: `profiles/${uid}`, data: { uid, username: uid } },
    { path: `wallets/${uid}`, data: { uid, balance: 0 } }
  ]);
  await writeFile(source, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`);
  await writeFile(auth, JSON.stringify({ users: [
    { localId: 'alice', email: 'alice@example.test', passwordHash: 'hash' },
    { localId: 'bob', email: 'bob@example.test', providerUserInfo: [{ providerId: 'google.com' }] }
  ] }));
  await run(process.execPath, [new URL('../preflight-auth.mjs', import.meta.url).pathname, source, auth, reportFile]);
  const report = JSON.parse(await readFile(reportFile, 'utf8'));
  assert.deepEqual(report.counts, { authUsers: 2, userDocuments: 2, profileDocuments: 2, walletDocuments: 2 });
  assert.equal(report.providerShape.passwordOnly, 1);
  assert.equal(report.providerShape.googleOnly, 1);
  assert.equal(report.fatalErrorCount, 0);
  assert.equal(report.warningCount, 0);
});
