import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {publicProfileUrl,profileRouteUsername} from '../assets/js/profile-url.js';
import {publicProfile,publicFields} from '../server/neon/public-profiles.mjs';
import {profilePageSelector,profileQueryNeedsCanonical,renderProfileDocument,createProfilePageHandler} from '../server/neon/profile-page.mjs';
const uid='12345678-1234-4234-8234-123456789012';
const profile={uid,username:'Streamer_Name-1',name:'<script>alert(1)</script>',photoURL:'',bio:'</script><img src=x onerror=alert(1)>',createdAt:'2026-01-01'};
const template=readFileSync('usuario.html','utf8');
const db=rows=>({calls:[],async query(sql,args){this.calls.push({sql,args});return {rows:rows.shift()??[]};},release(){}});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},end(body){this.body=body;return this;}});
test('friendly names use the database ASCII key without Unicode aliases or UUID URLs',()=>{
 for(const name of ['Gui_1','USER-NAME','name.with.dots','12'])assert.equal(publicProfileUrl(name),'/@'+name.toLowerCase());
 for(const name of [uid,'a','@name',' a ','a/b','a?b','a#b','a%2Fb','güi','Ｇｕｉ','a'.repeat(31)])assert.equal(publicProfileUrl(name),'');
 assert.equal(profileRouteUsername('/@GUI_1'), 'gui_1');assert.equal(profileRouteUsername('/@%47ui_1'),'gui_1');
 for(const path of ['/@%2fadmin','/@%252fadmin','/@%','/@name/next'])assert.equal(profileRouteUsername(path),'');
});
test('selectors resolve path identity only and validate legacy UUIDs without overrides',()=>{
 assert.deepEqual(profilePageSelector('/@GUI_1?username=victim&uid='+uid).data,{username:'gui_1'});
 assert.deepEqual(profilePageSelector('/api/public-profile/GUI_1?username=victim').data,{username:'gui_1'});
 assert.deepEqual(profilePageSelector('/usuario.html?uid='+uid.toUpperCase()).data,{uid});
 for(const path of ['/@%2Fadmin','/@%3Cscript%3E','/usuario.html?uid=bad','/usuario.html?uid='+uid+'&uid='+uid,'/usuario.html?uid='+uid+'&next=https://evil.test','/@name/extra'])assert.throws(()=>profilePageSelector(path),e=>e.status===404);
});
test('preview protection and matching rewrite capture do not cause redirect loops',()=>{
 assert.equal(profileQueryNeedsCanonical(new URL('https://fixture.test/@streamer?username=streamer&_vercel_share=fixture'),'streamer'),false);
 assert.equal(profileQueryNeedsCanonical(new URL('https://fixture.test/@streamer?username=victim'),'streamer'),true);
 assert.equal(profileQueryNeedsCanonical(new URL('https://fixture.test/@streamer?uid='+uid),'streamer'),true);
 assert.deepEqual(profilePageSelector('/usuario.html?uid='+uid+'&_vercel_share=fixture').data,{uid});
});
test('username resolver is parameterized, filtered, and refuses service without retirement guard',async()=>{
 const c=db([[{ready:true}],[profile],[],[{followers:0,following:0}]]);
 const state=await publicProfile(c,{username:'STREAMER_NAME-1'});assert.equal(state.profile.uid,uid);
 assert.match(c.calls[1].sql,/p.username_key=\$1/);assert.match(c.calls[1].sql,/disabled_at is null/);assert.match(c.calls[1].sql,/pn.banned/);assert.deepEqual(c.calls[1].args,['streamer_name-1']);
 assert.ok(c.calls.every(x=>!x.sql.includes('streamer_name-1')));
 await assert.rejects(publicProfile(db([[{ready:false}]]),{username:'streamer'}),e=>e.status===503);
 await assert.rejects(publicProfile(db([]),{username:'streamer',uid}),e=>e.status===400);
 await assert.rejects(publicProfile(db([]),{username:"' OR 1=1"}),e=>e.code==='invalid_username');
});
test('server HTML escapes public data and emits friendly canonical, OG and inert bootstrap',()=>{
 const html=renderProfileDocument(template,{profile:publicFields({...profile,email:'secret',sessionToken:'secret'}),channel:null,stats:{followers:0,following:0}});
 assert.ok(html.includes('href="https://zytrix-lives.vercel.app/@streamer_name-1"'));
 assert.ok(html.includes('property="og:url" content="https://zytrix-lives.vercel.app/@streamer_name-1"'));
 assert.ok(!html.includes('<script>alert(1)</script>'));assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('\\u003c/script\\u003e'));assert.ok(!html.includes('sessionToken'));assert.ok(!html.includes('secret'));
 assert.match(html,/src="\/assets\/js\/public-profile.js"/);assert.match(html,/width=device-width/);assert.ok(!html.includes('?uid='));
});
test('HTTP pages serve direct profiles, uncacheable canonical redirects and unavailable states',async()=>{
 for(const [url,rows,status,location]of [
  ['/@streamer_name-1',[[{ready:true}],[profile],[],[{followers:0,following:0}]],200],
  ['/@STREAMER_NAME-1',[[{ready:true}],[profile],[],[{followers:0,following:0}]],307,'/@streamer_name-1'],
  ['/usuario.html?uid='+uid,[[{ready:true}],[profile],[],[{followers:0,following:0}]],307,'/@streamer_name-1'],
  ['/@missing',[[{ready:true}],[]],404],['/@%2Fadmin',[],404],['/@streamer',[[{ready:false}]],503]
 ]){
  const c=db([[],[],...rows,[]]); // begin read only, lock timeout, then reads and commit
  if(status===404&&url==='/@%2Fadmin')c.query=()=>assert.fail('invalid path queried database');
  const out=res();await createProfilePageHandler({enabled:()=>true,pool:()=>({connect:async()=>c}),allow:()=>true,template:async()=>template})({url,method:'GET',headers:{}},out);
  assert.equal(out.code,status,url);assert.equal(out.headers['Cache-Control'],'no-store');assert.equal(out.headers.Location,location);
  if(location)assert.ok(!location.includes(uid));
 }
 const out=res();await createProfilePageHandler({allow:()=>false})({url:'/@streamer',method:'GET',headers:{}},out);assert.equal(out.code,429);assert.equal(out.headers['Retry-After'],'60');
});
test('routing keeps assets/APIs and sends legacy HTML through the server, not a static file',()=>{
 const config=JSON.parse(readFileSync('vercel.json'));assert.ok(config.rewrites.some(x=>x.source==='/@:username'&&x.destination==='/api/public-profile/:username'));
 for(const source of ['/usuario','/usuario.html'])assert.ok(config.rewrites.some(x=>x.source===source&&x.destination==='/api/public-profile'));
 assert.ok(!config.rewrites.some(x=>x.source==='/:path*'));assert.match(readFileSync('scripts/build-site.mjs','utf8'),/item.name!=='usuario.html'/);
 assert.equal(config.functions['api/public-profile/*.js'].includeFiles,'usuario.html');
 for(const path of ['assets/js/live.js','assets/js/ui.js','assets/js/profile-social.js','assets/js/public-profile.js','assets/js/notificacoes.js','assets/js/notifications-plus.js']){
  const source=readFileSync(path,'utf8');assert.ok(!/publicProfileUrl\((?:[^)]*\.uid|[^)]*\.id|[^)]*streamerUid)\)/.test(source),path);assert.ok(!source.includes('/usuario.html?uid='),path);
 }
});
