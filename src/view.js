import { bounds, heading, listenerUp, activeSources, radians, TAU } from './model.js';
import { pathsFor } from './acoustics.js';
import { projection } from './projection.js';
export const speakerColor = s => s.frequency < 200 ? '#aa9af7' : s.frequency < 2000 ? '#65d7c2' : s.frequency < 6000 ? '#f3c779' : '#f194a6';
const ramp = [[12, 24, 46], [34, 63, 100], [39, 122, 151], [73, 179, 159], [192, 199, 119], [244, 189, 109]];
export function fieldColor(db) {
  const u = Math.max(0, Math.min(1, (db + 60) / 60)) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(u)), t = u - i;
  return [0, 1, 2].map(c => Math.round(ramp[i][c] + (ramp[i + 1][c] - ramp[i][c]) * t));
}
export class View {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.texture = document.createElement('canvas'); this.field = null; this.draws = 0; this.width = 800; this.height = 600;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr); this.dpr = dpr;
  }
  setField(field) {
    this.field = field; this.stale = false; this.texture.width = field.nx; this.texture.height = field.nz;
    const context = this.texture.getContext('2d'), image = context.createImageData(field.nx, field.nz);
    for (let i = 0; i < field.values.length; i++) {
      const db = field.values[i]; if (!Number.isFinite(db)) continue;
      const color = fieldColor(db); image.data.set([...color, 195], i * 4);
    }
    context.putImageData(image, 0, 0);
  }
  draw(scene, time = 0) {
    this.draws++; this.scene = scene;
    const ctx = this.ctx, p = this.proj = this.fixedProjection ?? projection(scene, this.width, this.height), room = scene.room, settings = scene.settings;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = '#0c121b'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.font = '12px system-ui';
    const path = points => { ctx.beginPath(); points.forEach((v, i) => { const s = p.project(v); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); };
    const line = (points, color, width = 1, dash = []) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); path(points); ctx.stroke(); ctx.setLineDash([]); };
    const polygon = (points, color, stroke) => { path(points); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
    const outline = y => room.vertices.map(v => ({ ...v, y }));
    polygon(outline(0), '#101e2c', '#52657a');
    if (p.is3d) {
      room.vertices.forEach((a, i) => {
        const b = room.vertices[(i + 1) % room.vertices.length];
        if ((b.x - a.x) * p.cy + (b.z - a.z) * p.sy > 0) polygon([{ ...a, y: 0 }, { ...b, y: 0 }, { ...b, y: room.height }, { ...a, y: room.height }], '#182637', '#425469');
      });
    }
    const field = this.field;
    if (settings.field !== 'off' && field && !this.stale) {
      ctx.save(); path(outline(p.is3d ? settings.slice : 0)); ctx.closePath(); ctx.clip();
      const y = p.is3d ? settings.slice : 0;
      const a = p.project({ x: field.minX, y, z: field.minZ }), b = p.project({ x: field.minX + field.width, y, z: field.minZ }), c = p.project({ x: field.minX, y, z: field.minZ + field.depth });
      ctx.transform((b.x - a.x) / field.nx, (b.y - a.y) / field.nx, (c.x - a.x) / field.nz, (c.y - a.y) / field.nz, a.x, a.y);
      ctx.imageSmoothingEnabled = settings.field !== 'coherent'; ctx.drawImage(this.texture, 0, 0); ctx.restore();
    }
    const bb = bounds(room.vertices), gridY = p.is3d && settings.field !== 'off' ? settings.slice : 0;
    ctx.save(); path(outline(gridY)); ctx.closePath(); ctx.clip();
    for (let x = Math.ceil(bb.minX); x <= bb.maxX; x++) line([{ x, y: gridY, z: bb.minZ }, { x, y: gridY, z: bb.maxZ }], '#d2e2f014');
    for (let z = Math.ceil(bb.minZ); z <= bb.maxZ; z++) line([{ x: bb.minX, y: gridY, z }, { x: bb.maxX, y: gridY, z }], '#d2e2f014');
    ctx.restore();
    line([...outline(0), outline(0)[0]], '#8c9caf', 1.5);
    if (p.is3d) {
      line([...outline(room.height), outline(room.height)[0]], '#65768b', 1, [5, 5]);
      room.vertices.forEach(v => line([{ ...v, y: 0 }, { ...v, y: room.height }], '#65768b', 1, [5, 5]));
      if (settings.field !== 'off') line([...outline(settings.slice), outline(settings.slice)[0]], '#65d7c299', 1);
    }
    const selected = scene.speakers.find(s => s.id === scene.selected);
    if (selected && settings.paths) {
      for (const ray of pathsFor(selected, scene.listener, scene)) {
        const points = ray.points.map(v => p.is3d ? v : { ...v, y: 0 });
        line(points, ray.kind === 'direct' ? '#f6ead0' : '#eac88470', ray.kind === 'direct' ? 1.8 : 1, ray.kind === 'direct' ? [] : [4, 5]);
        if (settings.animate && ray.length > 0.001) {
          let remain = (time * 0.002) % ray.length;
          for (let i = 1; i < ray.points.length; i++) {
            const a = ray.points[i - 1], b = ray.points[i], len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
            if (remain <= len) { const t = remain / Math.max(len, 1e-9); const s = p.project({ x: a.x + (b.x - a.x) * t, y: p.is3d ? a.y + (b.y - a.y) * t : 0, z: a.z + (b.z - a.z) * t }); ctx.fillStyle = '#f7ecd4'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, TAU); ctx.fill(); break; } remain -= len;
          }
        }
      }
    }
    if (selected && selected.cone < 360 && p.is3d) {
      const forward = heading(selected.yaw, selected.pitch), up = listenerUp(selected.yaw, selected.pitch), right = heading(selected.yaw + 90);
      const angle = radians(selected.cone / 2), rim = [];
      for (let i = 0; i <= 24; i++) {
        const theta = i / 24 * TAU, point = {};
        for (const axis of ['x', 'y', 'z']) point[axis] = selected[axis] + 1.5 * (forward[axis] * Math.cos(angle) + Math.sin(angle) * (right[axis] * Math.cos(theta) + up[axis] * Math.sin(theta)));
        rim.push(point);
      }
      line(rim, `${speakerColor(selected)}88`, 1);
      for (const i of [0, 6, 12, 18]) line([selected, rim[i]], `${speakerColor(selected)}55`, 1);
    }
    if (selected && selected.cone < 360 && !p.is3d) {
      const at = { ...selected, y: p.is3d ? selected.y : 0 }, points = [at];
      for (let i = 0; i <= 32; i++) { const angle = radians(selected.yaw - selected.cone / 2 + selected.cone * i / 32); points.push({ x: at.x + Math.sin(angle) * 1.5, y: at.y, z: at.z - Math.cos(angle) * 1.5 }); }
      ctx.save(); path(outline(at.y)); ctx.closePath(); ctx.clip(); polygon(points, `${speakerColor(selected)}22`, `${speakerColor(selected)}66`); ctx.restore();
    }
    const objects = [...scene.speakers, { ...scene.listener, id: 'listener', listener: true }];
    objects.sort((a, b) => p.project(a).depth - p.project(b).depth);
    const audible = new Set(activeSources(scene).map(s => s.id));
    for (const s of objects) {
      const at = p.project(p.is3d ? s : { ...s, y: 0 }), color = s.listener ? '#e5ecf5' : speakerColor(s), active = s.id === scene.selected;
      ctx.globalAlpha = !s.listener && !audible.has(s.id) ? 0.38 : 1;
      if (p.is3d) {
        line([{ ...s, y: 0 }, s], `${color}66`, 1, [3, 4]);
        const bottom = p.project({ ...s, y: 0 }); ctx.fillStyle = '#00000040'; ctx.beginPath(); ctx.ellipse(bottom.x, bottom.y, 13, 5, 0, 0, TAU); ctx.fill();
      }
      if (active) { ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(at.x, at.y, 19, 0, TAU); ctx.stroke(); }
      if (s.listener) {
        ctx.fillStyle = '#0c1522'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(at.x, at.y, 10, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(at.x, at.y, 3.2, 0, TAU); ctx.fill();
      } else if (p.is3d) {
        const r = 0.18, top = s.y + 0.3, low = s.y - 0.3;
        const cube = (dx, dz, y) => ({ x: s.x + dx * r, y, z: s.z + dz * r });
        polygon([cube(-1, -1, low), cube(1, -1, low), cube(1, -1, top), cube(-1, -1, top)], '#233749', color);
        polygon([cube(1, -1, low), cube(1, 1, low), cube(1, 1, top), cube(1, -1, top)], '#172637', color);
        polygon([cube(-1, 1, low), cube(1, 1, low), cube(1, 1, top), cube(-1, 1, top)], '#233749', color);
        polygon([cube(-1, -1, top), cube(1, -1, top), cube(1, 1, top), cube(-1, 1, top)], color);
      } else { ctx.fillStyle = '#0b1825'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(at.x - 9, at.y - 12, 18, 24, 4); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(at.x, at.y + 3, 4.5, 0, TAU); ctx.stroke(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(at.x, at.y - 6, 2, 0, TAU); ctx.fill(); }
      const forward = heading(s.yaw, s.pitch), tip = p.project({ x: s.x + forward.x * 0.65, y: p.is3d ? s.y + forward.y * 0.65 : 0, z: s.z + forward.z * 0.65 });
      line([p.is3d ? s : { ...s, y: 0 }, { x: s.x + forward.x * 0.65, y: p.is3d ? s.y + forward.y * 0.65 : 0, z: s.z + forward.z * 0.65 }], color, 1.5);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tip.x, tip.y, 2, 0, TAU); ctx.fill();
      const label = s.listener ? 'LISTENER' : s.name, w = ctx.measureText(label).width;
      ctx.fillStyle = '#0c121be8'; ctx.beginPath(); ctx.roundRect(at.x - w / 2 - 7, at.y + 23, w + 14, 21, 5); ctx.fill();
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(label, at.x, at.y + 37); ctx.globalAlpha = 1;
    }
    if (settings.editRoom) room.vertices.forEach((v, i) => { const s = p.project({ ...v, y: 0 }); ctx.fillStyle = '#101e2c'; ctx.strokeStyle = '#e9c17d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(s.x - 6, s.y - 6, 12, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e9c17d'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), s.x, s.y - 13); });
    ctx.textAlign = 'left'; ctx.fillStyle = '#8b9aad'; ctx.font = '11px system-ui';
    ctx.fillText(p.is3d ? 'ORTHOGRAPHIC 3D · X / Y / Z' : 'TOP-DOWN · X / Z', 22, this.height - 24);
    ctx.textAlign = 'right'; ctx.fillText('1 grid square = 1 m', this.width - 22, this.height - 24);
  }
  snapshot(scene) {
    this.draw(scene, performance.now());
    const canvas = document.createElement('canvas');
    canvas.width = this.canvas.width; canvas.height = this.canvas.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(this.canvas, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const w = Math.min(345, this.width - 24), b = bounds(scene.room.vertices);
    ctx.fillStyle = '#0c121bed'; ctx.fillRect(12, 12, w, scene.settings.field === 'off' ? 66 : 100);
    ctx.textAlign = 'left'; ctx.font = '12px system-ui'; ctx.fillStyle = '#e4ebf4';
    ctx.fillText(`Audio Sim 2.1 · ${scene.settings.mode === '3d' ? '3D orthographic' : '2D plan'}`, 23, 32);
    ctx.font = '10px system-ui'; ctx.fillStyle = '#adbbca';
    ctx.fillText(`${b.width.toFixed(1)} × ${b.depth.toFixed(1)} × ${scene.room.height.toFixed(1)} m · ${scene.speakers.length} sources`, 23, 49);
    if (scene.settings.field !== 'off') {
      ctx.fillText(`${scene.settings.field === 'coherent' ? 'Phase interference' : 'Energy coverage'} · slice ${scene.settings.slice.toFixed(1)} m`, 23, 66);
      const gradient = ctx.createLinearGradient(23, 0, w, 0);
      ramp.forEach((color, i) => gradient.addColorStop(i / (ramp.length - 1), `rgb(${color.join(',')})`));
      ctx.fillStyle = gradient; ctx.fillRect(23, 75, w - 22, 5); ctx.fillStyle = '#adbbca';
      ctx.fillText('−60', 23, 94); ctx.textAlign = 'right'; ctx.fillText('0 dB relative · not calibrated SPL', w, 94);
    } else ctx.fillText('Map off · geometric room view', 23, 66);
    return canvas;
  }
  hit(x, y) {
    const scene = this.scene, p = this.proj; if (!scene || !p) return null;
    if (scene.settings.editRoom) for (let i = 0; i < scene.room.vertices.length; i++) { const s = p.project({ ...scene.room.vertices[i], y: 0 }); if (Math.hypot(s.x - x, s.y - y) < 16) return { type: 'corner', index: i }; }
    let nearest = null, min = 26;
    for (const obj of [...scene.speakers, { ...scene.listener, id: 'listener' }]) {
      const s = p.project(p.is3d ? obj : { ...obj, y: 0 }), distance = Math.hypot(s.x - x, s.y - y);
      if (distance < min) { min = distance; nearest = { type: 'object', id: obj.id }; }
    }
    return nearest;
  }
}
