// Every sound is synthesized locally with Web Audio: no files, no network, nothing to license.
// Music is tuned to A4 = 432 Hz. Layers: music (four generative pieces), lake (soft water + distant birds),
// alpha (10 Hz binaural beat for headphones). See docs/audio-plan.md.
export type SoundState={on:boolean;music:boolean;lake:boolean;alpha:boolean;volume:number;track:number};
type LayerName='lake'|'music'|'alpha';

const A4=432;
export const note=(semitonesFromA4:number)=>A4*2**(semitonesFromA4/12);
const PENTATONIC=[-12,-9,-7,-5,-2,0,3,5,7,10,12]; // A minor pentatonic, A3…A5
const LEVEL:Record<LayerName,number>={music:1.4,lake:0.22,alpha:0.5};
const pick=<T,>(a:readonly T[])=>a[Math.floor(Math.random()*a.length)];
const rand=(a:number,b:number)=>a+Math.random()*(b-a);

// Chords as semitones from A4: [bass, ...voices].
const C={
 Am:[-24,-12,-9,-5],F:[-28,-16,-12,-9],C:[-21,-9,-5,-2],G:[-26,-14,-10,-7],Em:[-29,-17,-14,-10],
 Fmaj7:[-28,-16,-12,-9,-5],Cmaj7:[-21,-9,-5,-2,2],Am7:[-24,-12,-9,-5,-2],Gadd9:[-26,-14,-10,-7,-3],
} as const;
/** Ids double as i18n keys (track0…track3). */
export const TRACKS=['dawn','moon','bowls','rest'] as const;

