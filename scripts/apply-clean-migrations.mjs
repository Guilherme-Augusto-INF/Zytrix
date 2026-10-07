import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
const raw=(await readFile(process.env.NEON_MIGRATION_ADMIN_FILE,'utf8')).trim(),url=new URL(raw);
if(!url.hostname.startsWith('ep-icy-night-b6fvg1ni')||url.pathname!='/neondb')throw Error('unexpected_database_target');url.search='';
const client=new pg.Client({connectionString:url.href,ssl:{rejectUnauthorized:true}});await client.connect();
try{
 await client.query('create table if not exists private.schema_migrations(name text primary key,sha256 text not null,applied_at timestamptz not null default now())');
 for(const name of ['002_categories.sql','003_auth_canonical.sql','004_ledger_invariants.sql']){
  const sql=await readFile(new URL('../database/neon/'+name,import.meta.url),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const old=(await client.query('select sha256 from private.schema_migrations where name=$1',[name])).rows[0];
  if(old){if(old.sha256!==hash)throw Error('migration_changed:'+name);continue;}
  await client.query('begin');await client.query(sql.replace(/^\s*begin;/gim,'').replace(/^\s*commit;/gim,''));await client.query('insert into private.schema_migrations(name,sha256)values($1,$2)',[name,hash]);await client.query('commit');console.log('Applied '+name);
 }
 const audit=(await client.query(`select (select count(*) from neon_auth."user") auth_users,(select count(*) from public.profiles) profiles,(select count(*) from public.categories) categories,(select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace) foreign_keys,(select count(*) from pg_indexes where schemaname in('public','private')) indexes,(select count(*) from pg_trigger where not tgisinternal and tgrelid in(select oid from pg_class where relnamespace in('public'::regnamespace,'private'::regnamespace,'neon_auth'::regnamespace))) triggers,(select rolbypassrls from pg_roles where rolname='zytrix_runtime') runtime_bypassrls,(select count(*) from neon_auth."user" n left join public.profiles p on p.user_id=n.id where p.user_id is null) missing_profiles,(select count(*) from public.identities i left join neon_auth."user" n on n.id=i.id where n.id is null) orphan_identities`)).rows[0];console.log(JSON.stringify(audit));
}finally{await client.end();}
