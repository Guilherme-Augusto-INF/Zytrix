import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { v5 as uuidv5 } from 'uuid';
import { cleanUndefined, decode, readJson, readJsonLines, sha256, tableFile, writeJson, writeJsonLines } from './lib.mjs';

const [input, authMapFile, outputDirectory] = process.argv.slice(2);
if (!input || !authMapFile || !outputDirectory) throw new Error('Usage: node transform.mjs <firestore.jsonl> <auth-map.json> <output-directory>');
const rows = await readJsonLines(resolve(input));
const authMap = await readJson(resolve(authMapFile));
const sourceBytes = await readFile(resolve(input));
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });

const namespace = uuidv5('zytrix-ca4f2', uuidv5.DNS);
const stableId = path => uuidv5(path, namespace);
const userId = firebaseUid => {
  const mapped = authMap[firebaseUid];
  const value = typeof mapped === 'string' ? mapped : mapped?.postgres_user_id;
  if (!value) throw new Error(`Unresolved Firebase UID: ${firebaseUid}`);
  return value;
};
const channelId = firebaseId => stableId(`channel:${firebaseId}`);
const liveId = firebaseId => stableId(`live:${firebaseId}`);
const documentId = path => stableId(`firestore:${path}`);
const out = new Map();
const add = (table, row) => {
  if (!out.has(table)) out.set(table, []);
  out.get(table).push(cleanUndefined(row));
};
const slug = (name, owner) => {
  const base = String(name || 'canal').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'canal';
  return `${base}-${String(owner).replaceAll('-', '').slice(0, 8)}`;
};
const categories = new Set();
const follows = new Map();
const chatSettings = new Map();
const unknownPaths = [];

const migrationBatchId = stableId(`migration-batch:${sha256(sourceBytes)}`);
for (const [firebaseUid, mapping] of Object.entries(authMap)) {
  const postgresUserId = typeof mapping === 'string' ? mapping : mapping?.postgres_user_id;
  if (!postgresUserId) throw new Error(`Invalid Auth mapping for ${firebaseUid}`);
  add('firebase_user_map', {
    firebase_uid: firebaseUid,
    postgres_user_id: postgresUserId,
    source_email: typeof mapping === 'object' ? mapping.source_email : null,
    source_provider: typeof mapping === 'object' ? mapping.source_provider : null,
    migrated_at: new Date().toISOString(),
    migration_batch_id: migrationBatchId
  });
}

