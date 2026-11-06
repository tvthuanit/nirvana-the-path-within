export class SanctuaryAudio {
 private ctx:AudioContext|null=null; private noise:AudioBufferSourceNode|null=null; private gain:GainNode|null=null;
 async start(){ if(this.ctx){await this.ctx.resume();return;} const ctx=new AudioContext(); this.ctx=ctx;
 const length=ctx.sampleRate*3;const buffer=ctx.createBuffer(1,length,ctx.sampleRate);const data=buffer.getChannelData(0);let last=0;
 for(let i=0;i<length;i++){last=(last+(Math.random()*2-1)*0.025)*0.995;data[i]=last*0.8;}
 const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
 const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=460;
 const gain=ctx.createGain();gain.gain.value=0.0001;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();gain.gain.setTargetAtTime(0.12,ctx.currentTime,2);this.noise=source;this.gain=gain;
 }
 bell(){if(!this.ctx)return;const ctx=this.ctx;[440,660,880].forEach((f,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(0.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.065/(i+1),ctx.currentTime+0.02);gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+3.2);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+3.3);});}
 async stop(){if(!this.ctx)return;const ctx=this.ctx;this.gain?.gain.setTargetAtTime(0.0001,ctx.currentTime,0.12);await new Promise(r=>setTimeout(r,350));this.noise?.stop();await ctx.close();this.ctx=null;this.noise=null;this.gain=null;}
}
