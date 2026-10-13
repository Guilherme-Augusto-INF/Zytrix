// Small local component fixtures only. Never call production or exhaust memory.
// Run: node --max-old-space-size=128 scripts/security-reproduce.mjs
import {createRequire} from 'node:module';
import {assertJsonStructure} from '../server/neon/request-body.mjs';
const require=createRequire(import.meta.url);
for(const [label,origin]of [['Neon Auth','@neondatabase/auth'],['Vercel CLI config','@vercel/cli-config']]){
 const scoped=createRequire(require.resolve(origin));
 const {z}=scoped('zod');const result=z.array(z.number()).max(40).safeParse(Array(256).fill('invalid'));
 console.log(JSON.stringify({component:label,elements:256,issues:result.error.issues.length,boundedFixture:true}));
}
const merge=require('deepmerge'),payload=JSON.parse('{"__proto__":{"fixtureAdmin":true}}');
const ordinary=merge({},payload),poisoned=merge(Object.create(null),payload);
console.log(JSON.stringify({component:'deepmerge',ordinaryTargetUnaffected:ordinary.fixtureAdmin===undefined,returnedObjectPoisoned:poisoned.fixtureAdmin===true,ownProperty:Object.hasOwn(poisoned,'fixtureAdmin'),globalPrototypeUnchanged:({}).fixtureAdmin===undefined}));
try{assertJsonStructure({data:payload});throw Error('fixture_not_rejected');}
catch(error){if(error.code!=='invalid_input')throw error;console.log('application input guard rejected prototype payload');}
