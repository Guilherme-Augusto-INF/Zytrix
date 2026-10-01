import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/firebase-tools/lib/bin/firebase.js','emulators:exec','--project','demo-zytrix-governance','--only','firestore','node --test --test-concurrency=1 tests/firestore.rules.test.mjs tests/platform-expansion.rules.test.mjs tests/security-hardening.rules.test.mjs'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;process.exitCode=result.status??1;
