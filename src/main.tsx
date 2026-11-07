import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Volume2,VolumeX,Flame,Flower2,Footprints,Pause,Play,Settings2,X,Info,Move,SunMoon,Users,Shuffle,Music,SkipForward} from 'lucide-react';
import World,{type Lantern} from './World';
import {clampWalkPosition,createLantern,formatTime,randomName,type Point} from './logic';
import {SanctuaryAudio,TRACKS,type SoundState} from './audio';
import {LANGS,detectLang,formatName,translate,type Lang} from './i18n';
import {Realtime,type Name,type NetStatus,type Peer} from './net';
import './style.css';

// Random spot on the lakeside path so wanderers do not appear stacked on one another.
const START:Point=clampWalkPosition((a=>({x:Math.cos(a)*11,z:Math.sin(a)*11}))(Math.random()*Math.PI*2));
// Shared lake is optional. Dev defaults to the local server; production needs VITE_REALTIME_URL (see .env.example).
const REALTIME_URL:string|undefined=import.meta.env.VITE_REALTIME_URL||(import.meta.env.DEV?`ws://${location.hostname}:8787`:undefined);
const LANG_KEY='nirvana.lang';
const readLang=():Lang=>{try{const v=localStorage.getItem(LANG_KEY);if(v&&(LANGS as string[]).includes(v))return v as Lang;}catch{/* storage blocked */}return detectLang(navigator.languages??[navigator.language]);};
const languageName=(code:Lang)=>{try{return new Intl.DisplayNames([code],{type:'language'}).of(code)??code;}catch{return code;}};

function LanguageSelect({lang,setLang,label}:{lang:Lang;setLang:(l:Lang)=>void;label:string}){
 return <label className="lang"><span>{label}</span><select value={lang} onChange={e=>setLang(e.target.value as Lang)}>{LANGS.map(c=><option key={c} value={c}>{languageName(c)}</option>)}</select></label>;
}