export class SanctuaryAudio {
 private ctx:AudioContext|null=null;private master:GainNode|null=null;private noise:AudioBuffer|null=null;
 private layers:Partial<Record<LayerName,GainNode>>={};private stops:(()=>void)[]=[];private timers=new Set<number>();
 private musicBus:GainNode|null=null;private playing=false;private birding=false;private bar=0;private lastTrack=-1;
 private state:SoundState={on:false,music:false,lake:false,alpha:false,volume:0.7,track:0};

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
  this.layer('music',next.music);this.layer('lake',next.lake);this.layer('alpha',next.alpha);
 }

 /** Singing-bowl strike: inharmonic partials with a long tail. */
 bowl(){this.strike(note(-12),[[1,0.07],[2.76,0.03],[5.4,0.014],[8.93,0.007]],7);}
 /** One soft chime, e.g. when a lantern is released. */
 chime(){this.strike(note(pick(PENTATONIC)),[[1,0.05],[2.01,0.012]],4);}

 async stop(){
  for(const id of this.timers)clearTimeout(id);this.timers.clear();
  for(const s of this.stops)s();this.stops=[];
  const ctx=this.ctx;this.ctx=null;this.master=null;this.musicBus=null;this.layers={};this.playing=this.birding=false;
  if(ctx)await ctx.close();
 }

 // ---------- graph ----------
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
  if(on&&name==='music'&&!this.playing){this.playing=true;this.later(()=>this.musicLoop(),300);}
  if(on&&name==='lake'&&!this.birding){this.birding=true;this.later(()=>this.birdLoop(),8000);}
 }
 private osc(ctx:AudioContext,freq:number,type:OscillatorType='sine'){const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;o.start();this.stops.push(()=>o.stop());return o;}
 private build:Record<LayerName,(ctx:AudioContext,out:GainNode)=>void>={
  music:(ctx,out)=>{
   // Soft room: a synthesized impulse response (decaying stereo noise) — no reverb file needed.
   const sr=ctx.sampleRate,len=Math.floor(sr*3.5),ir=ctx.createBuffer(2,len,sr);
   for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len)**3;}
   const verb=ctx.createConvolver();verb.buffer=ir;
   const bus=ctx.createGain(),tone=ctx.createBiquadFilter(),dry=ctx.createGain(),wet=ctx.createGain();
   tone.type='lowpass';tone.frequency.value=3200;dry.gain.value=0.75;wet.gain.value=0.5;
   bus.connect(tone);tone.connect(dry).connect(out);tone.connect(verb).connect(wet).connect(out);
   this.musicBus=bus;
  },
  lake:(ctx,out)=>{
   // Quiet water: brown noise low-passed hard, cutoff drifting slowly like small waves. No wind.
   const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=260;
   const lfo=ctx.createGain();lfo.gain.value=70;this.osc(ctx,0.09).connect(lfo).connect(lp.frequency);
   const s=ctx.createBufferSource();s.buffer=this.noise;s.loop=true;s.start();this.stops.push(()=>s.stop());
   s.connect(lp).connect(out);
  },
  alpha:(ctx,out)=>{
   // Binaural beat: 216 Hz in the left ear, 226 Hz in the right → a 10 Hz pulse perceived with headphones.
   const merger=ctx.createChannelMerger(2),g=ctx.createGain();g.gain.value=0.06;
   this.osc(ctx,note(-12)).connect(merger,0,0);this.osc(ctx,note(-12)+10).connect(merger,0,1);
   merger.connect(g).connect(out);
  },
 };

 // ---------- instruments (scheduled at an exact AudioContext time) ----------
 private env(t:number,peak:number,attack:number,hold:number,release:number,dest:AudioNode){
  const g=this.ctx!.createGain();g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(peak,t+attack);g.gain.setValueAtTime(peak,t+attack+hold);
  g.gain.exponentialRampToValueAtTime(0.0001,t+attack+hold+release);g.connect(dest);return g;
 }
 private voice(f:number,t:number,end:number,dest:AudioNode,type:OscillatorType='sine',gain=1){
  const o=this.ctx!.createOscillator(),g=this.ctx!.createGain();o.type=type;o.frequency.value=f;g.gain.value=gain;
  o.connect(g).connect(dest);o.start(t);o.stop(end);
 }
 /** Warm pad: each note is two slightly detuned sines, slow swell in and out. */
 private pad(chord:readonly number[],t:number,dur:number,level=0.03,attack=3,release=4){
  const ctx=this.ctx!,lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=900;lp.connect(this.musicBus!);
  const e=this.env(t,level,attack,Math.max(0,dur-attack),release,lp),end=t+dur+release+0.1;
  chord.forEach((s,i)=>{const f=note(s),w=i===0?0.8:1;this.voice(f*1.0015,t,end,e,'sine',w);this.voice(f*0.9985,t,end,e,'sine',w);});
 }
 /** Soft pluck, between a kalimba and a felt piano. */
 private pluck(semi:number,t:number,level=0.05,decay=3){
  const e=this.env(t,level,0.012,0,decay,this.musicBus!),f=note(semi),end=t+decay+0.1;
  this.voice(f,t,end,e);this.voice(f*2,t,end,e,'sine',0.22);this.voice(f*3,t,end,e,'sine',0.06);
 }
 private strike(f:number,partials:number[][],decay:number,dest?:AudioNode,at?:number){
  const ctx=this.ctx;if(!ctx||!this.master||!this.state.on||ctx.state!=='running')return;
  const t=at??ctx.currentTime,pan=ctx.createStereoPanner();pan.pan.value=rand(-0.6,0.6);pan.connect(dest??this.master);
  const e=this.env(t,1,0.015,0,decay,pan);
  for(const [ratio,level] of partials)this.voice(f*ratio,t,t+decay+0.1,e,'sine',level);
 }

 // ---------- the four pieces; each step schedules one bar and returns its length in seconds ----------
 private pieces:Record<(typeof TRACKS)[number],(t:number,bar:number)=>number>={
  // Lotus Dawn: warm pad progression with sparse pentatonic chimes.
  dawn:(t,bar)=>{
   const chord=[C.Am,C.F,C.C,C.G][bar%4];this.pad(chord,t,10.5,0.028);
   for(let i=0,n=1+Math.floor(Math.random()*2);i<n;i++)this.strike(note(pick(PENTATONIC)),[[1,0.035],[2.01,0.008]],5,this.musicBus!,t+rand(1,9));
   return 10;
  },
  // Moon over Water: quiet pad under a slow, wandering arpeggio of soft plucks.
  moon:(t,bar)=>{
   const chord=[C.Am,C.Em,C.F,C.C][bar%4];this.pad(chord,t,10,0.016,2.5,4);
   const tones=chord.slice(1).flatMap(s=>[s+12,s+24]);
   for(let i=0;i<8;i++)if(Math.random()>0.28)this.pluck(pick(tones),t+i*1.2+rand(0,0.05),rand(0.03,0.05),3.2);
   return 9.6;
  },
  // Singing Bowls: long overlapping bowl tails over a faint drone.
  bowls:(t,bar)=>{
   if(bar%3===0)this.pad([-24,-17],t,20,0.02,6,8);
   const f=note(pick([-24,-17,-12,-7,-5]));
   this.strike(f,[[1,0.11],[2.76,0.045],[5.4,0.018],[8.93,0.007]],11,this.musicBus!,t);
   return rand(6,10);
  },
  // Deep Rest: very slow open chords, nothing else.
  rest:(t,bar)=>{this.pad([C.Fmaj7,C.Cmaj7,C.Am7,C.Gadd9][bar%4],t,16,0.034,5,7);return 16;},
 };
 private musicLoop(){
  const ctx=this.ctx;if(!ctx||!this.state.on||!this.state.music||!this.musicBus){this.playing=false;return;}
  if(this.state.track!==this.lastTrack){this.lastTrack=this.state.track;this.bar=0;}
  const piece=this.pieces[TRACKS[this.state.track]??'dawn'];
  const seconds=ctx.state==='running'?piece(ctx.currentTime+0.05,this.bar++):2;
  this.later(()=>this.musicLoop(),seconds*1000);
 }
 private birdLoop(){
  const ctx=this.ctx;if(!ctx||!this.state.on||!this.state.lake){this.birding=false;return;}
  if(ctx.state==='running'){
   const t=ctx.currentTime,pan=ctx.createStereoPanner();pan.pan.value=rand(-0.8,0.8);pan.connect(this.layers.lake!);
   const calls=2+Math.floor(Math.random()*2),base=rand(2400,3100);
   for(let i=0;i<calls;i++){const s=t+i*0.16,o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.setValueAtTime(base,s);o.frequency.exponentialRampToValueAtTime(base*1.45,s+0.08);
    g.gain.setValueAtTime(0.0001,s);g.gain.exponentialRampToValueAtTime(0.05,s+0.02);g.gain.exponentialRampToValueAtTime(0.0001,s+0.11);
    o.connect(g).connect(pan);o.start(s);o.stop(s+0.12);}
  }
  this.later(()=>this.birdLoop(),rand(10000,24000));
 }
}
