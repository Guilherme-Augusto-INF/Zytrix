import {readFile,readdir} from 'node:fs/promises';import {resolve} from 'node:path';import pg from 'pg';
import {readJsonLines,sha256,writeJson} from './lib.mjs';import {validateStagingUrl} from './staging-target.mjs';
import {TABLES,PRIVATE,diffRows,identifier,brokenReferences} from './reconcile-model.mjs';
const [directoryArg,reportArg,mode='--dry-run']=process.argv.slice(2);
if(!directoryArg||!reportArg||!['--dry-run','--apply-staging'].includes(mode))throw Error('Usage: reconcile.mjs <normalized-directory> <private-report.json> [--dry-run|--apply-staging]');
const directory=resolve(directoryArg),manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
if(manifest.unknownPaths?.length)throw Error('Unmapped source paths');
const files=(await readdir(directory)).filter(x=>x.endsWith('.jsonl')).sort();
const source={};for(const f of files){const table=f.slice(0,-6),raw=await readFile(resolve(directory,f));if(!TABLES.has(table)||manifest.tables?.[table]?.sha256!==sha256(raw))throw Error('Unreviewed table/checksum');source[table]=await readJsonLines(resolve(directory,f));if(source[table].length!==manifest.tables[table].rows)throw Error('Row count mismatch');}
const connection=process.env.NEON_DATABASE_URL_FILE?(await readFile(process.env.NEON_DATABASE_URL_FILE,'utf8')).trim():process.env.NEON_DATABASE_URL;
const c=new pg.Client({connectionString:validateStagingUrl(connection),ssl:{rejectUnauthorized:true}});
const report={generatedAt:new Date().toISOString(),mode,tables:{},invariants:{},applied:0,status:'DRY_RUN'},destination={};
try{await c.connect();await c.query(mode==='--apply-staging'?'begin isolation level serializable':'begin isolation level repeatable read read only');await c.query("set local statement_timeout='30s'");await c.query("set local lock_timeout='5s'");
 for(const [table,expected]of Object.entries(source)){
  const schema=PRIVATE.has(table)?'private':'public',qualified=identifier(schema)+'.'+identifier(table);
  if(mode==='--apply-staging')await c.query('lock table '+qualified+' in share row exclusive mode');
  const meta=(await c.query(`select a.attname as name,a.attgenerated as generated from pg_attribute a where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped`,[schema+'.'+table])).rows;
  const columns=new Set(meta.filter(x=>!x.generated).map(x=>x.name));
  for(const row of expected)if(Object.keys(row).some(k=>!columns.has(k)))throw Error('Unreviewed/generated column');
  const keys=(await c.query(`select a.attname from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,n) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=$1::regclass and i.indisprimary order by k.n`,[schema+'.'+table])).rows.map(x=>x.attname);
  const actual=(await c.query('select * from '+qualified)).rows;destination[table]=actual;const delta=diffRows(table,expected,actual,keys);
  report.tables[table]={...delta,plan:delta.plan.map(x=>({kind:x.kind,key:x.where}))};
  if(mode==='--apply-staging'&&delta.conflicts.length)throw Error('Conflicts block the entire transaction');
  if(mode==='--apply-staging')for(const change of delta.plan){
   const names=Object.keys(change.row),values=names.map(k=>change.row[k]);
   if(change.kind==='insert')await c.query('insert into '+qualified+' ('+names.map(identifier).join(',')+') values('+names.map((_,i)=>'$'+(i+1)).join(',')+')',values);
   else{const assignments=names.filter(k=>!keys.includes(k));await c.query('update '+qualified+' set '+assignments.map((k,i)=>identifier(k)+'=$'+(i+1)).join(',')+' where '+keys.map((k,i)=>identifier(k)+'=$'+(assignments.length+i+1)).join(' and '),[...assignments.map(k=>change.row[k]),...keys.map(k=>change.where[k])]);}report.applied++;
  }
 }
 const checks={negativeWallets:'select count(*)::int as n from public.wallets where balance<0 or total_sent<0 or total_received<0',orphanLives:'select count(*)::int as n from public.lives l left join public.channels c on c.id=l.channel_id where c.id is null',orphanMessages:'select count(*)::int as n from public.chat_messages m left join public.lives l on l.id=m.live_id where l.id is null',identityMismatch:'select count(*)::int as n from public.user_accounts a join public.identities i on i.id=a.user_id where a.firebase_uid is distinct from i.firebase_uid'};
 for(const [name,sql]of Object.entries(checks))report.invariants[name]=Number((await c.query(sql)).rows[0].n);
 const fks=(await c.query(`select conrelid::regclass::text as child,confrelid::regclass::text as parent,convalidated from pg_constraint where contype='f' and connamespace in ('public'::regnamespace,'private'::regnamespace)`)).rows;report.foreignKeys={total:fks.length,unvalidated:fks.filter(x=>!x.convalidated)};
 const refs=(await c.query(`select child.relname as child,parent.relname as parent,array(select a.attname::text from unnest(f.conkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=f.conrelid and a.attnum=k.n order by k.o) as columns,array(select a.attname::text from unnest(f.confkey) with ordinality k(n,o) join pg_attribute a on a.attrelid=f.confrelid and a.attnum=k.n order by k.o) as "parentColumns" from pg_constraint f join pg_class child on child.oid=f.conrelid join pg_class parent on parent.oid=f.confrelid where f.contype='f' and f.connamespace in ('public'::regnamespace,'private'::regnamespace)`)).rows.filter(x=>source[x.child]&&TABLES.has(x.parent));
 for(const ref of refs)if(!destination[ref.parent])destination[ref.parent]=(await c.query('select * from '+identifier(PRIVATE.has(ref.parent)?'private':'public')+'.'+identifier(ref.parent))).rows;
 report.brokenSourceReferences=brokenReferences(source,destination,refs);
 report.walletDivergences=report.tables.wallets?.changed??[];report.profileDivergences=report.tables.profiles?.changed??[];report.identityDivergences=report.tables.identities?.changed??[];
 if(Object.values(report.invariants).some(n=>n)||report.foreignKeys.unvalidated.length||report.brokenSourceReferences.length)throw Error('Integrity gate failed');
 if(mode==='--apply-staging'){await c.query('set constraints all immediate');await c.query('commit');report.status='APPLIED_STAGING';}else await c.query('rollback');
}catch(e){await c.query('rollback').catch(()=>{});report.status='BLOCKED_ROLLED_BACK';report.applied=0;report.error=e.code??e.message;process.exitCode=2;}finally{await c.end();await writeJson(resolve(reportArg),report);}
console.log(JSON.stringify({status:report.status,mode,applied:report.applied,tables:Object.keys(report.tables).length}));
