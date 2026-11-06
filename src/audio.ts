// Every sound is synthesized locally with Web Audio: no files, no network, nothing to license.
// Music is tuned to A4 = 432 Hz. Layers: lake (water, wind, distant birds), music (drone + pentatonic
// chimes that never repeat exactly), alpha (10 Hz binaural beat for headphones). See docs/audio-plan.md.
export type SoundState={on:boolean;music:boolean;alpha:boolean;volume:number};
type LayerName='lake'|'music'|'alpha';

const A4=432;
export const note=(semitonesFromA4:number)=>A4*2**(semitonesFromA4/12);
const PENTATONIC=[-12,-9,-7,-5,-2,0,3,5,7,10,12]; // A minor pentatonic, A3…A5
const LEVEL:Record<LayerName,number>={lake:0.55,music:0.7,alpha:0.5};
const pick=<T,>(a:T[])=>a[Math.floor(Math.random()*a.length)];

export class SanctuaryAudio {
 private ctx:AudioContext|null=null;private master:GainNode|null=null;private noise:AudioBuffer|null=null;
 private layers:Partial<Record<LayerName,GainNode>>={};private stops:(()=>void)[]=[];private timers=new Set<number>();
 private chiming=false;private birding=false;
 private state:SoundState={on:false,music:false,alpha:false,volume:0.7};

 /** Call from a user gesture the first time (autoplay policy). */
 async set(next:SoundState){
  this.state=next;
  if(!next.on){
   const ctx=this.ctx;if(!ctx||!this.master)return;
   this.master.gain.setTargetAtTime(0,ctx.currentTime,0.15);
   await new Promise(r=>setTimeout(r,450));
   if(!this.state.on&&ctx.state==='running')await ctx.suspend();
   return;
  }
  const ctx=this.ensure();await ctx.resume();
  this.master!.gain.setTargetAtTime(next.volume,ctx.currentTime,0.4);
  this.layer('lake',true);this.layer('music',next.music);this.layer('alpha',next.alpha);
 }

 /** Singing-bowl strike: inharmonic partials with a long tail. */
 bowl(){this.strike(note(-12),[[1,0.07],[2.76,0.03],[5.4,0.014],[8.93,0.007]],7);}
 /** One soft chime, e.g. when a lantern is released. */
 chime(){this.strike(note(pick(PENTATONIC)),[[1,0.06],[2.01,0.015]],4);}

 async stop(){
  for(const id of this.timers)clearTimeout(id);this.timers.clear();
  for(const s of this.stops)s();this.stops=[];
  const ctx=this.ctx;this.ctx=null;this.master=null;this.layers={};this.chiming=this.birding=false;
  if(ctx)await ctx.close();
 }

