import {useEffect,useLayoutEffect,useMemo,useRef,type MutableRefObject} from 'react';
import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {Sky,Sparkles,MeshReflectorMaterial,Html} from '@react-three/drei';
import * as THREE from 'three';
import type {Peer} from './net';
import {cameraRelativeStep,clamp,clampWalkPosition,damp,dampAngle,LAKE_RADIUS,PAVILION,type Point} from './logic';

export type Lantern={id:string;x:number;z:number;born:number};
type Props={start:Point;lanterns:Lantern[];sitting:boolean;intro:boolean;reduced:boolean;low:boolean;mobileDirection:Point;onLakeClick:()=>void;
 myName:string;peers:Map<string,Peer>;peerIds:string[];peerName:(p:Peer)=>string;onPose?:(x:number,z:number,f:number,s:boolean)=>void};
type Ref<T>=MutableRefObject<T>;
type Ripple={x:number;z:number;t:number};

// ---------- shared geometry & scratch objects ----------
const tmpV=new THREE.Vector3(),tmpS=new THREE.Vector3(),tmpQ=new THREE.Quaternion(),tmpE=new THREE.Euler(),tmpM=new THREE.Matrix4(),lotusM=new THREE.Matrix4();
/** Euler order YXZ: spin around Y first, then tilt — what petals and reeds need. */
function compose(out:THREE.Matrix4,x:number,y:number,z:number,rx:number,ry:number,rz:number,sx:number,sy:number,sz:number){return out.compose(tmpV.set(x,y,z),tmpQ.setFromEuler(tmpE.set(rx,ry,rz,'YXZ')),tmpS.set(sx,sy,sz));}
const PETAL_GEO=new THREE.LatheGeometry([[0,0],[0.45,0.22],[0.5,0.52],[0.32,0.82],[0,1]].map(([x,y])=>new THREE.Vector2(x,y)),8);
const PAD_GEO=new THREE.CircleGeometry(0.5,20,0.28,Math.PI*2-0.28).rotateX(-Math.PI/2);
const BUD_GEO=new THREE.SphereGeometry(1,10,8);
const REED_GEO=new THREE.ConeGeometry(0.035,1,4).translate(0,0.5,0);
const PETAL_COLORS=['#f5a8bd','#f2c7d2','#fff0df','#e4a1bb'].map(c=>new THREE.Color(c));
const WHITE=new THREE.Color('#fff7f0');
const PETALS=[
 ...Array.from({length:8},(_,i)=>({a:i/8*Math.PI*2,tilt:1.05,len:0.46,w:0.3,inner:false})),
 ...Array.from({length:6},(_,i)=>({a:(i+0.5)/6*Math.PI*2,tilt:0.42,len:0.38,w:0.26,inner:true})),
].map(p=>({inner:p.inner,m:compose(new THREE.Matrix4(),Math.sin(p.a)*0.05,0.03,Math.cos(p.a)*0.05,p.tilt,p.a,0,p.w,p.len,0.1)}));

