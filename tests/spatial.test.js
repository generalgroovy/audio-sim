import test from 'node:test';
import assert from 'node:assert/strict';
import { preset, speaker, normalizeScene, insideRoom, heading, listenerUp, activeSources, placePoint, snapCoordinate } from '../src/model.js';
import { directivity, prepare, samplePower, pathsFor, pathGain, acousticKey, fieldKey } from '../src/acoustics.js';
import { ProbeCache, reportPaths, pathsCSV } from '../src/analysis.js';
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≉ ${b}`);

test('listener orientation remains orthonormal for every yaw and vertical tilt', () => {
  for (const yaw of [-180, -90, 0, 35, 180]) for (const pitch of [-90, -45, 0, 45, 90]) {
    const f = heading(yaw, pitch), u = listenerUp(yaw, pitch);
    close(Math.hypot(f.x, f.y, f.z), 1); close(Math.hypot(u.x, u.y, u.z), 1);
    close(f.x * u.x + f.y * u.y + f.z * u.z, 0);
  }
});
test('pitched directional sources can aim directly down or up', () => {
  const source = { ...speaker('1'), y: 2.8, cone: 60, pitch: -90 };
  close(directivity(source, { x: 0, y: 1.2, z: 0 }), 1);
  close(directivity(source, { x: 0, y: 3.1, z: 0 }), 0.08);
  source.pitch = 90; close(directivity(source, { x: 0, y: 3.1, z: 0 }), 1);
});
test('compiled pitched solver agrees with explicit path-gain evaluation', () => {
  const scene = preset(); scene.settings.field = 'energy'; scene.speakers = [scene.speakers[0]];
  for (const pitch of [-90, -30, 25, 90]) {
    const source = scene.speakers[0]; source.pitch = pitch; source.cone = 110;
    const expected = pathsFor(source, scene.listener, scene).reduce((n, p) => n + p.gain ** 2, 0);
    close(samplePower(prepare(scene), scene.listener), expected);
  }
});
test('surround layout presets have valid source counts and aim at the receiver', () => {
  for (const [name, count] of [['surround51', 6], ['surround71', 8], ['immersive', 12]]) {
    const scene = preset(name); assert.equal(scene.speakers.length, count);
    assert.deepEqual(normalizeScene(scene), scene);
    assert.ok(scene.speakers.every(s => insideRoom(s, scene.room)));
    for (const source of scene.speakers) close(directivity(source, scene.listener), 1);
  }
});
test('7.1.4 layout has exactly four downward-aimed height sources', () => {
  const scene = preset('immersive'); const overhead = scene.speakers.filter(s => s.y > 2);
  assert.equal(overhead.length, 4); assert.ok(overhead.every(s => s.pitch < 0));
});
test('legacy version 2 imports gain default pitch, solo and snapping without loss', () => {
  const scene = preset();
  for (const s of scene.speakers) { delete s.pitch; delete s.solo; }
  delete scene.listener.pitch; delete scene.settings.snap;
  const n = normalizeScene(scene);
  assert.ok(n.speakers.every(s => s.pitch === 0 && s.solo === false));
  assert.equal(n.listener.pitch, 0); assert.equal(n.settings.snap, 0);
});
test('solo, multiple solo and mute precedence agree across paths and field', () => {
  const scene = preset(); scene.speakers[0].solo = true;
  assert.deepEqual(activeSources(scene).map(s => s.id), ['1']);
  assert.equal(prepare(scene).sources.length, 1);
  assert.deepEqual(pathsFor(scene.speakers[1], scene.listener, scene), []);
  scene.speakers[1].solo = true; assert.equal(activeSources(scene).length, 2);
  scene.speakers[0].muted = true; assert.deepEqual(activeSources(scene).map(s => s.id), ['2']);
  scene.speakers[1].muted = true; close(samplePower(prepare(scene), scene.listener), 0);
});
test('grid snapping is stable for positive and negative coordinates', () => {
  close(snapCoordinate(0.26, 0.25), 0.25); close(snapCoordinate(-0.38, 0.25), -0.5);
  close(snapCoordinate(0.126, 0), 0.126);
  const room = preset().room;
  const point = placePoint({ x: .34, y: 1.2, z: -.66 }, room, .25);
  assert.deepEqual(point, { x: .25, y: 1.2, z: -.75 });
  const height = placePoint({ x: .34, y: 1.63, z: -.66 }, room, .5, ['y']);
  assert.deepEqual(height, { x: .34, y: 1.5, z: -.66 });
});
test('boundary clearance takes precedence over snapped placement', () => {
  const room = preset().room;
  for (const n of [-99, -5, 5, 99]) assert.ok(insideRoom(placePoint({ x: n, y: n, z: n }, room, 1, ['x', 'y', 'z']), room));
});
test('probe reports match exact scalar power and sorted geometric path delays', () => {
  const scene = preset(), cache = new ProbeCache(), result = cache.get(scene);
  assert.equal(result.paths.length, 28); close(result.power, samplePower(prepare(scene), scene.listener));
  for (let i = 0; i < result.paths.length; i++) {
    close(result.paths[i].delay, result.paths[i].length / 343 * 1000);
    if (i) assert.ok(result.paths[i].delay >= result.paths[i - 1].delay);
  }
  assert.equal(reportPaths(result, '1').length, 7); assert.equal(reportPaths(result, 'listener').length, 28);
});
test('probe cache ignores camera, names, slice, quality, head tilt and master level', () => {
  const scene = preset(), cache = new ProbeCache(), result = cache.get(scene);
  scene.settings.mode = '3d'; scene.view.yaw = 40; scene.selected = '2';
  scene.settings.slice = 2; scene.settings.quality = 'fine'; scene.listener.pitch = -50;
  scene.listener.yaw = 75; scene.settings.master = -40; scene.speakers[0].name = 'Renamed';
  assert.equal(cache.get(scene), result); assert.equal(cache.computations, 1);
  scene.listener.x += .1; assert.notEqual(cache.get(scene), result); assert.equal(cache.computations, 2);
});
test('phase edits do not invalidate energy maps but do invalidate coherent maps', () => {
  const scene = preset(), energy = fieldKey(scene); scene.speakers[0].phase = 90;
  assert.equal(fieldKey(scene), energy); scene.settings.field = 'coherent'; const phase = fieldKey(scene);
  scene.speakers[0].phase = 180; assert.notEqual(fieldKey(scene), phase);
});
test('source tilt invalidates field cache; receiver tilt and snap do not', () => {
  const scene = preset(), before = fieldKey(scene);
  scene.listener.pitch = 90; scene.settings.snap = .5; assert.equal(fieldKey(scene), before);
  scene.speakers[0].pitch = 20; assert.notEqual(fieldKey(scene), before);
});
test('old probe snapshots are not mutated by later scene edits', () => {
  const scene = preset(), cache = new ProbeCache(), result = cache.get(scene), json = JSON.stringify(result);
  scene.speakers[0].x += 1; cache.get(scene); assert.equal(JSON.stringify(result), json);
});
test('CSV protects user names against formulas and quotes without altering numeric values', () => {
  const scene = preset(); scene.speakers[0].name = '=HYPERLINK("x")';
  const result = new ProbeCache().get(scene), csv = pathsCSV(scene, reportPaths(result, '1'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.equal(csv.trim().split('\r\n').length, 8);
  assert.ok(csv.split('\r\n')[1].endsWith(result.paths.find(p => p.sourceId === '1').gainDb.toFixed(6)));
});
test('empty and muted probes have no invented arrivals or non-finite rows', () => {
  const scene = preset('empty'), result = new ProbeCache().get(scene);
  assert.deepEqual(result, { power: 0, paths: [] }); assert.equal(pathsCSV(scene, []).trim().split('\n').length, 1);
});