for (const source of rows) {
  const path = source.path;
  const p = path.split('/');
  const d = decode(source.data);
  try {
    if (p.length === 2 && p[0] === 'admins') add('admins', { user_id: userId(p[1]), active: d.active === true });
    else if (p.length === 2 && p[0] === 'users') add('user_accounts', { user_id: userId(p[1]), firebase_uid: p[1], zytrix_id: d.zytrixId, email: d.email, provider: d.provider, created_at: d.createdAt, last_login_at: d.lastLoginAt, migrated_at: new Date().toISOString() });
    else if (p.length === 2 && p[0] === 'profiles') add('profiles', { user_id: userId(p[1]), firebase_uid: p[1], username: d.username, photo_url: d.photoURL ?? '', bio: d.bio ?? '', created_at: d.createdAt, username_updated_at: d.usernameUpdatedAt, updated_at: d.usernameUpdatedAt ?? d.createdAt });
    else if (p.length === 2 && p[0] === 'channels') {
      const owner = userId(d.ownerUid ?? p[1]);
      if (d.categoryId) categories.add(d.categoryId);
      add('channels', { id: channelId(p[1]), firebase_id: p[1], owner_id: owner, name: d.channelName ?? 'Canal', slug: slug(d.channelName, owner), description: d.description ?? '', avatar_url: d.avatarURL ?? '', banner_url: d.bannerURL ?? '', category_id: d.categoryId ?? null, is_live: d.isLive === true, current_live_id: d.currentStreamId ? liveId(d.currentStreamId) : null, created_at: d.createdAt, updated_at: d.createdAt });
    }
    else if (p.length === 2 && p[0] === 'streams') {
      if (d.categoryId) categories.add(d.categoryId);
      add('lives', { id: liveId(p[1]), firebase_id: p[1], channel_id: channelId(d.channelId), owner_id: userId(d.streamerUid), title: d.title, description: d.description ?? '', category_id: d.categoryId ?? null, thumbnail_url: d.thumbnailURL ?? '', playback_url: d.playbackURL, status: d.status === 'live' ? 'live' : d.status === 'ended' ? 'ended' : 'created', mature_content: d.matureContent === true, support_alert_sound: d.supportAlertSound ?? 'coin', support_goal_label: d.supportGoalLabel, support_goal_coins: d.supportGoalCoins, support_alert_theme: d.supportAlertTheme, support_alert_min_coins: d.supportAlertMinCoins, support_alert_duration_ms: d.supportAlertDurationMs, vod_url: d.vodURL, raid_target_live_id: d.raidTargetStreamId ? liveId(d.raidTargetStreamId) : null, host_target_live_id: d.hostTargetStreamId ? liveId(d.hostTargetStreamId) : null, total_views: Number(d.viewerCount ?? 0), started_at: d.startedAt, ended_at: d.endedAt, created_at: d.createdAt, updated_at: d.createdAt });
    }
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'following') follows.set(`${p[1]}:${p[3]}`, { follower_id: userId(p[1]), channel_id: channelId(p[3]), followed_at: d.followedAt });
    else if (p.length === 4 && p[0] === 'channels' && p[2] === 'followers') follows.set(`${p[3]}:${p[1]}`, { follower_id: userId(p[3]), channel_id: channelId(p[1]), followed_at: d.followedAt });
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'notificationState') add('notification_states', { user_id: userId(p[1]), state_type: p[3] === 'zycoins' ? 'zycoins' : 'platform', last_seen_at: d.lastSupportSeenAt ?? d.lastSeenAt, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'watchHistory') add('watch_history', { user_id: userId(p[1]), live_id: liveId(p[3]), first_watched_at: d.firstWatchedAt ?? d.watchedAt ?? d.createdAt, last_watched_at: d.lastWatchedAt ?? d.watchedAt ?? d.updatedAt, watch_seconds: Number(d.watchSeconds ?? 0) });
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'preferences') add('user_preferences', { user_id: userId(p[1]), hide_mature_content: d.hideMatureContent === true, safe_mode: d.safeMode !== false, allow_reactions: d.allowReactions !== false, compact_alerts: d.compactAlerts === true, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'progress') add('user_progress', { user_id: userId(p[1]), xp: Number(d.xp ?? 0), watch_minutes: Number(d.watchMinutes ?? 0), streak_days: Number(d.streakDays ?? 0), last_active_day: d.lastActiveDay || null, last_live_id: d.lastStreamId ? liveId(d.lastStreamId) : null, last_watch_reward_at: d.lastWatchRewardAt, created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'followedCategories') { categories.add(p[3]); add('followed_categories', { user_id: userId(p[1]), category_id: p[3], followed_at: d.followedAt }); }
    else if (p.length === 4 && p[0] === 'users' && p[2] === 'creatorAttribution') add('creator_attributions', { user_id: userId(p[1]), creator_id: userId(d.creatorUid), creator_code: d.code, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'channels' && p[2] === 'private') add('channel_private_data', { channel_id: channelId(p[1]), firebase_document_id: p[3], payload: d, migrated_at: new Date().toISOString() });
    else if (p.length === 4 && p[0] === 'channels' && p[2] === 'members') add('channel_members', { channel_id: channelId(p[1]), user_id: userId(p[3]), added_by: userId(d.addedBy), created_at: d.createdAt });
    else if (p.length === 4 && p[0] === 'channels' && p[2] === 'schedule') add('live_schedules', { id: documentId(path), firebase_id: p[3], channel_id: channelId(p[1]), title: d.title, description: d.description ?? '', starts_at: d.startsAt, created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'channels' && p[2] === 'rewards') add('rewards', { id: documentId(path), firebase_id: p[3], channel_id: channelId(p[1]), title: d.title, description: d.description ?? '', cost: Number(d.cost), active: d.active === true, created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 2 && p[0] === 'channelProfiles') add('channel_profiles', { channel_id: channelId(p[1]), firebase_uid: p[1], about: d.about ?? '', games: d.games ?? '', website: d.website ?? '', youtube: d.youtube ?? '', instagram: d.instagram ?? '', tiktok: d.tiktok ?? '', updated_at: d.updatedAt });
    else if (p.length === 2 && p[0] === 'creatorCodes') add('creator_codes', { code: p[1], creator_id: userId(d.creatorUid), created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'moderators') add('live_moderators', { live_id: liveId(p[1]), user_id: userId(p[3]), added_by: userId(d.addedBy), created_at: d.createdAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'chatSettings') chatSettings.set(p[1], { live_id: liveId(p[1]), mode: d.mode ?? 'everyone', slow_mode_seconds: Number(d.slowModeSeconds ?? 0), allow_links: d.allowLinks === true, block_excess_caps: d.blockExcessCaps !== false, blocked_words: d.blockedWords ?? [], emergency_mode: d.emergencyMode === true, updated_by: userId(d.updatedBy), updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'chatConfig') { const current = chatSettings.get(p[1]) ?? { live_id: liveId(p[1]), mode: 'everyone', slow_mode_seconds: 0, allow_links: false, block_excess_caps: true, blocked_words: [], emergency_mode: false, updated_by: userId(d.updatedBy), updated_at: d.updatedAt }; current.pinned_message_id = documentId(`streams/${p[1]}/chat/${d.pinnedMessageId}`); chatSettings.set(p[1], current); }
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'chat') add('chat_messages', { id: documentId(path), firebase_id: p[3], live_id: liveId(p[1]), sender_id: userId(d.uid), text: d.text, created_at: d.createdAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'chatBans') add('live_bans', { live_id: liveId(p[1]), user_id: userId(p[3]), kind: d.reason, reason: '', banned_by: userId(d.bannedBy), created_at: d.createdAt, expires_at: d.expiresAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'reactions') add('live_reactions', { id: documentId(path), firebase_id: p[3], live_id: liveId(p[1]), user_id: userId(d.uid), emoji: d.emoji, created_at: d.createdAt, expires_at: d.expiresAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'polls') {
      const poll = documentId(path);
      const labels = [d.option0, d.option1, d.option2, d.option3];
      labels.forEach((label, position) => { if (label) add('poll_options', { id: stableId(`${path}:option:${position}`), poll_id: poll, position, label, vote_count: Number(d[`count${position}`] ?? 0) }); });
      add('polls', { id: poll, firebase_id: p[3], live_id: liveId(p[1]), kind: d.kind, question: d.question, status: d.status, result_option_id: Number.isInteger(d.resultIndex) ? stableId(`${path}:option:${d.resultIndex}`) : null, created_by: userId(d.createdBy), created_at: d.createdAt, updated_at: d.updatedAt });
    }
    else if (p.length === 6 && p[0] === 'streams' && p[2] === 'polls' && p[4] === 'votes') add('poll_votes', { poll_id: documentId(`streams/${p[1]}/polls/${p[3]}`), option_id: stableId(`streams/${p[1]}/polls/${p[3]}:option:${Number(d.optionIndex)}`), user_id: userId(p[5]), created_at: d.createdAt });
    else if (p.length === 4 && p[0] === 'streams' && p[2] === 'supportAlerts') add('support_alerts', { transaction_id: documentId(`zyCoinTransactions/${d.transactionId ?? p[3]}`), live_id: liveId(p[1]), from_user_id: userId(d.fromUid), amount: Number(d.amount), message: d.message, created_at: d.createdAt, expires_at: d.expiresAt });
    else if (p.length === 2 && p[0] === 'wallets') add('wallets', { user_id: userId(p[1]), balance: Number(d.balance ?? 0), total_sent: Number(d.totalSent ?? 0), total_received: Number(d.totalReceived ?? 0), created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 2 && p[0] === 'zyCoinTransactions') add('zy_coin_transactions', { id: documentId(path), firebase_id: p[1], from_user_id: d.fromUid && d.fromUid !== 'zytrix' ? userId(d.fromUid) : null, to_user_id: d.toUid ? userId(d.toUid) : null, amount: Number(d.amount), type: d.type, status: d.status, live_id: d.streamId ? liveId(d.streamId) : null, reward_id: d.rewardId && d.toUid ? documentId(`channels/${d.toUid}/rewards/${d.rewardId}`) : null, promotion_id: d.promotionId ? documentId(`coinPromotions/${d.promotionId}`) : null, idempotency_key: `firebase:${p[1]}`, message: d.message, created_at: d.createdAt });
    else if (p.length === 2 && p[0] === 'zyCoinOrders') add('zy_coin_orders', { id: documentId(path), firebase_id: p[1], user_id: userId(d.uid), package_id: d.packageId, coins: Number(d.coins), price_cents: Number(d.priceCents), payment_method: d.paymentMethod, status: d.status, mode: d.mode, idempotency_key: `firebase:${p[1]}`, created_at: d.createdAt, paid_at: d.paidAt });
    else if (p.length === 2 && p[0] === 'rewardRedemptions') add('reward_redemptions', { id: documentId(path), firebase_id: p[1], reward_id: documentId(`channels/${d.channelId}/rewards/${d.rewardId}`), channel_id: channelId(d.channelId), user_id: userId(d.uid), transaction_id: documentId(`zyCoinTransactions/${d.redemptionId ?? p[1]}`), cost: Number(d.cost), status: d.status, created_at: d.createdAt, fulfilled_by: d.fulfilledBy ? userId(d.fulfilledBy) : null, fulfilled_at: d.fulfilledAt });
    else if (p.length === 2 && p[0] === 'coinPromotions') add('coin_promotions', { id: documentId(path), firebase_id: p[1], title: d.title, description: d.description ?? '', amount: Number(d.amount), max_claims: Number(d.maxClaims), claim_count: Number(d.claimCount ?? 0), active: d.active === true, starts_at: d.startsAt, ends_at: d.endsAt, created_by: userId(d.createdBy), created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 4 && p[0] === 'coinPromotions' && p[2] === 'claims') add('promotion_claims', { promotion_id: documentId(`coinPromotions/${p[1]}`), user_id: userId(p[3]), transaction_id: documentId(`zyCoinTransactions/${d.transactionId}`), amount: Number(d.amount), created_at: d.createdAt });
    else if (p.length === 2 && p[0] === 'clips') add('clips', { id: documentId(path), firebase_id: p[1], live_id: liveId(d.streamId), streamer_id: userId(d.streamerUid), creator_id: userId(d.creatorUid), title: d.title, moment_seconds: Number(d.momentSeconds), source_url: d.sourceUrl ?? '', thumbnail_url: d.thumbnailURL ?? '', mature_content: d.matureContent === true, created_at: d.createdAt });
    else if (p.length === 2 && p[0] === 'moderationPenalties') add('moderation_penalties', { user_id: userId(p[1]), type: d.type, reason: d.reason, active: d.active === true, expires_at: d.expiresAt, created_by: userId(d.createdBy), created_at: d.createdAt, updated_at: d.updatedAt });
    else if (p.length === 2 && p[0] === 'moderationActions') add('moderation_actions', { id: documentId(path), firebase_id: p[1], target_user_id: userId(d.targetUid), action: d.action, penalty_type: d.type, reason: d.reason, moderator_id: userId(d.moderatorUid), expires_at: d.expiresAt, created_at: d.createdAt });
    else if (p.length === 2 && p[0] === 'categories') { categories.add(p[1]); add('categories', { id: p[1], name: d.name ?? p[1], active: d.active !== false, sort_order: Number(d.sortOrder ?? 0), metadata: d }); }
    else if (p.length === 2 && p[0] === 'featuredStreamers') add('featured_streamers', {
      channel_id: channelId(p[1]),
      sort_order: Number(d.position ?? d.sortOrder ?? 0),
      active: d.active !== false,
      created_by: d.createdBy ? userId(d.createdBy) : null,
      created_at: d.createdAt
    });
    else if (path === 'governance/config') add('governance_config', { singleton: true, reports_enabled: d.reportsEnabled === true, rules_version: d.rulesVersion, terms_version: d.termsVersion, privacy_version: d.privacyVersion, terms_effective: d.termsEffective === true, updated_at: d.updatedAt ?? new Date().toISOString() });
    else if (p.length === 2 && p[0] === 'reports') add('reports', { id: documentId(path), firebase_id: p[1], reporter_id: userId(d.reporterUid), target_type: d.targetType === 'stream' ? 'live' : d.targetType, target_profile_id: d.targetType === 'profile' ? userId(d.targetId) : null, target_live_id: d.targetType === 'stream' ? liveId(d.targetId) : null, target_chat_message_id: d.targetType === 'chat' ? documentId(`streams/${d.contextId}/chat/${d.targetId}`) : null, reason: d.reason, description: d.description ?? '', status: d.status, resolution: d.resolution, created_at: d.createdAt, reviewed_at: d.reviewedAt });
    else if (p.length === 2 && p[0] === 'moderationAudit') add('moderation_audit', { id: documentId(path), firebase_id: p[1], report_id: documentId(`reports/${d.reportId}`), action: d.action, resolution: d.resolution, moderator_id: userId(d.moderatorUid), created_at: d.createdAt });
    else if (p.length === 4 && p[0] === 'policyAcceptances' && p[2] === 'versions') { add('policy_acceptances', { user_id: userId(p[1]), policy: 'terms', version: d.termsVersion, accepted_at: d.acceptedAt }); add('policy_acceptances', { user_id: userId(p[1]), policy: 'privacy', version: d.privacyVersion, accepted_at: d.acceptedAt }); }
    else if (!['chatRate','reactionRate','viewers','reportLimits','reportKeys'].includes(p[2])) unknownPaths.push(path);
  } catch (error) {
    throw new Error(`${path}: ${error.message}`, { cause: error });
  }
}

for (const value of follows.values()) add('follows', value);
for (const value of chatSettings.values()) add('chat_settings', value);
const existingCategories = new Set((out.get('categories') ?? []).map(row => row.id));
for (const id of categories) if (!existingCategories.has(id)) add('categories', { id, name: id, active: true, sort_order: 0, metadata: { migratedStub: true } });

const manifest = { generatedAt: new Date().toISOString(), sourceSha256: sha256(sourceBytes), migrationBatchId, tables: {}, unknownPaths };
for (const [table, tableRows] of out) {
  const file = tableFile(output, table);
  await writeJsonLines(file, tableRows);
  manifest.tables[table] = { rows: tableRows.length, file: `${table}.jsonl`, sha256: sha256(await readFile(file)) };
}
await writeJson(resolve(output, 'manifest.json'), manifest);
process.stdout.write(`${JSON.stringify({ output, tables: Object.keys(manifest.tables).length, unknownPaths: unknownPaths.length })}\n`);
if (unknownPaths.length) process.exitCode = 2;
