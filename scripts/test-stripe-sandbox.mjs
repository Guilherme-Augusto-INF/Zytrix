// Explicit sandbox network test. Reads credentials privately; prints aggregates only.
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
const [directory,reportFile]=process.argv.slice(2);
if(!directory||!reportFile)throw Error('Usage: test-stripe-sandbox.mjs <private-key-directory> <private-report>');
try {
  const keys=new Set();
  for(const name of await readdir(directory)){
    const path=join(directory,name),info=await stat(path);
    if(info.isFile()&&info.size<65536)for(const key of (await readFile(path,'utf8')).match(/sk_test_[A-Za-z0-9]+/g)??[])keys.add(key);
  }
  if(keys.size!==1)throw Error('sandbox_key_missing_or_ambiguous');
  const stripe=new Stripe([...keys][0],{maxNetworkRetries:1,timeout:15000});
  const balance=await stripe.balance.retrieve();assert.equal(balance.livemode,false);
  const requestKey='zytrix-sandbox-validation-'+randomUUID();
  const payment=await stripe.paymentIntents.create({amount:490,currency:'brl',payment_method:'pm_card_visa',payment_method_types:['card'],confirm:true,description:'Zytrix sandbox integration validation'},{idempotencyKey:requestKey});
  assert.equal(payment.livemode,false);assert.equal(payment.status,'succeeded');
  const replay=await stripe.paymentIntents.create({amount:490,currency:'brl',payment_method:'pm_card_visa',payment_method_types:['card'],confirm:true,description:'Zytrix sandbox integration validation'},{idempotencyKey:requestKey});
  assert.equal(replay.id,payment.id);
  const report={checkedAt:new Date().toISOString(),sandbox:true,connection:'PASS',testPayment:'PASS',idempotency:'PASS',currency:'brl',amountCents:490,limitations:['Provider API test only; hosted Checkout and webhook delivery require separate validation.']};
  await writeFile(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
  // Stripe messages may contain request identifiers or user-provided values.
  console.error(JSON.stringify({result:'FAIL',type:error?.type??error?.name??'Error',code:/^[a-z_]+$/.test(error?.code??'')?error.code:'validation_failed'}));process.exitCode=1;
}
