import test from 'node:test';import assert from 'node:assert/strict';
import {consumeEvents} from '../assets/js/realtime-client.js';
test('fragmented UTF-8 snapshots survive stream boundaries and heartbeat comments',async()=>{
 const bytes=new TextEncoder().encode(': heartbeat\n\nevent: snapshot\ndata: {"messages":[{"text":"Olá 🔥"}]}\n\nevent: snapshot\ndata: {"messages":[]}\n\n');
 const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}});
 const values=[];await consumeEvents(stream,x=>values.push(x),new AbortController().signal);
 assert.equal(values[0].messages[0].text,'Olá 🔥');assert.deepEqual(values[1],{messages:[]});
});
test('abort cancels a pending reader so a closed tab cannot retain an orphan stream',async()=>{
 const controller=new AbortController();let cancelled=false;
 const stream=new ReadableStream({cancel(){cancelled=true;}});
 const reading=consumeEvents(stream,()=>assert.fail('No snapshot'),controller.signal);
 controller.abort();await reading;assert.equal(cancelled,true);
});
test('cancelled reader does not deliver private snapshots; oversized events rejected',async()=>{
 const controller=new AbortController();controller.abort();let delivered=false;
 await consumeEvents(new ReadableStream({start(c){c.close();}}),()=>delivered=true,controller.signal);assert.equal(delivered,false);
 const oversized=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(262145)));c.close();}});
 await assert.rejects(consumeEvents(oversized,()=>{},new AbortController().signal),/event_too_large/);
});
