export type Point = {x:number;z:number};
export const WALK_LIMIT = 16;
export const LAKE_RADIUS = 8.8;
// Pavilion stands back from the shore (inner edge ≈10.5) so a lakeside path always remains.
export const PAVILION = {x:-13.14, z:-2.63, r:2.9};
export function clampWalkPosition(p:Point):Point {
 const d=Math.hypot(p.x,p.z); const radius=Math.max(0, Math.min(d, WALK_LIMIT));
 let x=d ? p.x*radius/d : 0; let z=d ? p.z*radius/d : 0;
 // Keep the avatar on the lakeside perimeter, not under water.
 const water=Math.hypot(x,z);
 if(water < LAKE_RADIUS+0.8) { const angle=water > 0.01?Math.atan2(z,x):Math.PI/2; x=Math.cos(angle)*(LAKE_RADIUS+0.8);z=Math.sin(angle)*(LAKE_RADIUS+0.8); }
 // Walk around the pavilion, not through its pillars.
 const px=x-PAVILION.x, pz=z-PAVILION.z, pd=Math.hypot(px,pz);
 if(pd < PAVILION.r) { const k=pd > 0.01?PAVILION.r/pd:1; x=PAVILION.x+(pd > 0.01?px*k:PAVILION.r); z=PAVILION.z+(pd > 0.01?pz*k:0); }
 const out=Math.hypot(x,z); if(out > WALK_LIMIT) { x*=WALK_LIMIT/out; z*=WALK_LIMIT/out; }
 return {x,z};
}
export function formatTime(seconds:number):string { const s=Math.max(0,Math.floor(seconds));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
export function createLantern(index:number, timestamp:number){ const angle=index*2.399963229728653; const radius=1.8+Math.sqrt(index%60)*0.67; return {id:`lantern-${timestamp}-${index}`,x:Math.cos(angle)*radius,z:Math.sin(angle)*radius,born:timestamp}; }
// Random wanderer names: indices into the per-language adjective/noun lists (src/locales/*.json).
export const NAME_COUNT = 16;
export function randomName(rand:()=>number=Math.random):[number,number] { return [Math.floor(rand()*NAME_COUNT), Math.floor(rand()*NAME_COUNT)]; }
export function isValidName(n:unknown):n is [number,number] { return Array.isArray(n) && n.length===2 && n.every(i=>Number.isInteger(i) && i>=0 && i<NAME_COUNT); }
export function clamp(v:number, min:number, max:number):number { return Math.min(max, Math.max(min, v)); }
// Frame-rate independent smoothing.
export function damp(current:number, target:number, lambda:number, dt:number):number { return target+(current-target)*Math.exp(-lambda*dt); }
export function dampAngle(current:number, target:number, lambda:number, dt:number):number { const diff=Math.atan2(Math.sin(target-current),Math.cos(target-current)); return current+diff*(1-Math.exp(-lambda*dt)); }
// Camera sits at player + (sin yaw, cos yaw) * distance; "forward" walks away from the camera.
export function cameraRelativeStep(yaw:number, forward:number, strafe:number):Point { return {x:-Math.sin(yaw)*forward+Math.cos(yaw)*strafe, z:-Math.cos(yaw)*forward-Math.sin(yaw)*strafe}; }
