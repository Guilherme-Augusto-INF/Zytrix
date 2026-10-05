import test from 'node:test';import assert from 'node:assert/strict';import {executePlatform} from '../server/neon/platform.mjs';
const identity={uid:'fixture',emailVerified:true,email:'fixture@example.invalid',provider:'password'};
const data={username:'fixture',acceptPolicies:true,stagingConsent:true,termsVersion:'staging-draft',privacyVersion:'staging-draft',rulesVersion:'governance-1'};
const policy={terms_effective:true,signup_enabled:true,scope:'staging',terms_version:'staging-draft',privacy_version:'staging-draft',rules_version:'governance-1'};
test('signup is governed server-side by enablement, explicit staging consent and current versions',async()=>{
 for(const [config,patch,code]of [[null,{},'signup_disabled'],[{...policy,signup_enabled:false},{},'signup_disabled'],[policy,{stagingConsent:false},'staging_consent_required'],[policy,{termsVersion:'old'},'policy_version_mismatch']]){
  const db={async query(sql){assert.match(sql,/governance_config/);return {rows:config?[config]:[]};}};
  await assert.rejects(executePlatform(db,identity,'account.register',{...data,...patch}),e=>e.code===code);
 }
});
test('public policy snapshots expose no identity or private account data',async()=>{
 const db={async query(sql){assert.doesNotMatch(sql,/user_accounts|identities|wallets/);return {rows:sql.includes('governance_config')?[{termsVersion:'draft',privacyVersion:'draft',rulesVersion:'governance-1'}]:[{policy:'terms',version:'draft'}]};}};
 const result=await executePlatform(db,null,'policies.current',{});assert.equal(result.policies[0].policy,'terms');
});
