// Pure scene data and convex-room geometry. Metres; +Y up; heading 0 faces -Z.
export const VERSION = 2;
export const MAX_SPEAKERS = 16;
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const radians = degrees => degrees * Math.PI / 180;
export const copy = value => JSON.parse(JSON.stringify(value));
export const heading = (yaw, pitch = 0) => ({ x: Math.sin(radians(yaw)) * Math.cos(radians(pitch)), y: Math.sin(radians(pitch)), z: -Math.cos(radians(yaw)) * Math.cos(radians(pitch)) });
// No roll: up stays orthogonal to forward, including at a ±90° vertical tilt.
export const listenerUp = (yaw, pitch = 0) => ({ x: -Math.sin(radians(yaw)) * Math.sin(radians(pitch)), y: Math.cos(radians(pitch)), z: Math.cos(radians(yaw)) * Math.sin(radians(pitch)) });
export const activeSources = scene => {
  const solo = scene.speakers.some(s => s.solo);
  return scene.speakers.filter(s => !s.muted && (!solo || s.solo));
};
export function snapCoordinate(value, step = 0) { return step > 0 ? +(Math.round(value / step) * step).toFixed(6) : value; }
export function placePoint(point, room, step = 0, axes = ['x', 'z']) {
  const placed = { ...point };
  for (const axis of axes) placed[axis] = snapCoordinate(point[axis], step);
  return constrainPoint(placed, room); // Boundary clearance takes priority over the grid.
}

