import { activeSources } from './model.js';
import { prepare, samplePower, pathsFor, acousticKey, SPEED_OF_SOUND } from './acoustics.js';

// Exact model evaluation at the listener; independent of heatmap quality/height,
// orbit camera, source labels, output volume, and listener head orientation.
export class ProbeCache {
  constructor() { this.key = null; this.result = null; this.computations = 0; }
  get(scene) {
    const { x, y, z } = scene.listener;
    const key = JSON.stringify([acousticKey(scene, true), x, y, z]);
    if (key === this.key) return this.result;
    this.key = key; this.computations++;
    const paths = [];
    for (const source of activeSources(scene)) for (const path of pathsFor(source, scene.listener, scene)) {
      paths.push({ sourceId: source.id, kind: path.kind,
        surface: path.kind === 'wall' ? `Wall ${path.image.wall + 1}` : path.kind[0].toUpperCase() + path.kind.slice(1),
        length: path.length, delay: path.length / SPEED_OF_SOUND * 1000,
        gainDb: path.gain > 0 ? 20 * Math.log10(path.gain) : -200,
        points: path.points.map(point => ({ x: point.x, y: point.y, z: point.z })) });
    }
    paths.sort((a, b) => a.delay - b.delay || a.sourceId.localeCompare(b.sourceId) || a.surface.localeCompare(b.surface));
    this.result = { power: samplePower(prepare(scene), scene.listener), paths };
    return this.result;
  }
}

export function reportPaths(report, selectedId) {
  return selectedId === 'listener' ? report.paths : report.paths.filter(path => path.sourceId === selectedId);
}
function csvCell(value) {
  const text = String(value);
  // Prevent spreadsheet formula execution when user-supplied names are opened as CSV.
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function pathsCSV(scene, paths) {
  const lines = ['source,path,distance_m,arrival_ms,gain_db_relative'];
  const names = new Map(scene.speakers.map(s => [s.id, s.name]));
  for (const path of paths) lines.push([
    csvCell(names.get(path.sourceId) ?? path.sourceId), csvCell(path.surface),
    path.length.toFixed(6), path.delay.toFixed(6), path.gainDb.toFixed(6),
  ].join(','));
  return `${lines.join('\r\n')}\r\n`;
}