 // ---------- internals ----------
 private ensure(){
  if(this.ctx)return this.ctx;
  const ctx=new AudioContext();this.ctx=ctx;
  this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
  const len=ctx.sampleRate*4,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){last=(last+(Math.random()*2-1)*0.025)*0.995;d[i]=last*0.8;} // brown noise
  this.noise=buf;
  return ctx;
 }
 private later(fn:()=>void,ms:number){const id=window.setTimeout(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);}
 private layer(name:LayerName,on:boolean){
  const ctx=this.ctx!;let g=this.layers[name];
  if(!g&&on){g=ctx.createGain();g.gain.value=0;g.connect(this.master!);this.layers[name]=g;this.build[name](ctx,g);}
  if(!g)return;
  g.gain.setTargetAtTime(on?LEVEL[name]:0,ctx.currentTime,on?1.2:0.3);
  if(on&&name==='music'&&!this.chiming){this.chiming=true;this.later(()=>this.chimeLoop(),1500);}
  if(on&&name==='lake'&&!this.birding){this.birding=true;this.later(()=>this.birdLoop(),8000);}
 }
 private osc(ctx:AudioContext,freq:number,type:OscillatorType='sine'){const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;o.start();this.stops.push(()=>o.stop());return o;}
 private lfo(ctx:AudioContext,rate:number,depth:number,target:AudioParam){const g=ctx.createGain();g.gain.value=depth;this.osc(ctx,rate).connect(g).connect(target);}
 private loopNoise(ctx:AudioContext,offset:number){const s=ctx.createBufferSource();s.buffer=this.noise;s.loop=true;s.start(0,offset);this.stops.push(()=>s.stop());return s;}

 private build:Record<LayerName,(ctx:AudioContext,out:GainNode)=>void>={
  lake:(ctx,out)=>{
   // Water lapping: low-passed brown noise whose cutoff rises and falls like small waves.
   const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;
   this.lfo(ctx,0.11,180,lp.frequency);
   this.loopNoise(ctx,0).connect(lp).connect(out);
   // Wind through the reeds: band-passed noise, slowly swelling.
   const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=750;bp.Q.value=0.6;
   const wind=ctx.createGain();wind.gain.value=0.22;this.lfo(ctx,0.05,0.18,wind.gain);
   this.loopNoise(ctx,1.7).connect(bp).connect(wind).connect(out);
  },
  music:(ctx,out)=>{
   // Shared space: a damped feedback delay gives chimes a soft room around them.
   const bus=ctx.createGain(),delay=ctx.createDelay(2),fb=ctx.createGain(),damp=ctx.createBiquadFilter();
   delay.delayTime.value=0.48;fb.gain.value=0.38;damp.type='lowpass';damp.frequency.value=2200;
   bus.connect(out);bus.connect(delay);delay.connect(damp);damp.connect(fb);fb.connect(delay);damp.connect(out);
   this.musicBus=bus;
   // Drone: A2, E3 and A3 (slightly detuned), each breathing at its own slow rate.
   const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=650;lp.connect(out);
   [[note(-24),0.07,0.031],[note(-17),0.04,0.023],[note(-12)+0.35,0.025,0.017]].forEach(([f,level,rate])=>{
    const g=ctx.createGain();g.gain.value=level;this.lfo(ctx,rate,level*0.6,g.gain);
    this.osc(ctx,f,'triangle').connect(g).connect(lp);
   });
  },
  alpha:(ctx,out)=>{
   // Binaural beat: 216 Hz in the left ear, 226 Hz in the right → a 10 Hz pulse perceived with headphones.
   const merger=ctx.createChannelMerger(2),g=ctx.createGain();g.gain.value=0.06;
   this.osc(ctx,note(-12)).connect(merger,0,0);this.osc(ctx,note(-12)+10).connect(merger,0,1);
   merger.connect(g).connect(out);
  },
 };
 private musicBus:GainNode|null=null;

 private strike(f:number,partials:number[][],decay:number,dest?:AudioNode){
  const ctx=this.ctx;if(!ctx||!this.master||!this.state.on||ctx.state!=='running')return;
  const t=ctx.currentTime,env=ctx.createGain(),pan=ctx.createStereoPanner();
  pan.pan.value=Math.random()*1.2-0.6;env.connect(pan).connect(dest??this.master);
  env.gain.setValueAtTime(0.0001,t);env.gain.exponentialRampToValueAtTime(1,t+0.015);env.gain.exponentialRampToValueAtTime(0.0001,t+decay);
  for(const [ratio,level] of partials){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f*ratio;g.gain.value=level;o.connect(g).connect(env);o.start(t);o.stop(t+decay+0.1);}
 }
 private chimeLoop(){
  if(!this.ctx||!this.state.on||!this.state.music){this.chiming=false;return;}
  this.strike(note(pick(PENTATONIC)),[[1,0.05],[2.01,0.012]],5,this.musicBus??undefined);
  this.later(()=>this.chimeLoop(),3000+Math.random()*6000);
 }
 private birdLoop(){
  const ctx=this.ctx;if(!ctx||!this.state.on){this.birding=false;return;}
  if(ctx.state==='running'){
   const t=ctx.currentTime,pan=ctx.createStereoPanner();pan.pan.value=Math.random()*1.6-0.8;pan.connect(this.layers.lake!);
   const calls=2+Math.floor(Math.random()*2),base=2400+Math.random()*700;
   for(let i=0;i<calls;i++){const s=t+i*0.16,o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(base,s);o.frequency.exponentialRampToValueAtTime(base*1.45,s+0.08);
    g.gain.setValueAtTime(0.0001,s);g.gain.exponentialRampToValueAtTime(0.025,s+0.02);g.gain.exponentialRampToValueAtTime(0.0001,s+0.11);
    o.connect(g).connect(pan);o.start(s);o.stop(s+0.12);}
  }
  this.later(()=>this.birdLoop(),9000+Math.random()*16000);
 }
}
