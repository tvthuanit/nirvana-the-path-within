// Client side of the shared lake. Protocol: docs/realtime-contract.md. Server: server/realtime.mjs.
import type {Lantern} from './World';

export type Name=[number,number];
export type Peer={id:string;name:Name;x:number;z:number;f:number;s:boolean};
export type NetStatus='off'|'connecting'|'online'|'offline';
type Handlers={status:(s:NetStatus)=>void;peers:(ids:string[])=>void;lanterns:(l:Lantern[])=>void;lantern:(l:Lantern)=>void;notice:(code:string)=>void};

export class Realtime {
 /** Mutated in place so the 3D scene can read poses every frame without React re-renders. */
 readonly peers=new Map<string,Peer>();
 private ws:WebSocket|null=null;private wanted=false;private retry=0;private timer=0;private name:Name=[0,0];private last='';private lastSent=0;
 constructor(private url:string,private on:Handlers){}

 connect(name:Name){this.name=name;if(this.wanted)return;this.wanted=true;this.open();}
 disconnect(){this.wanted=false;clearTimeout(this.timer);const ws=this.ws;this.ws=null;ws?.close();this.reset();this.on.status('off');}
 rename(name:Name){this.name=name;this.send({t:'name',name});}
 releaseLantern(){return this.send({t:'lantern'});}
 /** Throttled to 10 Hz and skipped when nothing changed. */
 sendPose(x:number,z:number,f:number,s:boolean){
  const now=performance.now();if(now-this.lastSent<100)return;
  const msg={t:'move',x:+x.toFixed(2),z:+z.toFixed(2),f:+f.toFixed(2),s},key=JSON.stringify(msg);
  if(key===this.last)return;if(this.send(msg)){this.last=key;this.lastSent=now;}
 }

 private send(m:object){if(this.ws?.readyState!==WebSocket.OPEN)return false;this.ws.send(JSON.stringify(m));return true;}
 private reset(){this.peers.clear();this.on.peers([]);this.last='';}
 private emitPeers(){this.on.peers([...this.peers.keys()]);}
 private open(){
  this.on.status('connecting');
  let ws:WebSocket;
  try{ws=new WebSocket(this.url);}catch{this.scheduleRetry();return;}
  this.ws=ws;
  ws.onopen=()=>ws.send(JSON.stringify({t:'hello',v:1,name:this.name}));
  ws.onmessage=e=>{if(this.ws===ws)this.receive(String(e.data));};
  ws.onclose=()=>{if(this.ws!==ws)return;this.ws=null;this.reset();this.scheduleRetry();};
 }
 private scheduleRetry(){
  if(!this.wanted)return;
  this.on.status('offline');
  const delay=Math.min(30000,1000*2**this.retry++)*(0.75+Math.random()*0.5); // backoff with jitter
  this.timer=window.setTimeout(()=>this.open(),delay);
 }
 private receive(raw:string){
  let m:any;try{m=JSON.parse(raw);}catch{return;}
  switch(m.t){
   case 'welcome':
    this.retry=0;this.peers.clear();for(const p of m.peers)this.peers.set(p.id,p);
    this.emitPeers();this.on.lanterns(m.lanterns.map((l:Lantern)=>({...l,born:0})));this.on.status('online');break; // born:0 → already settled
   case 'join':{const e=this.peers.get(m.peer.id);if(e)Object.assign(e,m.peer);else this.peers.set(m.peer.id,m.peer);this.emitPeers();break;}
   case 'leave':this.peers.delete(m.id);this.emitPeers();break;
   case 'state':for(const p of m.peers){const e=this.peers.get(p.id);if(e)Object.assign(e,p);}break;
   case 'lantern':this.on.lantern({...m.lantern,born:Date.now()});break; // local clock drives the landing animation
   case 'notice':this.on.notice(m.code);break;
  }
 }
}
