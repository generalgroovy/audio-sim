import test from 'node:test';
import assert from 'node:assert/strict';
import { preset, rectangle, validRoom, insideRoom, constrainPoint, normalizeScene, resizeRoom, copy, signedArea, heading, History } from '../src/model.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
test('reference has one low, one mid, two high speakers at a common relative level', () => { const s = preset(); assert.deepEqual(s.speakers.map(p => p.frequency), [80, 1000, 5000, 8000]); assert.ok(s.speakers.every(p => p.level === -12)); });
test('all built-in presets validate and round-trip without shared references', () => { for (const name of ['reference', 'stereo', 'interference', 'empty']) { const p = preset(name); assert.deepEqual(normalizeScene(copy(p)), p); } const a = preset(), b = preset(); a.speakers[0].x = 22; assert.notEqual(a.speakers[0].x, b.speakers[0].x); });
test('rectangle area and coordinate convention', () => { near(signedArea(rectangle(10, 8)), 80); assert.deepEqual(heading(0), { x: 0, y: 0, z: -1 }); near(heading(90).x, 1); });
test('room validator rejects crossed, concave, reversed, degenerate and star polygons', () => {
  const r = rectangle(); assert.ok(validRoom(r)); assert.equal(validRoom([r[0], r[2], r[1], r[3]]), false); assert.equal(validRoom([...r].reverse()), false);
  assert.equal(validRoom([r[0], { x: 0, z: 0 }, r[2], r[3]]), false); assert.equal(validRoom([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }]), false);
  const pentagon = Array.from({ length: 5 }, (_, i) => ({ x: Math.cos(i * Math.PI * 2 / 5) * 4, z: Math.sin(i * Math.PI * 2 / 5) * 4 }));
  assert.ok(validRoom(pentagon)); assert.equal(validRoom([0, 2, 4, 1, 3].map(i => pentagon[i])), false);
});
test('convex imported outlines with 3–12 sides are accepted', () => { for (let n = 3; n <= 12; n++) assert.ok(validRoom(Array.from({ length: n }, (_, i) => ({ x: 5 * Math.cos(i * Math.PI * 2 / n), z: 4 * Math.sin(i * Math.PI * 2 / n) })))); });
test('room validator rejects NaN, infinity and huge coordinates', () => { for (const n of [NaN, Infinity, -Infinity, 26]) { const r = rectangle(); r[0].x = n; assert.equal(validRoom(r), false); } });
test('points respect the floor, ceiling and polygon boundary', () => { const room = preset().room; assert.ok(insideRoom({ x: 0, y: 0, z: 0 }, room)); for (const p of [{ x: 9, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 9, z: 0 }]) assert.equal(insideRoom(p, room), false); });
test('constraining keeps arbitrarily displaced points inside convex rooms', () => {
  const room = preset().room; room.vertices = [{ x: -4, z: -3 }, { x: 4, z: -2 }, { x: 3, z: 4 }, { x: -3, z: 3 }];
  for (let x = -30; x <= 30; x += 3) for (let z = -30; z <= 30; z += 3) assert.ok(insideRoom(constrainPoint({ x, y: 99, z }, room), room));
});
test('room resize keeps sources, listener and slice inside', () => { const s = preset(); assert.ok(resizeRoom(s, 2, 2, 1)); assert.ok([...s.speakers, s.listener].every(p => insideRoom(p, s.room))); near(s.settings.slice, 0.9); });
test('import only keeps known fields and clamps numerical controls', () => {
  const s = preset(); s.speakers[0].frequency = Infinity; s.speakers[0].x = 5000; s.speakers[0].level = 100; s.settings.master = 0; s.extra = 'discard'; s.room.injected = true;
  const result = normalizeScene(s); assert.equal(result.speakers[0].frequency, 440); assert.equal(result.speakers[0].level, 0); assert.equal(result.settings.master, -6); assert.ok(insideRoom(result.speakers[0], result.room)); assert.equal(result.extra, undefined); assert.equal(result.room.injected, undefined);
});
test('import rejects incompatible schema and too many sources', () => { for (const s of [null, [], {}, { version: 1 }]) assert.throws(() => normalizeScene(s)); const s = preset(); s.speakers = Array(17).fill(s.speakers[0]); assert.throws(() => normalizeScene(s), /at most 16/); });
test('duplicate IDs are repaired and untrusted names remain plain data', () => { const s = preset(); s.speakers[1].id = s.speakers[0].id; s.speakers[0].name = '<img src=x onerror=alert(1)>'; const n = normalizeScene(s); assert.equal(new Set(n.speakers.map(s => s.id)).size, 4); assert.equal(n.speakers[0].name, s.speakers[0].name); });
test('history supports undo, redo, deduplication and branching with bounded storage', () => { const h = new History({ x: 0 }, 3); h.push({ x: 1 }); h.push({ x: 1 }); h.push({ x: 2 }); h.push({ x: 3 }); assert.equal(h.entries.length, 3); assert.deepEqual(h.undo(), { x: 2 }); assert.deepEqual(h.redo(), { x: 3 }); h.undo(); h.push({ x: 8 }); assert.equal(h.redo(), null); assert.deepEqual(h.undo(), { x: 2 }); });

test('speaker IDs cannot collide with the reserved listener selector', () => { const s = preset(); s.speakers[0].id = 'listener'; s.selected = 'listener'; const n = normalizeScene(s); assert.notEqual(n.speakers[0].id, 'listener'); assert.equal(n.selected, 'listener'); });
test('full coordinate-range rooms round-trip through resize without silent shrinking', () => { const s = preset(); s.room.vertices = rectangle(50, 40); const before = copy(s.room.vertices); assert.ok(resizeRoom(s, 50, 40, 3.2)); assert.deepEqual(s.room.vertices, before); });
