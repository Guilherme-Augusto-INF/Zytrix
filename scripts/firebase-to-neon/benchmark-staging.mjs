// Bounded read-only latency sample. Not a production capacity/load certification.
import pg from 'pg';import {readFile,writeFile} from 'node:fs/promises';import {performance} from 'node:perf_hooks';
import {validateStagingUrl} from './staging-target.mjs';
const [connectionFile,reportFile]=process.argv.slice(2);if(!connectionFile||!reportFile)throw Error('Private connection and report paths required');
const c=new pg.Client({connectionString:validateStagingUrl((await readFile(connectionFile,'utf8')).trim()),ssl:{rejectUnauthorized:true},statement_timeout:5000});
try{await c.connect();await c.query('begin read only');await c.query('set local role zytrix_staging_app');
 const query='select firebase_id,viewer_count from public.live_feed order by viewer_count desc,created_at desc,postgres_id limit 80';
 await c.query(query);const samples=[];let rows=0;
 for(let i=0;i<25;i++){const start=performance.now();rows=(await c.query(query)).rowCount;samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);const report={status:'PASS',mode:'READ_ONLY',samples:25,rowsPerSample:rows,p50Ms:Math.round(samples[12]),p95Ms:Math.round(samples[23]),maxMs:Math.round(samples[24]),limitations:'Single connection, current staging dataset, no browser/concurrent-user capacity claim'};
 await c.query('rollback');await writeFile(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await c.query('rollback').catch(()=>{});console.log(JSON.stringify({status:'FAIL',code:e.code??e.name}));process.exitCode=1;}finally{await c.end();}