// ---------- lotus field: three instanced meshes instead of ~1000 draw calls ----------
function LotusField({count,reduced}:{count:number;reduced:boolean}){
 const lotuses=useMemo(()=>Array.from({length:count},(_,i)=>{const a=i*2.3999632297,r=1.4+Math.sqrt(i/count)*6.9;return {x:Math.sin(a)*r,z:Math.cos(a)*r,s:0.55+(i%4)*0.1,phase:i*1.7,bloom:i%3!==2,color:i%4};}),[count]);
 const blooms=lotuses.filter(l=>l.bloom).length;
 const pads=useRef<THREE.InstancedMesh>(null),petals=useRef<THREE.InstancedMesh>(null),buds=useRef<THREE.InstancedMesh>(null);
 useLayoutEffect(()=>{const p=petals.current;if(!p)return;let n=0;
  lotuses.forEach(l=>{if(l.bloom)PETALS.forEach(pt=>p.setColorAt(n++,pt.inner?PETAL_COLORS[l.color].clone().lerp(WHITE,0.45):PETAL_COLORS[l.color]));});
  if(p.instanceColor)p.instanceColor.needsUpdate=true;},[lotuses]);
 useFrame(({clock})=>{const pd=pads.current,pt=petals.current,bd=buds.current;if(!pd||!pt||!bd)return;
  const t=reduced?0:clock.elapsedTime;let n=0,b=0;
  lotuses.forEach((l,i)=>{
   compose(lotusM,l.x,0.03+Math.sin(t*0.7+l.phase)*0.025,l.z,Math.sin(t*0.5+l.phase)*0.03,l.phase+Math.sin(t*0.15+l.phase)*0.12,0,l.s,l.s,l.s);
   pd.setMatrixAt(i,lotusM);
   if(!l.bloom)return;
   PETALS.forEach(p=>pt.setMatrixAt(n++,tmpM.multiplyMatrices(lotusM,p.m)));
   bd.setMatrixAt(b++,tmpM.multiplyMatrices(lotusM,compose(tmpM,0,0.17,0,0,0,0,0.1,0.08,0.1)));
  });
  pd.instanceMatrix.needsUpdate=pt.instanceMatrix.needsUpdate=bd.instanceMatrix.needsUpdate=true;
 });
 return <group key={count}>
  <instancedMesh ref={pads} args={[PAD_GEO,undefined,count]} receiveShadow><meshStandardMaterial color="#2b7066" roughness={0.6} side={THREE.DoubleSide}/></instancedMesh>
  <instancedMesh ref={petals} args={[PETAL_GEO,undefined,blooms*PETALS.length]}><meshStandardMaterial roughness={0.55} side={THREE.DoubleSide} emissive="#5a2a35" emissiveIntensity={0.15}/></instancedMesh>
  <instancedMesh ref={buds} args={[BUD_GEO,undefined,blooms]}><meshStandardMaterial color="#f7d789" emissive="#9e743b" emissiveIntensity={0.35}/></instancedMesh>
 </group>;
}

// ---------- reeds swaying along the shore ----------
function Reeds({count,reduced}:{count:number;reduced:boolean}){
 const ref=useRef<THREE.InstancedMesh>(null);
 const reeds=useMemo(()=>Array.from({length:count},(_,i)=>{const cluster=Math.floor(i/7),a=cluster*0.83+(i%7)*0.045,r=LAKE_RADIUS-0.35+((i*37)%10)/10*0.7;return {x:Math.sin(a)*r,z:Math.cos(a)*r,h:0.7+((i*53)%10)/10*0.9,phase:i*0.9};}),[count]);
 useFrame(({clock})=>{const m=ref.current;if(!m)return;const t=reduced?0:clock.elapsedTime;
  reeds.forEach((r,i)=>m.setMatrixAt(i,compose(tmpM,r.x,-0.05,r.z,Math.sin(t*1.1+r.phase)*0.07,r.phase,Math.cos(t*0.9+r.phase)*0.05,1,r.h,1)));
  m.instanceMatrix.needsUpdate=true;});
 return <instancedMesh key={count} ref={ref} args={[REED_GEO,undefined,count]}><meshStandardMaterial color="#5f7d4a" roughness={0.9}/></instancedMesh>;
}

// ---------- water ripples (lake taps, landing lanterns) ----------
function Ripples({list}:{list:Ref<Ripple[]>}){
 const refs=useRef<(THREE.Mesh|null)[]>([]);
 useFrame(({clock})=>{refs.current.forEach((m,i)=>{if(!m)return;const r=list.current[i],age=r?clock.elapsedTime-r.t:99;
  m.visible=age<3.2;if(!m.visible||!r)return;m.position.set(r.x,0.015,r.z);m.scale.setScalar(0.3+age*1.1);(m.material as THREE.MeshBasicMaterial).opacity=(1-age/3.2)*0.55;});});
 return <>{Array.from({length:6},(_,i)=><mesh key={i} ref={m=>{refs.current[i]=m}} rotation-x={-Math.PI/2} visible={false}><ringGeometry args={[0.92,1,48]}/><meshBasicMaterial color="#e9f5ef" transparent depthWrite={false}/></mesh>)}</>;
}

