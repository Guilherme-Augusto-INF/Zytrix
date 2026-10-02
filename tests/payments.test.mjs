import test from 'node:test';import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {sandboxConfig,fulfillSandboxEvent} from '../server/neon/payments.mjs';
test('payments require explicit sandbox and reject live keys and production',()=>{
 const base={ZYTRIX_STRIPE_SANDBOX:'true',STRIPE_SECRET_KEY:'sk_test_fixture',ZYTRIX_STAGING_ORIGIN:'http://127.0.0.1:5502'};
 assert.equal(sandboxConfig(base).origin,'http://127.0.0.1:5502');
 for(const patch of [{STRIPE_SECRET_KEY:'sk_live_fixture'},{VERCEL_ENV:'production'},{ZYTRIX_STRIPE_SANDBOX:'false'},{ZYTRIX_STAGING_ORIGIN:'http://remote.example'},{ZYTRIX_STAGING_ORIGIN:'https://name:password@example.test'}])assert.throws(()=>sandboxConfig({...base,...patch}));
});
test('Stripe signature verification rejects tampering and stale signatures locally',()=>{
 const stripe=new Stripe('sk_test_fixture'),secret='whsec_fixture_only';
 const payload=JSON.stringify({id:'evt_fixture',livemode:false,type:'test.event'});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(stripe.webhooks.constructEvent(payload,signature,secret).id,'evt_fixture');
 assert.throws(()=>stripe.webhooks.constructEvent(payload+' ',signature,secret));
 const expired=stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:1});
 assert.throws(()=>stripe.webhooks.constructEvent(payload,expired,secret));
});
test('live and unpaid events cannot touch the database',async()=>{
 const db={query(){assert.fail('unexpected database operation');}};
 await assert.rejects(fulfillSandboxEvent(db,{livemode:true}),e=>e.code==='live_payment_denied');
 assert.deepEqual(await fulfillSandboxEvent(db,{livemode:false,type:'checkout.session.completed',data:{object:{livemode:false,mode:'payment',payment_status:'unpaid'}}}),{ignored:true});
});
