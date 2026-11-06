import test from 'node:test';import assert from 'node:assert/strict';
// Node 22.18+ runs the TypeScript module directly (type stripping): the same file the browser and server use.
import * as m from '../src/logic.ts';
test('random names stay inside the shared word lists',()=>{for(let i=0;i<200;i++)assert.ok(m.isValidName(m.randomName()));assert.deepEqual(m.randomName(()=>0.999),[15,15]);assert.ok(!m.isValidName([16,0]));assert.ok(!m.isValidName([1.5,0]));assert.ok(!m.isValidName('x'))});
test('timer formatting',()=>{assert.equal(m.formatTime(180),'03:00');assert.equal(m.formatTime(0),'00:00');assert.equal(m.formatTime(-5),'00:00')});
test('movement stays outside lake',()=>{const p=m.clampWalkPosition({x:0,z:0});assert.ok(Math.hypot(p.x,p.z)>=9.59)});
test('movement respects world boundary',()=>{const p=m.clampWalkPosition({x:100,z:100});assert.ok(Math.hypot(p.x,p.z)<=16.001)});
test('lanterns have finite positions and unique ids',()=>{const a=m.createLantern(1,123),b=m.createLantern(2,123);assert.notEqual(a.id,b.id);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z))});
test('forward walks away from the camera',()=>{const a=m.cameraRelativeStep(0,1,0);assert.ok(a.z<-0.99);const r=m.cameraRelativeStep(0,0,1);assert.ok(r.x>0.99);const b=m.cameraRelativeStep(Math.PI/2,1,0);assert.ok(b.x<-0.99)});
test('damping converges and angles take the short way',()=>{assert.ok(Math.abs(m.damp(0,10,8,1)-10)<0.01);const a=m.dampAngle(3.1,-3.1,1000,1);assert.ok(Math.abs(Math.atan2(Math.sin(a+3.1),Math.cos(a+3.1)))<1e-6)});
test('avatar cannot walk into the pavilion',()=>{const p=m.clampWalkPosition({x:m.PAVILION.x,z:m.PAVILION.z+0.5});assert.ok(Math.hypot(p.x-m.PAVILION.x,p.z-m.PAVILION.z)>=m.PAVILION.r-1e-9)});
test('pushing out of the pavilion never lands in the lake or past the edge',()=>{const d=Math.hypot(m.PAVILION.x,m.PAVILION.z);for(let r=9;r<=17;r+=0.25)for(let da=-0.4;da<=0.4;da+=0.05){const a=Math.atan2(m.PAVILION.z,m.PAVILION.x)+da;const p=m.clampWalkPosition({x:Math.cos(a)*r,z:Math.sin(a)*r});const o=Math.hypot(p.x,p.z);assert.ok(o>=m.LAKE_RADIUS+0.8-1e-9&&o<=m.WALK_LIMIT+1e-9,`r=${r} da=${da} -> ${o}`)}assert.ok(d-m.PAVILION.r>m.LAKE_RADIUS+0.8)});
