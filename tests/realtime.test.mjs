// Integration test: real server, real WebSocket clients (Node 22+ ships a global WebSocket client).
import test from 'node:test';import assert from 'node:assert/strict';
import {createRealtimeServer,LIMITS,clientIp} from '../server/realtime.mjs';
import {LAKE_RADIUS,WALK_LIMIT} from '../src/logic.ts';

function client(url){
 const ws=new WebSocket(url),inbox=[],waiters=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);const i=waiters.findIndex(w=>w.pred(m));if(i>=0)waiters.splice(i,1)[0].res(m);else inbox.push(m);};
 const next=(pred=()=>true,ms=2000)=>{const i=inbox.findIndex(pred);if(i>=0)return Promise.resolve(inbox.splice(i,1)[0]);
  return new Promise((res,rej)=>{waiters.push({pred,res});setTimeout(()=>rej(new Error('timeout waiting for message')),ms);});};
 const opened=new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
 const closed=new Promise(res=>{ws.onclose=e=>res(e.code);});
 return {ws,next,opened,closed,send:m=>ws.send(JSON.stringify(m))};
}
async function start(t){const server=createRealtimeServer({port:0});await server.ready;t.after(()=>server.close());return `ws://localhost:${server.port()}`;}

test('shared lake: join, move, lantern, rename, leave',async t=>{
 const url=await start(t);
 const a=client(url),b=client(url);await Promise.all([a.opened,b.opened]);
 a.send({t:'hello',v:1,name:[1,2]});
 const wa=await a.next(m=>m.t==='welcome');assert.equal(wa.peers.length,0);assert.deepEqual(wa.lanterns,[]);
 b.send({t:'hello',v:1,name:[3,4]});
 const wb=await b.next(m=>m.t==='welcome');assert.equal(wb.peers.length,1);assert.deepEqual(wb.peers[0].name,[1,2]);
 const join=await a.next(m=>m.t==='join');assert.deepEqual(join.peer.name,[3,4]);

 // Same walking rules as the client: a pose in the middle of the lake is pushed back to the shore.
 a.send({t:'move',x:0,z:0.5,f:1,s:true});
 const p=(await b.next(m=>m.t==='state')).peers[0],r=Math.hypot(p.x,p.z);
 assert.ok(r>=LAKE_RADIUS+0.79&&r<=WALK_LIMIT+0.01,`clamped radius ${r}`);assert.equal(p.s,true);

 a.send({t:'lantern'});
 const [la,lb]=await Promise.all([a.next(m=>m.t==='lantern'),b.next(m=>m.t==='lantern')]);assert.equal(la.lantern.id,lb.lantern.id);
 a.send({t:'lantern'});
 assert.equal((await a.next(m=>m.t==='notice')).code,'slow','second lantern within 3 s is refused');

 b.send({t:'name',name:[5,6]});
 assert.deepEqual((await a.next(m=>m.t==='join')).peer.name,[5,6]);
 b.ws.close();
 assert.equal((await a.next(m=>m.t==='leave')).id,join.peer.id);
 a.ws.close();await a.closed;
});

test('late joiners receive existing lanterns; bad input is ignored',async t=>{
 const url=await start(t);
 const a=client(url);await a.opened;a.send({t:'hello',v:1,name:[0,0]});await a.next(m=>m.t==='welcome');
 a.send({t:'move',x:'nope',z:0,f:0,s:false});a.send({t:'move',x:Infinity,z:0,f:0,s:false});
 a.send({t:'lantern'});await a.next(m=>m.t==='lantern');
 const b=client(url);await b.opened;b.send({t:'hello',v:1,name:[0,0]});
 const w=await b.next(m=>m.t==='welcome');assert.equal(w.lanterns.length,1);
 assert.deepEqual([w.peers[0].x,w.peers[0].z],[11.5,3],'invalid moves did not change the pose');
 a.ws.close();b.ws.close();
});

test('invalid hello is refused; a full lake opens a new one',async t=>{
 const url=await start(t);
 const bad=client(url);await bad.opened;bad.send({t:'hello',v:1,name:[99,0]});
 assert.equal(await bad.closed,1008);
 const saved=LIMITS.perIp;LIMITS.perIp=100;t.after(()=>{LIMITS.perIp=saved;}); // all test clients share one address
 const cs=[];
 for(let i=0;i<=LIMITS.roomSize;i++){const c=client(url);await c.opened;c.send({t:'hello',v:1,name:[0,0]});cs.push({c,w:await c.next(m=>m.t==='welcome')});}
 assert.equal(cs[0].w.room,cs[LIMITS.roomSize-1].w.room);
 assert.notEqual(cs[0].w.room,cs[LIMITS.roomSize].w.room,'13th wanderer opens a new lake');
 for(const {c} of cs)c.ws.close();
});

test('too many connections from one address are refused',async t=>{
 const url=await start(t),cs=[];
 for(let i=0;i<LIMITS.perIp;i++){const c=client(url);await c.opened;cs.push(c);}
 const extra=client(url);assert.equal(await extra.closed,1013);
 for(const c of cs)c.ws.close();
});

test('per-IP limit uses the proxy-appended address only when the proxy is trusted',()=>{
 const req={headers:{'x-forwarded-for':'6.6.6.6, 203.0.113.9'},socket:{remoteAddress:'10.0.0.1'}};
 assert.equal(clientIp(req,true),'203.0.113.9','last entry = added by the trusted proxy; the spoofed first entry is ignored');
 assert.equal(clientIp(req,false),'10.0.0.1');
 assert.equal(clientIp({headers:{},socket:{remoteAddress:'10.0.0.1'}},true),'10.0.0.1');
});

test('health endpoint answers over plain HTTP',async t=>{
 const server=createRealtimeServer({port:0});await server.ready;t.after(()=>server.close());
 const res=await fetch(`http://localhost:${server.port()}/health`);
 assert.equal(res.status,200);assert.equal(await res.text(),'ok');
});
