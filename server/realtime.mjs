// Authoritative presence server for the shared lake. Protocol: docs/realtime-contract.md.
// Memory only: no accounts, no persistence, no IP logging. No free text exists, so there is nothing to moderate.
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {clampWalkPosition,createLantern,isValidName} from '../src/logic.ts';

export const LIMITS={roomSize:12,lanterns:40,msgsPerSecond:20,lanternGapMs:3000,nameGapMs:2000,perIp:4,maxClients:500,tickMs:100,heartbeatMs:10000};
const TAU=Math.PI*2,r2=v=>Math.round(v*100)/100;

/** Client address for the per-IP limit. Behind exactly one trusted proxy (Render, Fly, nginx) the proxy appends
 *  the real address as the LAST X-Forwarded-For entry; earlier entries are client-supplied and spoofable. */
export function clientIp(req,trustProxy){
 const xff=trustProxy?String(req.headers['x-forwarded-for']??'').split(',').map(s=>s.trim()).filter(Boolean).at(-1):undefined;
 return xff??req.socket.remoteAddress??'?';
}

export function createRealtimeServer({port=8787,allowedOrigins=[],trustProxy=false}={}){
 const rooms=new Map(),perIp=new Map(),clients=new Map();let nextId=1,nextRoom=1;
 // Plain HTTP answers /health (for the host's health check); everything else is the WebSocket upgrade.
 const http=createServer((req,res)=>{const ok=req.url==='/health';res.writeHead(ok?200:426,{'content-type':'text/plain'});res.end(ok?'ok':'WebSocket only');});
 const wss=new WebSocketServer({server:http,maxPayload:512,
  verifyClient:({origin})=>!allowedOrigins.length||allowedOrigins.includes(origin)});
 const send=(ws,m)=>{if(ws.readyState===1)ws.send(JSON.stringify(m));};
 const broadcast=(room,m,except)=>{const s=JSON.stringify(m);for(const c of room.peers.values())if(c!==except&&c.ws.readyState===1)c.ws.send(s);};
 const pub=c=>({id:c.id,name:c.name,x:c.x,z:c.z,f:c.f,s:c.s});
 const roomWithSpace=()=>{
  for(const r of rooms.values())if(r.peers.size<LIMITS.roomSize)return r;
  const r={id:`lake-${nextRoom++}`,peers:new Map(),lanterns:[],seq:0};rooms.set(r.id,r);return r;
 };

 wss.on('connection',(ws,req)=>{
  const ip=clientIp(req,trustProxy);
  const n=(perIp.get(ip)??0)+1;
  if(n>LIMITS.perIp||wss.clients.size>LIMITS.maxClients){ws.close(1013,'busy');return;}
  perIp.set(ip,n);
  const c={ws,id:String(nextId++),name:null,room:null,x:11.5,z:3,f:0,s:false,dirty:false,alive:true,win:0,count:0,lastLantern:0,lastName:0};
  clients.set(ws,c);ws.on('pong',()=>{c.alive=true;});
  ws.on('message',(data,isBinary)=>{
   const now=Date.now();
   if(now-c.win>1000){c.win=now;c.count=0;}
   if(++c.count>LIMITS.msgsPerSecond)return; // silently drop floods
   let m;try{m=isBinary?null:JSON.parse(String(data));}catch{m=null;}
   if(!m||typeof m!=='object'){ws.close(1007,'bad message');return;}
   if(!c.room){
    if(m.t!=='hello'||m.v!==1||!isValidName(m.name)){ws.close(1008,'hello required');return;}
    c.name=m.name;const room=roomWithSpace();c.room=room;room.peers.set(c.id,c);
    send(ws,{t:'welcome',id:c.id,room:room.id,peers:[...room.peers.values()].filter(p=>p!==c).map(pub),lanterns:room.lanterns});
    broadcast(room,{t:'join',peer:pub(c)},c);
    return;
   }
   if(m.t==='move'){
    if(![m.x,m.z,m.f].every(Number.isFinite))return;
    const p=clampWalkPosition({x:m.x,z:m.z}); // same walking rules as the client
    c.x=r2(p.x);c.z=r2(p.z);c.f=r2(((m.f%TAU)+TAU)%TAU);c.s=m.s===true;c.dirty=true;
   }else if(m.t==='lantern'){
    if(now-c.lastLantern<LIMITS.lanternGapMs){send(ws,{t:'notice',code:'slow'});return;}
    c.lastLantern=now;const room=c.room,l=createLantern(room.seq++,now);
    room.lanterns=[...room.lanterns.slice(-(LIMITS.lanterns-1)),l];
    broadcast(room,{t:'lantern',lantern:l});
   }else if(m.t==='name'){
    if(!isValidName(m.name)||now-c.lastName<LIMITS.nameGapMs)return;
    c.lastName=now;c.name=m.name;broadcast(c.room,{t:'join',peer:pub(c)},c); // join doubles as upsert
   }
  });
  ws.on('close',()=>{
   clients.delete(ws);
   const left=(perIp.get(ip)??1)-1;if(left>0)perIp.set(ip,left);else perIp.delete(ip);
   const r=c.room;if(!r)return;r.peers.delete(c.id);
   if(r.peers.size)broadcast(r,{t:'leave',id:c.id});else rooms.delete(r.id);
  });
  ws.on('error',()=>{});
  setTimeout(()=>{if(!c.room)ws.close(1008,'hello required');},5000);
 });

 // 10 Hz: send only poses that changed.
 const tick=setInterval(()=>{for(const r of rooms.values()){
  const changed=[];for(const c of r.peers.values())if(c.dirty){c.dirty=false;changed.push({id:c.id,x:c.x,z:c.z,f:c.f,s:c.s});}
  if(changed.length)broadcast(r,{t:'state',peers:changed});
 }},LIMITS.tickMs);
 // Presence expiry: a client that misses a heartbeat (browsers answer pings automatically) is dropped within ~20 s.
 const beat=setInterval(()=>{for(const [ws,c] of clients){if(!c.alive){ws.terminate();continue;}c.alive=false;ws.ping();}},LIMITS.heartbeatMs);

 return {
  wss,rooms,
  port:()=>http.address().port,
  ready:new Promise(res=>http.listen(port,()=>res())),
  close:()=>{clearInterval(tick);clearInterval(beat);for(const ws of wss.clients)ws.terminate();return new Promise(res=>wss.close(()=>http.close(()=>res())));},
 };
}