// ---------- lanterns: emissive + additive glow, no per-lantern lights (avoids shader recompiles) ----------
function LanternMesh({lantern,index,reduced}:{lantern:Lantern;index:number;reduced:boolean}){
 const ref=useRef<THREE.Group>(null);
 useFrame(({clock})=>{const g=ref.current;if(!g)return;
  const grow=reduced?1:clamp((Date.now()-lantern.born)/1600,0,1),e=1-Math.pow(1-grow,3),m=reduced?0:1,t=clock.elapsedTime;
  g.position.set(lantern.x+Math.sin(t*0.13+index)*0.25*m,0.16+(1-e)*1.1+Math.sin(t*0.8+index)*0.05*m,lantern.z+Math.cos(t*0.11+index)*0.25*m);
  g.scale.setScalar(Math.max(0.001,e));g.rotation.y=index+t*0.1*m;});
 return <group ref={ref} position={[lantern.x,0.16,lantern.z]}>
  <mesh position={[0,-0.02,0]}><cylinderGeometry args={[0.28,0.28,0.04,8]}/><meshStandardMaterial color="#6b4f37"/></mesh>
  <mesh position={[0,0.16,0]}><cylinderGeometry args={[0.2,0.25,0.32,8,1,true]}/><meshStandardMaterial color="#f6d8a1" emissive="#ef9f4d" emissiveIntensity={1.1} side={THREE.DoubleSide} transparent opacity={0.92}/></mesh>
  <mesh position={[0,0.34,0]}><coneGeometry args={[0.24,0.12,8]}/><meshStandardMaterial color="#6b4f37"/></mesh>
  <mesh position={[0,0.13,0]}><sphereGeometry args={[0.06,8,8]}/><meshBasicMaterial color="#fff2b4"/></mesh>
  <mesh position={[0,0.16,0]} scale={0.62}><sphereGeometry args={[1,12,10]}/><meshBasicMaterial color="#ffb867" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false}/></mesh>
 </group>;
}

function Pavilion(){return <group position={[PAVILION.x,0,PAVILION.z]} rotation={[0,0.6,0]}>
 <mesh position={[0,0.3,0]} castShadow receiveShadow><cylinderGeometry args={[2.35,2.55,0.6,8]}/><meshStandardMaterial color="#78634f"/></mesh>
 {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <mesh key={i} position={[Math.cos(a)*1.9,1.65,Math.sin(a)*1.9]} castShadow><cylinderGeometry args={[0.12,0.16,2.9,8]}/><meshStandardMaterial color="#80674e"/></mesh>})}
 <mesh position={[0,3.15,0]} castShadow><coneGeometry args={[3.4,1.5,8]}/><meshStandardMaterial color="#284e4d" roughness={0.85}/></mesh>
 <mesh position={[0,2.5,0]}><cylinderGeometry args={[2.6,2.8,0.22,8]}/><meshStandardMaterial color="#ad8960"/></mesh>
 <mesh position={[0,2.1,0]}><sphereGeometry args={[0.16,10,8]}/><meshStandardMaterial color="#f6d8a1" emissive="#ef9f4d" emissiveIntensity={1.2}/></mesh>
 </group>}
// Trees right next to the camera are hidden so a trunk never fills the screen.
function Tree({x,z,s}:{x:number;z:number;s:number}){const ref=useRef<THREE.Group>(null);useFrame(({camera})=>{if(ref.current)ref.current.visible=Math.hypot(camera.position.x-x,camera.position.z-z)>2.4*s;});return <group ref={ref} position={[x,0,z]} scale={s}><mesh position={[0,1.1,0]} castShadow><cylinderGeometry args={[0.12,0.24,2.2,6]}/><meshStandardMaterial color="#4a433c"/></mesh><mesh position={[0,2.65,0]} castShadow><coneGeometry args={[1.2,3.2,7]}/><meshStandardMaterial color="#1e4945" flatShading/></mesh><mesh position={[0,3.6,0]} castShadow><coneGeometry args={[0.82,2.2,7]}/><meshStandardMaterial color="#315e52" flatShading/></mesh></group>}