export const distance = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
export const MATERIALS = Object.freeze({
  hard: { name: 'Hard / reflective', absorption: [0.04, 0.06, 0.08] },
  mixed: { name: 'Mixed / furnished', absorption: [0.12, 0.28, 0.45] },
  treated: { name: 'Soft / treated', absorption: [0.30, 0.65, 0.85] },
  absorbent: { name: 'Fully absorbing', absorption: [1, 1, 1] },
});
export const rectangle = (width = 10, depth = 8) => [
  { x: -width / 2, z: -depth / 2 }, { x: width / 2, z: -depth / 2 },
  { x: width / 2, z: depth / 2 }, { x: -width / 2, z: depth / 2 },
];
export function bounds(vertices) {
  const xs = vertices.map(p => p.x), zs = vertices.map(p => p.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}
export function signedArea(vertices) {
  return vertices.reduce((sum, a, i) => { const b = vertices[(i + 1) % vertices.length]; return sum + a.x * b.z - b.x * a.z; }, 0) / 2;
}
const cross = (a, b, p) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
export function validRoom(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 12) return false;
  if (vertices.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > 25 || Math.abs(p.z) > 25)) return false;
  if (signedArea(vertices) < 2) return false;
  // Every other vertex must lie strictly on the inside of each edge. This also rejects stars/self-intersections.
  return vertices.every((a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return Math.hypot(b.x - a.x, b.z - a.z) >= 0.5 && vertices.every((p, j) => j === i || j === (i + 1) % vertices.length || cross(a, b, p) > 1e-6);
  });
}
export function insideRoom(point, room, epsilon = 1e-7) {
  if (!(point.y >= -epsilon && point.y <= room.height + epsilon)) return false;
  for (let i = 0; i < room.vertices.length; i++) if (!(cross(room.vertices[i], room.vertices[(i + 1) % room.vertices.length], point) >= -epsilon)) return false;
  return true;
}
export function constrainPoint(point, room) {
  const out = { x: Number.isFinite(point.x) ? point.x : 0, y: clamp(Number.isFinite(point.y) ? point.y : 1.2, 0.1, room.height - 0.1), z: Number.isFinite(point.z) ? point.z : 0 };
  // Alternating projections onto the inset half-planes of a convex room.
  for (let pass = 0; pass < 48; pass++) {
    let corrected = false;
    room.vertices.forEach((a, i) => {
      const b = room.vertices[(i + 1) % room.vertices.length];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const d = cross(a, b, out) / len;
      if (d < 0.08) { out.x += -dz / len * (0.08 - d); out.z += dx / len * (0.08 - d); corrected = true; }
    });
    if (!corrected) break;
  }
  if (!insideRoom(out, room)) {
    out.x = room.vertices.reduce((s, p) => s + p.x, 0) / room.vertices.length;
    out.z = room.vertices.reduce((s, p) => s + p.z, 0) / room.vertices.length;
  }
  return out;
}
export function speaker(id, x = 0, z = 0, frequency = 440, name = `Speaker ${id}`) {
  return { id: String(id), name, x, y: 1.2, z, frequency, level: -12, yaw: 0, pitch: 0, cone: 360, phase: 0, muted: false, solo: false };
}
export function preset(name = 'reference') {
  const room = { vertices: rectangle(), height: 3.2, wall: 'mixed', floor: 'hard', ceiling: 'mixed', airLoss: 0 };
  let speakers = [speaker('1', -2, -1.6, 80, 'Low'), speaker('2', 2, -1.6, 1000, 'Mid'), speaker('3', -2, 1.6, 5000, 'High A'), speaker('4', 2, 1.6, 8000, 'High B')];
  if (name === 'stereo') speakers = [speaker('1', -2, -2, 440, 'Left'), speaker('2', 2, -2, 440, 'Right')].map(s => ({ ...s, yaw: 180, cone: 110 }));
  if (name === 'interference') speakers = [speaker('1', -1, 0, 80, 'Phase A'), { ...speaker('2', 1, 0, 80, 'Phase B'), phase: 180 }];
  if (name === 'empty') speakers = [];
  const surround = ['surround51', 'surround71', 'immersive'].includes(name);
  if (surround) {
    const layout = [['L', -30], ['R', 30], ['C', 0], ['Ls', -110], ['Rs', 110]];
    if (name !== 'surround51') layout.push(['Lr', -150], ['Rr', 150]);
    speakers = layout.map(([label, yaw], i) => {
      const v = heading(yaw);
      return { ...speaker(String(i + 1), v.x * 3, v.z * 3, 440, label), yaw: ((yaw + 360) % 360) - 180, cone: 110 };
    });
    speakers.push({ ...speaker(String(speakers.length + 1), 0.9, -2.5, 80, 'Sub'), y: 0.35 });
    if (name === 'immersive') for (const [label, x, z] of [['Top LF', -2, -1.8], ['Top RF', 2, -1.8], ['Top LR', -2, 1.8], ['Top RR', 2, 1.8]]) {
      speakers.push({ ...speaker(String(speakers.length + 1), x, z, 440, label), y: 2.8,
        yaw: Math.atan2(-x, z) * 180 / Math.PI, pitch: Math.atan2(1.2 - 2.8, Math.hypot(x, z)) * 180 / Math.PI, cone: 110 });
    }
  }
  return { version: VERSION, room, speakers, listener: { x: 0, y: 1.2, z: surround ? 0 : 2.8, yaw: 0, pitch: 0 }, selected: speakers[0]?.id ?? 'listener',
    settings: { mode: '2d', field: name === 'interference' ? 'coherent' : 'energy', reflections: name !== 'interference', slice: 1.2, quality: 'balanced', paths: true, animate: false, editRoom: false, master: -24, snap: 0 },
    view: { yaw: -32, pitch: 48, zoom: 1, panX: 0, panY: 0 } };
}
function numeric(value, fallback, min, max) { return clamp(typeof value === 'number' && Number.isFinite(value) ? value : fallback, min, max); }
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
export function normalizeScene(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== VERSION) throw new Error('Expected an Audio Sim version 2 scene.');
  if (!input.room || !validRoom(input.room.vertices)) throw new Error('Room outline must be a non-intersecting, counter-clockwise convex polygon (3–12 corners, area ≥ 2 m²).');
  if (!Array.isArray(input.speakers) || input.speakers.length > MAX_SPEAKERS) throw new Error(`A scene can contain at most ${MAX_SPEAKERS} speakers.`);
  const defaults = preset(), raw = input.room, materials = Object.keys(MATERIALS);
  const room = { vertices: raw.vertices.map(p => ({ x: p.x, z: p.z })), height: numeric(raw.height, 3.2, 1, 12), wall: choice(raw.wall, materials, 'mixed'), floor: choice(raw.floor, materials, 'hard'), ceiling: choice(raw.ceiling, materials, 'mixed'), airLoss: numeric(raw.airLoss, 0, 0, 0.1) };
  const used = new Set(['listener']);
  const speakers = input.speakers.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error('Each speaker must be an object.');
    let id = typeof s.id === 'string' && /^[\w-]{1,32}$/.test(s.id) ? s.id : `s${i + 1}`;
    const baseId = id; let suffix = 0;
    while (used.has(id)) id = `${baseId.slice(0, 20)}_${i}_${suffix++}`;
    used.add(id);
    const base = speaker(id), name = typeof s.name === 'string' ? s.name.trim().slice(0, 48) : base.name;
    return { ...base, id, name: name || base.name, ...constrainPoint(s, room), frequency: numeric(s.frequency, 440, 20, 16000), level: numeric(s.level, -12, -60, 0), yaw: numeric(s.yaw, 0, -180, 180), pitch: numeric(s.pitch, 0, -90, 90), cone: numeric(s.cone, 360, 20, 360), phase: numeric(s.phase, 0, 0, 360), muted: s.muted === true, solo: s.solo === true };
  });
  const listener = { ...constrainPoint(input.listener ?? defaults.listener, room), yaw: numeric(input.listener?.yaw, 0, -180, 180), pitch: numeric(input.listener?.pitch, 0, -90, 90) };
  const s = input.settings ?? {}, v = input.view ?? {};
  return { version: VERSION, room, speakers, listener, selected: used.has(input.selected) ? input.selected : 'listener',
    settings: { mode: choice(s.mode, ['2d', '3d'], '2d'), field: choice(s.field, ['energy', 'coherent', 'off'], 'energy'), reflections: s.reflections !== false, slice: numeric(s.slice, 1.2, 0.1, room.height - 0.1), quality: choice(s.quality, ['fast', 'balanced', 'fine'], 'balanced'), paths: s.paths !== false, animate: s.animate === true, editRoom: s.editRoom === true, master: numeric(s.master, -24, -60, -6), snap: choice(s.snap, [0, 0.1, 0.25, 0.5, 1], 0) },
    view: { yaw: numeric(v.yaw, -32, -180, 180), pitch: numeric(v.pitch, 48, 18, 82), zoom: numeric(v.zoom, 1, 0.4, 3), panX: numeric(v.panX, 0, -1200, 1200), panY: numeric(v.panY, 0, -1200, 1200) } };
}
export function resizeRoom(scene, width, depth, height) {
  const b = bounds(scene.room.vertices);
  const vertices = scene.room.vertices.map(p => ({ x: (p.x - (b.minX + b.maxX) / 2) * clamp(width, 0.5, 50) / b.width, z: (p.z - (b.minZ + b.maxZ) / 2) * clamp(depth, 0.5, 50) / b.depth }));
  if (!validRoom(vertices)) return false;
  scene.room.vertices = vertices; scene.room.height = clamp(height, 1, 12); constrainScene(scene); return true;
}
export function constrainScene(scene) {
  scene.speakers.forEach(s => Object.assign(s, constrainPoint(s, scene.room)));
  Object.assign(scene.listener, constrainPoint(scene.listener, scene.room));
  scene.settings.slice = clamp(scene.settings.slice, 0.1, scene.room.height - 0.1);
}
export class History {
  constructor(initial, limit = 60) { this.limit = limit; this.entries = [JSON.stringify(initial)]; this.index = 0; }
  push(state) {
    const next = JSON.stringify(state); if (next === this.entries[this.index]) return;
    this.entries.splice(this.index + 1); this.entries.push(next);
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo() { if (this.index > 0) return JSON.parse(this.entries[--this.index]); return null; }
  redo() { if (this.index + 1 < this.entries.length) return JSON.parse(this.entries[++this.index]); return null; }
}
