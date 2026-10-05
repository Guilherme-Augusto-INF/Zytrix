import test from 'node:test';import assert from 'node:assert/strict';
import {guardProductionWrite} from '../assets/js/production-write-guard.js';
test('staging and uncertain configuration never execute a legacy production mutation',async()=>{
 let writes=0;const operation=()=>writes++;
 await assert.rejects(guardProductionWrite(async()=>true,operation)(),e=>e.code==='legacy_write_disabled_in_staging');
 await assert.rejects(guardProductionWrite(async()=>{throw Error('offline');},operation)());assert.equal(writes,0);
});
test('explicit non-staging mode preserves original call arguments and result',async()=>{
 const wrapped=guardProductionWrite(async()=>false,(...args)=>args);
 assert.deepEqual(await wrapped('reference',{value:1}),['reference',{value:1}]);
});