function App(){
 const [lang,setLangState]=useState<Lang>(readLang),[name,setName]=useState<Name>(()=>randomName());
 const [entered,setEntered]=useState(false),[localLanterns,setLocalLanterns]=useState<Lantern[]>([]),[sharedLanterns,setSharedLanterns]=useState<Lantern[]>([]),[sitting,setSitting]=useState(false),[duration,setDuration]=useState(180),[remaining,setRemaining]=useState(180),[running,setRunning]=useState(false),[snd,setSnd]=useState<SoundState>({on:false,music:true,lake:false,alpha:false,volume:0.7,track:0}),[settings,setSettings]=useState(false),[help,setHelp]=useState(false),[low,setLow]=useState(false),[reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false),[message,setMessage]=useState(''),[mobileDirection,setMobileDirection]=useState<Point>({x:0,z:0});
 const [share,setShare]=useState(false),[status,setStatus]=useState<NetStatus>('off'),[peerIds,setPeerIds]=useState<string[]>([]);
 const t=useCallback((k:string,v?:Record<string,string|number>)=>translate(lang,k,v),[lang]);
 const tRef=useRef(t);tRef.current=t;
 const audio=useRef(new SanctuaryAudio());const released=useRef(0);
 const net=useRef<Realtime|null>(null);
 if(REALTIME_URL&&!net.current)net.current=new Realtime(REALTIME_URL,{
  status:setStatus,peers:setPeerIds,lanterns:setSharedLanterns,
  lantern:l=>setSharedLanterns(ls=>[...ls.slice(-39),l]),
  notice:code=>{if(code==='slow')setMessage(tRef.current('msgSlow'));},
 });
 const online=share&&status==='online',lanterns=online?sharedLanterns:localLanterns;
 const webgl=useMemo(()=>{try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}},[]);

 const setLang=(l:Lang)=>{setLangState(l);try{localStorage.setItem(LANG_KEY,l);}catch{/* storage blocked */}};
 useEffect(()=>{document.documentElement.lang=lang;document.title=`NIRVANA — ${t('zone').toLowerCase().replace(/^\p{L}/u,c=>c.toUpperCase())}`;},[lang,t]);
 useEffect(()=>()=>{void audio.current.stop();net.current?.disconnect();},[]);
 useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;setHelp(false);setSettings(false);setSitting(false);setRunning(false);};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[]);
 useEffect(()=>{if(!running)return;const timer=window.setInterval(()=>setRemaining(r=>{if(r<=1){setRunning(false);audio.current.bowl();setMessage(tRef.current('msgDone'));return 0;}return r-1;}),1000);return()=>clearInterval(timer)},[running]);
 useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),4200);return()=>clearTimeout(id)},[message]);
 // Shared lake: connect only when the visitor opts in.
 useEffect(()=>{const n=net.current;if(!n)return;if(share)n.connect(name);else n.disconnect();},[share]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(share)net.current?.rename(name);},[name]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(share&&status==='offline')setMessage(tRef.current('msgOffline'));},[share,status]);

 const release=()=>{
  if(online)net.current?.releaseLantern();
  else{const lantern=createLantern(released.current++,Date.now());setLocalLanterns(l=>[...l.slice(-39),lantern]);}
  audio.current.chime();setMessage(t('msgLight'));
 };
 const sound=snd.on;
 // Applied inside the click handler so the first start counts as a user gesture (autoplay policy).
 const applySound=(patch:Partial<SoundState>)=>{const next={...snd,...patch};setSnd(next);audio.current.set(next).then(()=>{if(patch.on)audio.current.chime();}).catch(()=>{setSnd(s=>({...s,on:false}));setMessage(t('msgNoAudio'));});};
 const toggleAudio=()=>applySound({on:!sound});
 const beginSit=()=>{setSitting(true);setRemaining(duration);setRunning(false);setMessage(t('msgSit'));};
 const exitSit=()=>{setSitting(false);setRunning(false);setRemaining(duration)};
 const progress=useMemo(()=>Math.max(0,Math.min(100,(duration-remaining)/duration*100)),[duration,remaining]);
 const myName=formatName(lang,name);
 const peerName=useCallback((p:Peer)=>formatName(lang,p.name),[lang]);
 const onPose=useCallback((x:number,z:number,f:number,s:boolean)=>net.current?.sendPose(x,z,f,s),[]);
 const statusText=!share?t('solo'):status==='online'?(peerIds.length?t('shared',{count:peerIds.length}):t('solo')):status==='connecting'?t('connecting'):t('solo');
 const dir=(x:number,z:number)=>({onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);setMobileDirection({x,z});},onPointerUp:()=>setMobileDirection({x:0,z:0}),onPointerCancel:()=>setMobileDirection({x:0,z:0}),onContextMenu:(e:React.MouseEvent)=>e.preventDefault()});

 // Shown under the actions and inside the sitting panel, so music stays reachable while sitting.
 const musicControl=!sound?<button className="music-link" onClick={()=>applySound({on:true,music:true})}><Music size={13}/> {t('musicLink')}</button>
   :snd.music&&<div className="now-playing"><Music size={13}/> {t(`track${snd.track}`)}<button className="link" onClick={()=>applySound({track:(snd.track+1)%TRACKS.length})} aria-label={t('nextTrack')} title={t('nextTrack')}><SkipForward size={12}/></button></div>;
 return <main className="app">
 <div className="world" aria-label={t('aWorld')}>{webgl?<World start={START} lanterns={lanterns} sitting={sitting} intro={!entered} reduced={reduced} low={low} mobileDirection={mobileDirection} onLakeClick={()=>setMessage(t('msgWater'))} myName={myName} peers={net.current?.peers??EMPTY} peerIds={online?peerIds:NONE} peerName={peerName} onPose={online?onPose:undefined}/>:<div className="no-webgl"><p>{t('noWebgl')}</p></div>}</div>
 <div className="vignette" aria-hidden="true"/>
 {!entered?<div className="welcome"><div className="welcome-content"><div className="symbol">✿</div><p className="eyebrow">{t('eyebrow')}</p><h1>NIRVANA</h1><p className="subhead">{t('subtitle')}</p><div className="line"/><p className="intro">{t('intro1')}<br/>{t('intro2')}</p><button className="primary" onClick={()=>setEntered(true)}>{t('enter')} <span>↗</span></button><p className="tiny">{t('disclaimer')}</p><LanguageSelect lang={lang} setLang={setLang} label={t('language')}/></div></div>:<>
 <header className="topbar"><div className="brand"><span className="brandmark">✿</span><span>NIRVANA <small>{t('zone')}</small></span></div><div className="topactions">
  {net.current&&<button aria-label={share?t('aShareOff'):t('aShareOn')} aria-pressed={share} title={t('share')} className={share?'on':''} onClick={()=>setShare(s=>!s)}><Users size={18}/></button>}
  <button aria-label={sound?t('aSoundOff'):t('aSoundOn')} title={t('sound')} onClick={toggleAudio}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button aria-label={t('aHelp')} onClick={()=>setHelp(true)}><Info size={18}/></button><button aria-label={t('aSettings')} onClick={()=>setSettings(true)}><Settings2 size={18}/></button></div></header>
 <aside className="leftnote"><span className="eyebrow">{t('zone')}</span><h2>{t('beHere')}<br/><em>{t('forAWhile')}</em></h2><p>{t('gently')}</p></aside>
 <div className="bottom">
  {musicControl}
  <div className="whoami">{t('youAre',{name:myName})}<button className="link" onClick={()=>setName(randomName())} aria-label={t('newName')} title={t('newName')}><Shuffle size={13}/></button></div>
  <div className="coords" aria-live="polite"><span className={`status-dot ${online?'live':''}`}/> {statusText} <span className="separator">·</span> {t('lights',{count:lanterns.length})}</div>
  <div className="actionbar"><button onClick={release}><Flame size={19}/><span>{t('release')}</span></button><button onClick={beginSit} disabled={sitting}><Flower2 size={19}/><span>{t('sit')}</span></button><button onClick={()=>setHelp(true)}><Footprints size={19}/><span>{t('explore')}</span></button></div>
  <p className="footnote">{t('footnote')}</p></div>
 <div className="mobile-controls" aria-label={t('aMove')}><div className="dpad"><button aria-label={t('aFwd')} {...dir(0,-1)}>↑</button><div><button aria-label={t('aLeft')} {...dir(-1,0)}>←</button><button aria-label={t('aBack')} {...dir(0,1)}>↓</button><button aria-label={t('aRight')} {...dir(1,0)}>→</button></div></div></div>
 {message&&<div className="toast" role="status">{message}</div>}
 {sitting&&<div className="modal-backdrop sit"><section className="meditation" role="dialog" aria-modal="true" aria-label={t('sitEyebrow')}><button className="close" onClick={exitSit} aria-label={t('aClose')}><X/></button><div className="meditation-icon">✿</div><p className="eyebrow">{t('sitEyebrow')}</p><div className="sit-music">{musicControl}</div><h2>{t('sitTitle')}</h2><p>{t('sitBody')}</p><div className="clock" aria-live="off">{formatTime(remaining)}</div><div className="progress"><div style={{width:`${progress}%`}}/></div><div className="durations">{[180,300,600].map(n=><button key={n} className={duration===n?'selected':''} onClick={()=>{setDuration(n);setRemaining(n);setRunning(false)}}>{t('minutes',{count:n/60})}</button>)}</div><div className="med-actions"><button className="primary" onClick={()=>{setRunning(!running);if(!running)audio.current.bowl()}}>{running?<Pause size={17}/>:<Play size={17}/>} {running?t('pause'):t('begin')}</button><button className="quiet" onClick={exitSit}>{t('leave')}</button></div></section></div>}
 {settings&&<div className="modal-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-label={t('aSettings')}><button className="close" onClick={()=>setSettings(false)} aria-label={t('aClose')}><X/></button><SunMoon size={24}/><h2>{t('settingsTitle')}</h2>
  <LanguageSelect lang={lang} setLang={setLang} label={t('language')}/>
  <label className="toggle"><span>{t('low')}<small>{t('lowHint')}</small></span><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/></label>
  <label className="toggle"><span>{t('reduced')}<small>{t('reducedHint')}</small></span><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/></label>
  <label className="toggle"><span>{t('sound')}<small>{t('soundHint')}</small></span><input type="checkbox" checked={sound} onChange={toggleAudio}/></label>
  <label className="toggle"><span>{t('music')}<small>{t('musicHint')}</small></span><input type="checkbox" checked={sound&&snd.music} onChange={e=>applySound({music:e.target.checked,on:e.target.checked||sound})}/></label>
  <label className="toggle"><span>{t('track')}</span><select className="track-select" value={snd.track} onChange={e=>applySound({track:Number(e.target.value),music:true,on:true})}>{TRACKS.map((_,i)=><option key={i} value={i}>{t(`track${i}`)}</option>)}</select></label>
  <label className="toggle"><span>{t('lake')}<small>{t('lakeHint')}</small></span><input type="checkbox" checked={sound&&snd.lake} onChange={e=>applySound({lake:e.target.checked,on:e.target.checked||sound})}/></label>
  <label className="toggle"><span>{t('alpha')}<small>{t('alphaHint')}</small></span><input type="checkbox" checked={sound&&snd.alpha} onChange={e=>applySound({alpha:e.target.checked,on:e.target.checked||sound})}/></label>
  <label className="toggle"><span>{t('volume')}</span><input type="range" className="volume" min={0} max={1} step={0.05} value={snd.volume} disabled={!sound} onChange={e=>applySound({volume:Number(e.target.value)})}/></label>
  {net.current&&<label className="toggle"><span>{t('share')}<small>{t('shareHint')}</small></span><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)}/></label>}
  <p className="fine">{t('privacy')}</p></section></div>}
 {help&&<div className="modal-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-label={t('helpTitle')}><button className="close" onClick={()=>setHelp(false)} aria-label={t('aClose')}><X/></button><Move size={24}/><h2>{t('helpTitle')}</h2><p>{t('helpBody')}</p>
  {[['hWalkKey','hWalk'],['hLookKey','hLook'],['hZoomKey','hZoom'],['hTapKey','hTap'],['release','hLight'],['sit','hSit'],['hMobileKey','hMobile'],...(net.current?[['hShareKey','hShare']]:[])].map(([k,v])=><div className="help-row" key={k}><strong>{t(k)}</strong><span>{t(v)}</span></div>)}
  <button className="primary" onClick={()=>setHelp(false)}>{t('return')}</button></section></div>}
 </>}
 </main>;
}
const EMPTY=new Map<string,Peer>(),NONE:string[]=[];
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