// ---------- the traveler: procedural rig with walk, idle, breathing and seated pose ----------
// Abstract, genderless figure: matte porcelain, no face or hair; a thin sage scarf hints at the front.
const BODY=new THREE.MeshStandardMaterial({color:'#ece4d6',roughness:0.45});
const ACCENT=new THREE.MeshStandardMaterial({color:'#8fa89a',roughness:0.8});
// Other wanderers: cooler, slightly translucent, so "you" stays easy to spot.
const GHOST=new THREE.MeshStandardMaterial({color:'#d4e3dd',roughness:0.5,transparent:true,opacity:0.8});
const GHOST_ACCENT=new THREE.MeshStandardMaterial({color:'#c9a77a',roughness:0.8,transparent:true,opacity:0.8});
const arm=(ref:Ref<THREE.Group|null>,side:number,mat:THREE.Material)=><group ref={ref} position={[side*0.17,1.36,0]}>
 <mesh position-y={-0.22} castShadow material={mat}><capsuleGeometry args={[0.045,0.36,4,8]}/></mesh>
</group>;
type TravelerProps={pos:Ref<Point>;facing:Ref<number>;speed:Ref<number>;sitting:Ref<boolean>;reduced:boolean;label:string;ghost?:boolean};
function Traveler({pos,facing,speed,sitting:sitting_,reduced,label,ghost=false}:TravelerProps){
 const mat=ghost?GHOST:BODY,accent=ghost?GHOST_ACCENT:ACCENT;
 const root=useRef<THREE.Group>(null),body=useRef<THREE.Group>(null),chest=useRef<THREE.Group>(null),head=useRef<THREE.Group>(null),armL=useRef<THREE.Group>(null),armR=useRef<THREE.Group>(null),skirt=useRef<THREE.Mesh>(null),legs=useRef<THREE.Group>(null);
 const sit=useRef(0),phase=useRef(0);
 useFrame(({clock},delta)=>{
  const r=root.current,b=body.current,c=chest.current,h=head.current,al=armL.current,ar=armR.current,sk=skirt.current,lg=legs.current;
  if(!r||!b||!c||!h||!al||!ar||!sk||!lg)return;
  const dt=Math.min(delta,0.05),t=clock.elapsedTime,m=reduced?0:1,sitting=sitting_.current;
  sit.current=reduced?(sitting?1:0):damp(sit.current,sitting?1:0,2.5,dt);
  const s=sit.current,v=speed.current*(1-s);
  phase.current+=dt*8*v;
  const swing=Math.sin(phase.current)*v*m,breath=Math.sin(t*(sitting?0.7:1.5))*m;
  r.position.set(pos.current.x,-0.03,pos.current.z);r.rotation.y=facing.current;
  b.position.y=-0.55*s+Math.abs(Math.cos(phase.current))*0.05*v*m;
  b.rotation.set(0.1*v,0,swing*0.05);
  c.scale.set(1+breath*0.012,1+breath*0.022,1+breath*0.012);
  h.rotation.set(s*0.2-0.05*v,m*(1-s)*(1-v)*Math.sin(t*0.3)*0.3,0);
  al.rotation.set(swing*0.6-s*0.7,0,0.1-s*0.45);ar.rotation.set(-swing*0.6-s*0.7,0,-(0.1-s*0.45));
  sk.scale.set(1+0.45*s,1-0.55*s,1+0.45*s);sk.position.y=0.5*(1-0.55*s);sk.rotation.z=swing*0.04;
  lg.visible=s>0.02;lg.scale.setScalar(Math.max(0.001,s));
 });
 return <group ref={root} scale={0.9}>
  <mesh rotation-x={-Math.PI/2} position-y={0.02}><circleGeometry args={[0.38,20]}/><meshBasicMaterial color="#102a26" transparent opacity={0.28} depthWrite={false}/></mesh>
  <mesh ref={skirt} castShadow material={mat}><cylinderGeometry args={[0.15,0.3,1,16]}/></mesh>
  <group ref={legs} position-y={0.1}>{[-1,1].map(k=><mesh key={k} rotation={[0,k*0.35,Math.PI/2]} position={[0,0,0.1]} material={mat}><capsuleGeometry args={[0.08,0.4,4,8]}/></mesh>)}</group>
  <group ref={body}>
   <group ref={chest} position-y={1}>
    <mesh position-y={0.21} castShadow material={mat}><cylinderGeometry args={[0.12,0.15,0.42,16]}/></mesh>
    <mesh position-y={0.4} rotation-x={Math.PI/2} material={accent}><torusGeometry args={[0.115,0.028,8,20]}/></mesh>
   </group>
   <group ref={head} position-y={1.44}>
    <mesh position-y={0.15} scale={[1,1.12,1]} castShadow material={mat}><sphereGeometry args={[0.15,20,16]}/></mesh>
   </group>
   {arm(armL,1,mat)}{arm(armR,-1,mat)}
  </group>
  <Html position={[0,2.15,0]} center zIndexRange={[1,0]} className={ghost?'name-tag ghost':'name-tag'}>{label}</Html>
 </group>;
}

