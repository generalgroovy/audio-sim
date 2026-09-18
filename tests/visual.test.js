import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldColor, FIELD_RAMP, fieldContours, sourceColor, sourceInk, frequencyLabel, INK } from '../src/visual.js';
import { preset } from '../src/model.js';
import { computeField } from '../src/acoustics.js';
const grid = values => ({ nx: 2, nz: 2, minX: -1, minZ: -1, width: 2, depth: 2, values: new Float32Array(values) });
const luminance = hex => {
  const channels = hex.replace('#','').match(/../g).map(c => parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('field color scale clamps and reaches its advertised endpoint colors', () => {
  assert.deepEqual(fieldColor(-200), FIELD_RAMP[0]); assert.deepEqual(fieldColor(-60),FIELD_RAMP[0]);
  assert.deepEqual(fieldColor(0),FIELD_RAMP.at(-1)); assert.deepEqual(fieldColor(80),FIELD_RAMP.at(-1));
});
test('source colors and labels distinguish frequency bands without depending only on color', () => {
  const frequencies = [80,1000,5000,8000]; assert.equal(new Set(frequencies.map(frequency=>sourceColor({frequency}))).size,4);
  assert.equal(frequencyLabel(80),'80 Hz'); assert.equal(frequencyLabel(1234),'1.23 kHz'); assert.equal(frequencyLabel(8000),'8 kHz');
});
test('normal paper text and frequency inks meet a 4.5:1 contrast target', () => {
  for (const color of ['#263b3a','#566764','#185e51','#a6412e', ...[80,1000,5000,8000].map(frequency=>sourceInk({frequency}))])
    for (const paper of ['#f1efe6','#faf8f1']) assert.ok(contrast(color,paper)>=4.5,`${color} on ${paper}`);
});
test('stage text and active mode label have readable contrast', () => {
  for (const text of [INK.text,INK.muted,'#f1d294']) assert.ok(contrast(text,INK.background)>=4.5);
  assert.ok(contrast('#163a38','#e6eddb')>=4.5);
});
test('contours interpolate sample centres in world metres', () => {
  const result = fieldContours(grid([-30,-10,-30,-10]),[-20]);
  assert.equal(result[0].segments.length,1);
  for(const point of result[0].segments[0]) { assert.equal(point.x,0); assert.equal(Math.abs(point.z),.5); }
});
test('constant and fully masked fields create no invented contours', () => {
  for (const values of [[-20,-20,-20,-20],[NaN,NaN,NaN,NaN]]) assert.equal(fieldContours(grid(values),[-20])[0].segments.length,0);
});
test('partly masked cells cannot bridge across room boundaries', () => {
  assert.equal(fieldContours(grid([-30,-10,NaN,-10]),[-20])[0].segments.length,0);
});
test('all marching-square masks emit finite bounded geometry including saddle cases', () => {
  for(let mask=0; mask<16; mask++) {
    const v = [0,1,3,2].map(i => mask & (1<<i) ? 1 : -1);
    const segments=fieldContours(grid(v),[0])[0].segments;
    assert.equal(segments.length,mask===0||mask===15?0:mask===5||mask===10?2:1);
    for(const segment of segments) for(const point of segment) assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z)&&Math.abs(point.x)<=.5&&Math.abs(point.z)<=.5);
  }
});
test('contour extraction preserves the exact acoustic grid and is deterministic', () => {
  const field=computeField(preset()), before=new Float32Array(field.values);
  const a=fieldContours(field),b=fieldContours(field);
  assert.deepEqual(field.values,before); assert.deepEqual(a,b); assert.ok(a.some(group=>group.segments.length>0));
});
