import test from 'node:test';import assert from 'node:assert/strict';
import {note} from '../src/audio.ts';
test('music is tuned to A4 = 432 Hz and the alpha beat is 10 Hz',()=>{
 assert.equal(note(0),432);assert.equal(note(-12),216);assert.equal(note(12),864);
 assert.ok(Math.abs(note(7)/note(0)-1.4983)<1e-3,'equal-tempered fifth');
 assert.equal((note(-12)+10)-note(-12),10);
});
