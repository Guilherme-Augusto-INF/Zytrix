import test from 'node:test';import assert from 'node:assert/strict';import {diffRows,identifier,brokenReferences} from '../reconcile-model.mjs';
test('source FK gaps are reported before an apply transaction can commit',()=>{
 const fk=[{child:'profiles',parent:'identities',columns:['user_id'],parentColumns:['id']}];
 assert.equal(brokenReferences({profiles:[{user_id:'missing'}]},{identities:[{id:'existing'}]},fk).length,1);
 assert.equal(brokenReferences({profiles:[{user_id:'existing'}]},{identities:[{id:'existing'}]},fk).length,0);
});
test('reconciliation reports new, changed, removed and never silently reduces wallets',()=>{
 const r=diffRows('wallets',[{user_id:'a',balance:'9'},{user_id:'b',balance:'3'}],[{user_id:'a',balance:'10'},{user_id:'c',balance:'5'}],['user_id']);
 assert.equal(r.new.length,1);assert.equal(r.changed.length,1);assert.equal(r.removed.length,1);assert.equal(r.conflicts.length,2);assert.equal(r.plan.length,0);
});
test('reconciliation protects newer profiles, identities and immutable financial history',()=>{
 for(const table of ['profiles','identities','zy_coin_transactions'])assert.equal(diffRows(table,[{id:'a',value:'source'}],[{id:'a',value:'newer'}],['id']).plan.length,0);
 const r=diffRows('user_preferences',[{user_id:'a',safe_mode:false,updated_at:'2026-01-01'}],[{user_id:'a',safe_mode:true,updated_at:'2026-02-01'}],['user_id']);assert.equal(r.conflicts[0].reason,'destination_newer');
});
test('only reviewed nonfinancial changes with proven source versions can be applied',()=>{
 const r=diffRows('user_preferences',[{user_id:'a',safe_mode:false,updated_at:'2026-02-01'}],[{user_id:'a',safe_mode:true,updated_at:'2026-01-01'}],['user_id']);assert.equal(r.plan[0].kind,'update');
 assert.throws(()=>diffRows('identities',[{id:'a'},{id:'a'}],[],['id']),/Duplicate/);assert.throws(()=>diffRows('user_preferences',[{safe_mode:true}],[],['user_id']),/Missing source primary key/);assert.throws(()=>identifier('wallets;delete'),/Invalid/);assert.throws(()=>diffRows('neon_auth.user',[],[],['id']),/Unreviewed/);
});