/** Another wanderer: eases toward the latest server pose; speed is inferred for the walk cycle. */
function RemoteTraveler({peer,label,reduced}:{peer:Peer;label:string;reduced:boolean}){
 const pos=useRef<Point>({x:peer.x,z:peer.z}),facing=useRef(peer.f),speed=useRef(0),sitting=useRef(peer.s);
 useFrame((_,delta)=>{const dt=Math.max(1e-3,Math.min(delta,0.05)),p=pos.current;
  const x=damp(p.x,peer.x,8,dt),z=damp(p.z,peer.z,8,dt),v=Math.hypot(x-p.x,z-p.z)/dt/3.2;
  pos.current={x,z};speed.current=damp(speed.current,Math.min(1,v),8,dt);
  facing.current=dampAngle(facing.current,peer.f,8,dt);sitting.current=peer.s;});
 return <Traveler pos={pos} facing={facing} speed={speed} sitting={sitting} reduced={reduced} label={label} ghost/>;
}

// ---------- scene, input and third-person camera ----------
function Scene({start,lanterns,sitting,intro,reduced,low,mobileDirection,onLakeClick,myName,peers,peerIds,peerName,onPose}:Props){
 const sitRef=useRef(sitting);sitRef.current=sitting;
 const {camera,gl,clock}=useThree();
 const keys=useRef(new Set<string>());
 const pos=useRef<Point>({...start}),facing=useRef(Math.atan2(-start.x,-start.z)),speed=useRef(0),dir=useRef<Point>({x:0,z:0});
 const orbit=useRef({yaw:Math.atan2(start.x,start.z),pitch:0.38,dist:7.5}); // user intent
 const view=useRef({...orbit.current});                                      // smoothed camera
 const focus=useRef(new THREE.Vector3(start.x,1.2,start.z)),focusTarget=useRef(new THREE.Vector3());
 const ripples=useRef<Ripple[]>([]);
 const spawnRipple=(x:number,z:number)=>{if(!reduced)ripples.current=[...ripples.current.slice(-5),{x,z,t:clock.elapsedTime}];};

 useEffect(()=>{
  const ignore=(e:KeyboardEvent)=>['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName);
  const down=(e:KeyboardEvent)=>{if(ignore(e))return;const k=e.key.toLowerCase();keys.current.add(k);if(k.startsWith('arrow'))e.preventDefault();};
  const up=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
  const blur=()=>keys.current.clear();
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
 },[]);

 // Drag to look around, wheel / pinch to zoom.
 useEffect(()=>{
  const el=gl.domElement,pts=new Map<number,{x:number;y:number}>();let pinch=0;
  const down=(e:PointerEvent)=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});};
  const move=(e:PointerEvent)=>{const p=pts.get(e.pointerId);if(!p)return;const o=orbit.current;
   if(pts.size===1){o.yaw-=(e.clientX-p.x)*0.006;o.pitch=clamp(o.pitch+(e.clientY-p.y)*0.004,0.1,1.15);}
   pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch&&d)o.dist=clamp(o.dist*pinch/d,3.5,14);pinch=d;}};
  const up=(e:PointerEvent)=>{pts.delete(e.pointerId);pinch=0;};
  const wheel=(e:WheelEvent)=>{e.preventDefault();orbit.current.dist=clamp(orbit.current.dist*(1+e.deltaY*0.001),3.5,14);};
  el.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});
  return()=>{el.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);};
 },[gl]);

 const lastLantern=useRef(lanterns.at(-1)?.id);
 useEffect(()=>{const l=lanterns.at(-1);if(l&&l.id!==lastLantern.current){lastLantern.current=l.id;spawnRipple(l.x,l.z);}},[lanterns]); // eslint-disable-line react-hooks/exhaustive-deps

 useFrame((state,delta)=>{
  const dt=Math.min(delta,0.05),k=keys.current,o=orbit.current,v=view.current,p=pos.current;
  o.yaw+=((k.has('e')?1:0)-(k.has('q')?1:0))*dt*1.6;
  if(intro&&!reduced)o.yaw+=dt*0.06;
  // movement, relative to where the camera looks
  const f=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0)-mobileDirection.z;
  const s=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0)+mobileDirection.x;
  const walking=!sitting&&!intro&&(f!==0||s!==0);
  if(walking){const m=Math.hypot(f,s);dir.current=cameraRelativeStep(v.yaw,f/m,s/m);}
  speed.current=damp(speed.current,walking?1:0,walking?6:9,dt);
  if(speed.current>0.005)pos.current=clampWalkPosition({x:p.x+dir.current.x*3.2*speed.current*dt,z:p.z+dir.current.z*3.2*speed.current*dt});
  const q=pos.current,outward=Math.atan2(q.x,q.z);
  if(sitting)facing.current=dampAngle(facing.current,outward+Math.PI,3,dt);
  else if(walking)facing.current=dampAngle(facing.current,Math.atan2(dir.current.x,dir.current.z),10,dt);
  // camera: follow orbit; while sitting, ease into a wide, slow view over the lake
  const lambda=reduced?30:sitting?1.2:8;
  v.yaw=dampAngle(v.yaw,sitting?outward+(reduced?0:Math.sin(state.clock.elapsedTime*0.05)*0.3):o.yaw,lambda,dt);
  v.pitch=damp(v.pitch,sitting?0.42:o.pitch,lambda,dt);
  v.dist=damp(v.dist,sitting?9:o.dist,lambda,dt);
  if(sitting)o.yaw=v.yaw;
  const ahead=sitting?2.8:0;
  // A low focus point while sitting lifts the traveler above the timer panel.
  focusTarget.current.set(q.x-Math.sin(outward)*ahead,sitting?-1.2:1.2,q.z-Math.cos(outward)*ahead);
  focus.current.lerp(focusTarget.current,reduced?1:1-Math.exp(-6*dt));
  const fc=focus.current;
  // Stay inside the forest edge: if there is no room behind, crane up instead of pushing in.
  const sx=Math.sin(v.yaw),sz=Math.cos(v.yaw),b=fc.x*sx+fc.z*sz,c=fc.x*fc.x+fc.z*fc.z-24*24;
  const h=Math.min(Math.cos(v.pitch)*v.dist,Math.max(0.5,-b+Math.sqrt(Math.max(0,b*b-c))));
  if(!intro)onPose?.(q.x,q.z,facing.current,sitting);
  camera.position.set(fc.x+sx*h,fc.y+Math.sin(v.pitch)*v.dist,fc.z+sz*h);camera.lookAt(fc);
 });

 const lakeClick=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta>6)return;spawnRipple(e.point.x,e.point.z);onLakeClick();};
 const trees=useMemo(()=>Array.from({length:low?18:38},(_,i)=>{const a=i*2.3999632297;const r=17+(i%5)*1.9;return {x:Math.sin(a)*r,z:Math.cos(a)*r,s:0.8+(i%4)*0.2};}),[low]);
 const stones=useMemo(()=>Array.from({length:16},(_,i)=>{const a=i*0.41+(i%3)*0.9;return {x:Math.sin(a)*9.1,z:Math.cos(a)*9.1,s:0.12+(i%4)*0.06,r:i};}),[]);
 return <>
  <color attach="background" args={['#a3c4bb']}/><fog attach="fog" args={['#a3c4bb',24,70]}/>
  <ambientLight intensity={0.7} color="#d9e7df"/><hemisphereLight intensity={0.85} color="#fff1dc" groundColor="#4d6556"/>
  <directionalLight position={[-9,18,-12]} intensity={2.2} color="#ffe2ad" castShadow={!low} shadow-mapSize={[1024,1024]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-far={60} shadow-bias={-0.0005}/>
  <Sky sunPosition={[-15,4,-20]} turbidity={8} rayleigh={2} mieCoefficient={0.02}/>
  <mesh rotation-x={-Math.PI/2} position-y={-0.06} receiveShadow><circleGeometry args={[85,96]}/><meshStandardMaterial color="#537467" roughness={1}/></mesh>
  <mesh rotation-x={-Math.PI/2} position-y={-0.03} receiveShadow><ringGeometry args={[8.95,10.3,96]}/><meshStandardMaterial color="#b3a88a" roughness={1}/></mesh>
  <mesh rotation-x={-Math.PI/2} onClick={lakeClick}><circleGeometry args={[8.95,80]}/>
   {low?<meshStandardMaterial color="#357b7d" roughness={0.25} metalness={0.2}/>
       :<MeshReflectorMaterial blur={[200,60]} resolution={512} mixBlur={0.8} mixStrength={1.6} mirror={0.6} roughness={0.6} depthScale={0.4} minDepthThreshold={0.4} maxDepthThreshold={1.2} color="#2f6f72" metalness={0.3}/>}
  </mesh>
  <Ripples list={ripples}/>
  <LotusField count={low?36:80} reduced={reduced}/>
  <Reeds count={low?49:140} reduced={reduced}/>
  {stones.map(st=><mesh key={st.r} position={[st.x,0,st.z]} rotation={[st.r,st.r*2,0]} scale={[st.s*1.4,st.s,st.s]} castShadow><dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color="#8a8a7c" roughness={1} flatShading/></mesh>)}
  {trees.map((t,i)=><Tree key={i} {...t}/>)}
  <Pavilion/>
  <Traveler pos={pos} facing={facing} speed={speed} sitting={sitRef} reduced={reduced} label={myName}/>
  {peerIds.map(id=>{const p=peers.get(id);return p&&<RemoteTraveler key={id} peer={p} label={peerName(p)} reduced={reduced}/>;})}
  {lanterns.map((l,i)=><LanternMesh key={l.id} lantern={l} index={i} reduced={reduced}/>)}
  {!low&&<Sparkles count={70} scale={[30,4,30]} position={[0,1.6,0]} size={2.5} speed={reduced?0:0.25} color="#ffe7b0" opacity={0.7}/>}
 </>;
}
export default function World(props:Props){return <Canvas dpr={[1,props.low?1:1.6]} gl={{antialias:!props.low,powerPreference:'high-performance'}} camera={{position:[13,5,13],fov:55,near:0.1,far:200}} shadows={!props.low}><Scene {...props}/></Canvas>}
