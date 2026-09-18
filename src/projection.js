import { bounds, radians } from './model.js';
// Orthographic 3D projection is affine: the acoustic texture needs ONE drawImage,
// not thousands of per-cell polygons. No GPU/WebGL/CDN is required.
export function projection(scene, width, height) {
  const b = bounds(scene.room.vertices), view = scene.view, is3d = scene.settings.mode === '3d';
  const yaw = radians(is3d ? view.yaw : 0), pitch = radians(is3d ? view.pitch : 90);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const raw = p => ({ x: (p.x - cx) * cy + (p.z - cz) * sy, y: (-(p.x - cx) * sy + (p.z - cz) * cy) * sp - p.y * cp });
  const corners = scene.room.vertices.flatMap(p => [raw({ ...p, y: 0 }), raw({ ...p, y: is3d ? scene.room.height : 0 })]);
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  const scale = Math.max(1, Math.min((width - 100) / (maxX - minX), (height - 160) / (maxY - minY))) * view.zoom;
  const ox = width / 2 - (minX + maxX) / 2 * scale + view.panX;
  const oy = (height + 60) / 2 - (minY + maxY) / 2 * scale + view.panY;
  return {
    scale, is3d, cy, sy, sp, cp,
    project(p) { const r = raw(p); return { x: ox + r.x * scale, y: oy + r.y * scale, depth: (-(p.x - cx) * sy + (p.z - cz) * cy) * cp + p.y * sp }; },
    unproject(x, y, elevation = 0) { const u = (x - ox) / scale, v = ((y - oy) / scale + elevation * cp) / sp; return { x: cx + u * cy - v * sy, y: elevation, z: cz + u * sy + v * cy }; },
  };
}
