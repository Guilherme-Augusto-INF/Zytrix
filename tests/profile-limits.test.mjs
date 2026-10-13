import test from 'node:test';import assert from 'node:assert/strict';
import {createProfileLimiter,isPublicProfileRead} from '../server/neon/profile-limits.mjs';
test('profile read quotas reject bursts, isolate clients, expire, and bound memory',()=>{
 let now=0;const allowed=createProfileLimiter({limit:2,windowMs:1000,maximum:2,clock:()=>now});
 assert.equal(allowed('a'),true);assert.equal(allowed('a'),true);assert.equal(allowed('a'),false);assert.equal(allowed('b'),true);assert.equal(allowed('c'),false);now=1001;assert.equal(allowed('c'),true);assert.equal(allowed('a'),true);
});
test('quota includes legacy profile readers without limiting finance and login actions',()=>{
 for(const action of ['profile.public','profile.network','profile.get','profile.search'])assert.equal(isPublicProfileRead({action}),true);
 assert.equal(isPublicProfileRead({action:'documents.read',data:{path:['profiles','id']}}),true);
 for(const action of ['me','wallet.get','account.register','follow.set'])assert.equal(isPublicProfileRead({action}),false);
});
