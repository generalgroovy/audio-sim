import test from 'node:test';
import assert from 'node:assert/strict';
import { preset } from '../src/model.js';
import { projection } from '../src/projection.js';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≉ ${b}`);
test('screen-to-world dragging round-trips all heights in 2D and 3D', () => {
  for (const mode of ['2d', '3d']) for (const yaw of [-179, -90, 0, 45, 179]) for (const pitch of [18, 48, 82]) {
    const s = preset(); s.settings.mode = mode; s.view.yaw = yaw; s.view.pitch = pitch; s.view.panX = 77; s.view.panY = -40;
    const p = projection(s, 1000, 750);
    for (const point of [{ x: -3.2, y: 0, z: -1.7 }, { x: 2.6, y: 2.4, z: 2.2 }]) { const screen = p.project(point), world = p.unproject(screen.x, screen.y, point.y); near(world.x, point.x); near(world.y, point.y); near(world.z, point.z); }
  }
});
test('orthographic sound-map projection is affine', () => { const s = preset(); s.settings.mode = '3d'; const p = projection(s, 900, 600), a = p.project({ x: 0, y: 1.2, z: 0 }), b = p.project({ x: 2, y: 1.2, z: 4 }), mid = p.project({ x: 1, y: 1.2, z: 2 }); near(mid.x, (a.x + b.x) / 2); near(mid.y, (a.y + b.y) / 2); });
test('default fit contains room corners across desktop and mobile dimensions', () => { for (const [w, h] of [[1100, 700], [390, 440]]) for (const mode of ['2d', '3d']) { const s = preset(); s.settings.mode = mode; const p = projection(s, w, h); for (const v of s.room.vertices) for (const y of [0, s.room.height]) { const at = p.project({ ...v, y }); assert.ok(at.x >= 0 && at.x <= w); assert.ok(at.y >= 0 && at.y <= h); } } });
