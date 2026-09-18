import test from 'node:test';
import assert from 'node:assert/strict';
import { preset, speaker, insideRoom, distance, copy } from '../src/model.js';
import { dbToGain, absorption, directivity, pathGain, buildImages, reflectionHit, prepare, samplePower, pathsFor, computeField, createFieldJob, fieldKey, powerToDb } from '../src/acoustics.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
function directScene() { const s = preset('empty'); s.speakers = [speaker('1', 0, 0, 1000)]; s.speakers[0].level = 0; s.settings.reflections = false; return s; }
test('doubling distance gives half pressure and one quarter power', () => { const s = directScene(), p = prepare(s); near(samplePower(p, { x: 1, y: 1.2, z: 0 }), 1); near(samplePower(p, { x: 2, y: 1.2, z: 0 }), 0.25); near(powerToDb(0.25), -6.020599913); });
test('near-field singularity is bounded and finite', () => { const s = directScene(); near(samplePower(prepare(s), s.speakers[0]), 1); assert.ok(Number.isFinite(pathGain(s.speakers[0], s.speakers[0], 0))); });
test('amplitude dB conversion does not confuse pressure and energy', () => { near(dbToGain(-20), 0.1); const s = directScene(); s.speakers[0].level = -20; near(samplePower(prepare(s), { x: 1, y: 1.2, z: 0 }), 0.01); });
test('directivity matches cone orientation in three dimensions', () => { const s = speaker('1'); s.cone = 90; near(directivity(s, { x: 0, y: 1.2, z: -2 }), 1); near(directivity(s, { x: 0, y: 1.2, z: 2 }), 0.08); near(directivity(s, { x: 0, y: 3.2, z: 0 }), 0.08); s.cone = 360; near(directivity(s, { x: 0, y: 1.2, z: 2 }), 1); });
test('material absorption interpolates monotonically in log frequency', () => { near(absorption('mixed', 125), 0.12); near(absorption('mixed', 1000), 0.28); near(absorption('mixed', 8000), 0.45); assert.ok(absorption('mixed', 500) > 0.12); assert.ok(absorption('mixed', 500) < 0.28); });
test('one rectangular source has four wall images plus floor and ceiling', () => { const s = preset(); const images = buildImages(s.speakers[0], s.room); assert.equal(images.length, 6); near(images[4].y, -s.speakers[0].y); near(images[5].y, s.room.height * 2 - s.speakers[0].y); });
test('every reflection hits a finite surface and keeps both legs inside', () => {
  const s = preset(); s.room.vertices = [{ x: -5, z: -4 }, { x: 4, z: -3 }, { x: 5, z: 3 }, { x: -3, z: 4 }];
  for (const source of s.speakers) for (const path of pathsFor(source, s.listener, s)) {
    for (let i = 1; i < path.points.length; i++) for (let n = 0; n <= 10; n++) {
      const a = path.points[i - 1], b = path.points[i], t = n / 10;
      assert.ok(insideRoom({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, s.room, 1e-6));
    }
    if (path.kind !== 'direct') near(path.length, distance(source, path.points[1]) + distance(path.points[1], s.listener));
  }
});
test('reflection law: reflected incoming vector equals outgoing vector', () => {
  const s = preset(), source = s.speakers[0];
  for (const path of pathsFor(source, s.listener, s).filter(p => p.kind !== 'direct')) {
    const hit = path.points[1], a = distance(source, hit), b = distance(hit, s.listener);
    const incoming = { x: (hit.x - source.x) / a, y: (hit.y - source.y) / a, z: (hit.z - source.z) / a };
    const normal = path.kind === 'wall' ? { x: path.image.nx, y: 0, z: path.image.nz } : { x: 0, y: 1, z: 0 };
    const dot = incoming.x * normal.x + incoming.y * normal.y + incoming.z * normal.z;
    for (const axis of ['x', 'y', 'z']) near(incoming[axis] - 2 * dot * normal[axis], (s.listener[axis] - hit[axis]) / b);
  }
});
test('image intersections beyond the actual wall segment are rejected', () => { const s = preset(); const image = buildImages(s.speakers[0], s.room)[0]; image.a = { x: -5, z: -4 }; image.b = { x: -4.9, z: -4 }; assert.equal(reflectionHit(image, s.listener, s.room), null); });
test('invalid reflected paths outside room height are rejected', () => { const s = preset(), image = buildImages(s.speakers[0], s.room)[0]; assert.equal(reflectionHit(image, { x: 0, y: 100, z: 0 }, s.room), null); });
test('no direct or reflected field energy outside the closed room', () => { const s = preset(), p = prepare(s); for (const r of [{ x: 7, y: 1.2, z: 0 }, { x: 0, y: 7, z: 0 }, { x: 0, y: 1.2, z: -8 }]) { near(samplePower(p, r), 0); assert.deepEqual(pathsFor(s.speakers[0], r, s), []); } });
test('pressure reflection coefficient is sqrt(1 − energy absorption)', () => { const s = preset(); for (const image of buildImages(s.speakers[0], s.room)) { const material = image.kind === 'wall' ? s.room.wall : s.room[image.kind]; near(image.reflectivity ** 2, 1 - absorption(material, s.speakers[0].frequency)); } });
test('fully absorbing boundaries contribute no reflected paths or energy', () => { const s = directScene(), r = { x: 2, y: 1.2, z: 0 }; const direct = samplePower(prepare(s), r); s.settings.reflections = true; s.room.wall = s.room.floor = s.room.ceiling = 'absorbent'; near(samplePower(prepare(s), r), direct); assert.equal(pathsFor(s.speakers[0], r, s).length, 1); });
test('muted and empty scenes have no energy', () => { const s = preset(); s.speakers.forEach(s => { s.muted = true; }); near(samplePower(prepare(s), s.listener), 0); near(samplePower(prepare(preset('empty')), s.listener), 0); });
test('equal coherent tones in phase give four times single-source power', () => { const s = directScene(), r = { x: 2, y: 1.2, z: 0 }; s.settings.field = 'coherent'; const power = samplePower(prepare(s), r); s.speakers.push({ ...s.speakers[0], id: '2' }); near(samplePower(prepare(s), r), power * 4); });
test('equal coherent tones with opposite phase cancel', () => { const s = directScene(); s.settings.field = 'coherent'; s.speakers.push({ ...s.speakers[0], id: '2', phase: 180 }); assert.ok(samplePower(prepare(s), { x: 2, y: 1.2, z: 0 }) < 1e-20); });
test('different frequencies add energy and do not falsely cancel', () => { const s = directScene(); s.settings.field = 'coherent'; s.speakers.push({ ...s.speakers[0], id: '2', frequency: 2000, phase: 180 }); near(samplePower(prepare(s), { x: 2, y: 1.2, z: 0 }), 0.5); });
test('energy mode ignores source phase', () => { const s = directScene(); s.speakers.push({ ...s.speakers[0], id: '2', phase: 180 }); near(samplePower(prepare(s), { x: 2, y: 1.2, z: 0 }), 0.5); });
test('high frequencies trigger interference undersampling warning; energy does not', () => { const s = preset(); assert.equal(computeField(s).undersampled, false); s.settings.field = 'coherent'; assert.equal(computeField(s).undersampled, true); s.speakers = [speaker('1', 0, 0, 20)]; assert.equal(computeField(s).undersampled, false); });
test('2D/3D view and camera changes leave the acoustic map invariant', () => { const s = preset(), a = computeField(s), key = fieldKey(s); s.settings.mode = '3d'; s.view.yaw = 72; s.view.zoom = 2; s.listener.x = 1; s.selected = '3'; s.settings.master = -30; assert.equal(fieldKey(s), key); assert.deepEqual(computeField(s).values, a.values); });
test('height changes affect the 3D field in either view mode', () => { const s = directScene(); const a = computeField(s).values; s.speakers[0].y = 3; const b = computeField(s).values; assert.notDeepEqual(a, b); });
test('outside-polygon grid samples are explicitly masked', () => { const s = preset(); s.room.vertices = [{ x: -4, z: -3 }, { x: 4, z: -3 }, { x: 0, z: 4 }]; const f = computeField(s); assert.ok(f.values.some(Number.isNaN)); assert.ok(f.values.some(Number.isFinite)); });
test('chunked fallback and synchronous worker solver give identical samples', () => { const s = preset(), job = createFieldJob(s); let f = null, ticks = 0; while (!f) { f = job.step(4); ticks++; } assert.ok(ticks > 1); assert.deepEqual(f.values, computeField(s).values); });
test('optional air loss never amplifies a path', () => { const s = speaker('1', 0, 0, 8000), r = { x: 3, y: 1.2, z: 0 }; assert.ok(pathGain(s, r, 3, 1, 0.01) < pathGain(s, r, 3, 1, 0)); });
