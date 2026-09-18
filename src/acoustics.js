import { MATERIALS, bounds, insideRoom, heading, distance, radians, clamp, TAU, activeSources } from './model.js';
export const SPEED_OF_SOUND = 343; // Fixed educational model, metres/second.
export const dbToGain = db => 10 ** (db / 20);
export const powerToDb = power => power > 1e-20 ? 10 * Math.log10(power) : -200;
export function absorption(material, frequency) {
  const a = (MATERIALS[material] ?? MATERIALS.mixed).absorption;
  if (frequency <= 125) return a[0]; if (frequency >= 8000) return a[2];
  const i = frequency < 1000 ? 0 : 1, low = i === 0 ? 125 : 1000, high = i === 0 ? 1000 : 8000;
  const t = Math.log(frequency / low) / Math.log(high / low); return a[i] + (a[i + 1] - a[i]) * t;
}
export function directivity(source, target) {
  if (source.cone >= 360) return 1;
  const d = distance(source, target); if (d < 1e-9) return 1;
  const f = heading(source.yaw, source.pitch), cosine = clamp((f.x * (target.x - source.x) + f.y * (target.y - source.y) + f.z * (target.z - source.z)) / d, -1, 1);
  const angle = Math.acos(cosine), outer = radians(source.cone / 2), inner = outer * 0.65;
  if (angle <= inner) return 1; if (angle >= outer) return 0.08;
  return 1 - 0.92 * (angle - inner) / (outer - inner);
}
export function pathGain(source, target, length, reflection = 1, airLoss = 0) {
  const air = dbToGain(-airLoss * (source.frequency / 1000) ** 1.3 * length);
  // Pressure falls as 1/r, energy as 1/r². Clamp the singular near field to a 1 m reference.
  return dbToGain(source.level) * directivity(source, target) * reflection * air / Math.max(1, length);
}
export function buildImages(source, room) {
  const images = room.vertices.map((a, i) => {
    const b = room.vertices[(i + 1) % room.vertices.length], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    const nx = -dz / len, nz = dx / len, d = (source.x - a.x) * nx + (source.z - a.z) * nz;
    return { x: source.x - 2 * d * nx, y: source.y, z: source.z - 2 * d * nz, kind: 'wall', a, b, nx, nz, wall: i, reflectivity: Math.sqrt(1 - absorption(room.wall, source.frequency)) };
  });
  images.push({ x: source.x, y: -source.y, z: source.z, kind: 'floor', plane: 0, reflectivity: Math.sqrt(1 - absorption(room.floor, source.frequency)) });
  images.push({ x: source.x, y: 2 * room.height - source.y, z: source.z, kind: 'ceiling', plane: room.height, reflectivity: Math.sqrt(1 - absorption(room.ceiling, source.frequency)) });
  return images;
}
export function reflectionHit(image, receiver, room, out = {}) {
  const dx = receiver.x - image.x, dy = receiver.y - image.y, dz = receiver.z - image.z;
  let t;
  if (image.kind === 'wall') {
    const den = dx * image.nx + dz * image.nz;
    if (Math.abs(den) < 1e-10) return null;
    t = ((image.a.x - image.x) * image.nx + (image.a.z - image.z) * image.nz) / den;
  } else {
    if (Math.abs(dy) < 1e-10) return null;
    t = (image.plane - image.y) / dy;
  }
  if (t <= 1e-8 || t >= 1 - 1e-8) return null;
  const p = out; p.x = image.x + t * dx; p.y = image.y + t * dy; p.z = image.z + t * dz;
  if (image.kind === 'wall') {
    const ex = image.b.x - image.a.x, ez = image.b.z - image.a.z;
    const u = ((p.x - image.a.x) * ex + (p.z - image.a.z) * ez) / (ex * ex + ez * ez);
    if (u < -1e-7 || u > 1 + 1e-7 || p.y < -1e-6 || p.y > room.height + 1e-6) return null;
    return p; // A point on a finite convex-polygon edge is inside its footprint.
  }
  return insideRoom(p, room, 1e-6) ? p : null;
}
export function prepare(scene) {
  const frequencies = [], groups = new Map();
  const sources = activeSources(scene).map(source => {
    if (!groups.has(source.frequency)) { groups.set(source.frequency, frequencies.length); frequencies.push(source.frequency); }
    return { source, amplitude: dbToGain(source.level), air: roomAir(scene.room, source.frequency), waveNumber: TAU * source.frequency / SPEED_OF_SOUND, phase: radians(source.phase), direction: heading(source.yaw, source.pitch), inner: radians(source.cone / 2) * 0.65, outer: radians(source.cone / 2), group: groups.get(source.frequency), images: scene.settings.reflections ? buildImages(source, scene.room).filter(i => i.reflectivity > 0) : [] };
  });
  return { sources, room: scene.room, coherent: scene.settings.field === 'coherent', frequencies,
    real: new Float64Array(frequencies.length), imag: new Float64Array(frequencies.length), hit: { x: 0, y: 0, z: 0 } };
}
const roomAir = (room, frequency) => room.airLoss * (frequency / 1000) ** 1.3 * Math.LN10 / 20;
function compiledGain(record, target, length, reflection = 1) {
  let coneGain = 1;
  if (record.source.cone < 360) {
    const dx = target.x - record.source.x, dy = target.y - record.source.y, dz = target.z - record.source.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > 1e-9) {
      const angle = Math.acos(clamp((record.direction.x * dx + record.direction.y * dy + record.direction.z * dz) / distance, -1, 1));
      coneGain = angle <= record.inner ? 1 : angle >= record.outer ? 0.08 : 1 - 0.92 * (angle - record.inner) / (record.outer - record.inner);
    }
  }
  return record.amplitude * coneGain * reflection * (record.air ? Math.exp(-record.air * length) : 1) / Math.max(1, length);
}
export function samplePower(prepared, receiver) {
  const { room, sources, real, imag, coherent } = prepared;
  if (!insideRoom(receiver, room)) return 0;
  if (coherent) { real.fill(0); imag.fill(0); }
  let power = 0;
  for (const record of sources) {
    const { source, images, group } = record, d = distance(source, receiver), direct = compiledGain(record, receiver, d);
    if (coherent) {
      const phase = record.phase - record.waveNumber * d;
      real[group] += direct * Math.cos(phase); imag[group] += direct * Math.sin(phase);
    } else power += direct * direct;
    for (const image of images) {
      const hit = reflectionHit(image, receiver, room, prepared.hit); if (!hit) continue;
      const length = distance(image, receiver), gain = compiledGain(record, hit, length, image.reflectivity);
      if (coherent) {
        const phase = record.phase - record.waveNumber * length;
        real[group] += gain * Math.cos(phase); imag[group] += gain * Math.sin(phase);
      } else power += gain * gain;
    }
  }
  if (coherent) for (let i = 0; i < real.length; i++) power += real[i] ** 2 + imag[i] ** 2;
  return power;
}
export function pathsFor(source, receiver, scene) {
  if (!source || !activeSources(scene).some(s => s.id === source.id) || !insideRoom(source, scene.room) || !insideRoom(receiver, scene.room)) return [];
  const d = distance(source, receiver);
  const result = [{ kind: 'direct', points: [source, receiver], length: d, gain: pathGain(source, receiver, d, 1, scene.room.airLoss) }];
  if (scene.settings.reflections) for (const image of buildImages(source, scene.room)) {
    if (image.reflectivity <= 0) continue;
    const hit = reflectionHit(image, receiver, scene.room); if (!hit) continue;
    const length = distance(image, receiver);
    result.push({ kind: image.kind, points: [source, hit, receiver], length, gain: pathGain(source, hit, length, image.reflectivity, scene.room.airLoss), image });
  }
  return result;
}
export function fieldDimensions(scene) {
  const b = bounds(scene.room.vertices), size = { fast: 56, balanced: 96, fine: 160 }[scene.settings.quality] ?? 96;
  return { ...b, nx: Math.max(8, Math.round(size * b.width / Math.max(b.width, b.depth))), nz: Math.max(8, Math.round(size * b.depth / Math.max(b.width, b.depth))) };
}
export function createFieldJob(scene) {
  const start = performance.now(), prepared = prepare(scene), dimensions = fieldDimensions(scene), { nx, nz, minX, minZ, width, depth } = dimensions;
  const values = new Float32Array(nx * nz), receiver = { x: 0, y: scene.settings.slice, z: 0 };
  let row = 0, computeMs = 0;
  return { step(rows = 4) {
    const tick = performance.now(), end = Math.min(nz, row + rows);
    for (; row < end; row++) for (let x = 0; x < nx; x++) {
      receiver.x = minX + (x + 0.5) / nx * width; receiver.z = minZ + (row + 0.5) / nz * depth;
      values[row * nx + x] = insideRoom(receiver, scene.room) ? powerToDb(samplePower(prepared, receiver)) : NaN;
    }
    computeMs += performance.now() - tick;
    if (row < nz) return null;
    const maxFrequency = Math.max(0, ...prepared.frequencies), spacing = Math.max(width / nx, depth / nz);
    return { ...dimensions, values, elapsed: computeMs, wallTime: performance.now() - start, undersampled: prepared.coherent && maxFrequency * spacing > SPEED_OF_SOUND / 4 };
  } };
}
export function computeField(scene) { return createFieldJob(scene).step(Infinity); }
// Visual names and output gain never alter acoustics. Source IDs are only needed
// for report attribution; the map can reuse its cache across ID-only edits.
export function acousticKey(scene, includeIds = false) {
  return JSON.stringify([scene.room, activeSources(scene).map(({ id, name, muted, solo, ...source }) => {
    if (scene.settings.field !== 'coherent') delete source.phase;
    return includeIds ? { id, ...source } : source;
  }), scene.settings.field === 'coherent', scene.settings.reflections]);
}
export function fieldKey(scene) {
  return JSON.stringify([acousticKey(scene), scene.settings.field === 'off', scene.settings.slice, scene.settings.quality]);
}
