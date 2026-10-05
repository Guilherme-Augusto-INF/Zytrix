// Verification is explicitly simulated for this disposable test-only identity. No mail is sent.
const [connectionFile,fixtureFile]=process.argv.slice(2);if(!fixtureFile)throw Error('Usage: seed-managed-fixture.mjs <private-owner-connection> <private-fixture-file>');
import {randomUUID} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import pg from 'pg';
import {STAGING_AUTH_URL} from '../../server/neon/neon-token.mjs';
import {validateStagingUrl} from './staging-target.mjs';
const fixture={email:'zytrix-fixture-'+randomUUID()+'@example.invalid',password:'Test-'+randomUUID()+'9',name:'StagingFixture'};
const r=await fetch(STAGING_AUTH_URL+'/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5502'},body:JSON.stringify(fixture)});
const v=await r.json();if(!r.ok){console.log(JSON.stringify({status:r.status,code:v.code}));process.exit(1);}
fixture.subject=v.user.id;fixture.cookie=r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
const c=new pg.Client({connectionString:validateStagingUrl((await readFile(connectionFile,'utf8')).trim()),ssl:{rejectUnauthorized:true}});
await c.connect();try{await c.query('update neon_auth."user" set "emailVerified"=true where id=$1 and email=$2',[fixture.subject,fixture.email]);}finally{await c.end();}
const t=await fetch(STAGING_AUTH_URL+'/token',{headers:{Cookie:fixture.cookie,Origin:'http://127.0.0.1:5502'}});const token=await t.json();
fixture.token=token.token;await writeFile(fixtureFile,JSON.stringify(fixture));
console.log(JSON.stringify({status:r.status,tokenStatus:t.status,claimKeys:token.token?Object.keys(JSON.parse(Buffer.from(token.token.split('.')[1],'base64url'))):[]}));
