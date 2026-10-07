import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {executePlatform} from '../server/neon/platform.mjs';
import {parseStreamingSource} from '../assets/js/streaming.js';

test('channel creation rejects anonymous and unverified sessions before querying',async()=>{
 const db={query(){throw Error('Unexpected query');}};
 await assert.rejects(executePlatform(db,null,'channel.create',{playbackURL:'https://www.twitch.tv/alanzoka'}),e=>e.status===401);
 await assert.rejects(executePlatform(db,{authProvider:'neon',subject:'fixture',emailVerified:false},'channel.create',{}),e=>e.status===403);
});
test('streaming parser validates all supported platforms and rejects malformed Twitch links',()=>{
 for(const [url,platform] of [['https://www.twitch.tv/alanzoka','twitch'],['https://kick.com/example','kick'],['https://youtu.be/dQw4w9WgXcQ','youtube']])assert.equal(parseStreamingSource(url)?.platform,platform);
 for(const url of ['https://www.twitch.tv/','https://www.twitch.tv/a','https://www.twitch.tv/directory','https://www.twitch.tv/alanzoka/extra','https://twitch.tv.evil.example/alanzoka','https://user:password@twitch.tv/alanzoka','https://kick.com/categories','https://youtube.com/watch?v=short'])assert.equal(parseStreamingSource(url),null,url);
});
test('profile button uses the authenticated server action and follows persisted success',async()=>{
 const source=await readFile(new URL('../assets/js/perfil.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function createStreamer()'),source.indexOf('async function deleteAccount()'));
 const message={},input={value:'https://www.twitch.tv/alanzoka',focus(){}},button={isConnected:true};let called;
 const uid='fixture';const context=vm.createContext({console,creatingChannel:false,user:{uid,emailVerified:true,reload:async()=>{},getIdToken:async()=>{}},document:{querySelector:s=>({'#streamer-msg':message,'#stream-url':input,'#be-streamer':button}[s])},parseStreamingSource,ownPlatform:async(...args)=>{called=args;return {channelId:uid,streamId:uid};},location:{href:''}});
 await vm.runInContext(fn+';createStreamer()',context);
 assert.equal(called[0],uid);assert.equal(called[1],'channel.create');assert.equal(called[2].playbackURL,input.value);assert.deepEqual(Object.keys(called[2]),['playbackURL']);assert.equal(context.location.href,'config-live.html');assert.equal(button.disabled,false);
});
