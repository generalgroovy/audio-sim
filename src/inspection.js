import { reportPaths } from './analysis.js';
export class PathInspector {
  constructor(root) { this.root = root; this.key = ''; this.plot = root.querySelector('canvas'); }
  update(scene, report) {
    if (!this.root.open) return;
    const paths = reportPaths(report, scene.selected);
    const names = new Map(scene.speakers.map(s => [s.id, s.name]));
    const key = JSON.stringify([scene.selected, paths, [...names]]);
    if (key === this.key) return;
    this.key = key;
    const label = scene.selected === 'listener' ? 'All audible sources' : names.get(scene.selected) ?? 'Selected source';
    this.root.querySelector('[data-summary]').textContent = paths.length
      ? `${label} · ${paths.length} paths · first arrival ${paths[0].delay.toFixed(2)} ms`
      : `${label} · no audible paths (empty, muted or excluded by solo)`;
    const body = this.root.querySelector('tbody'); body.replaceChildren();
    for (const path of paths.slice(0, 48)) {
      const row = document.createElement('tr');
      for (const value of [`${names.get(path.sourceId)} / ${path.surface}`, path.length.toFixed(2), path.delay.toFixed(2), path.gainDb.toFixed(1)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      body.append(row);
    }
    this.root.querySelector('[data-path-count]').textContent = paths.length > 48
      ? `Showing 48 of ${paths.length} paths. CSV contains them all.`
      : 'Path gains are relative amplitudes, not measured SPL. Arrivals exclude device latency.';
    this.root.querySelector('button').disabled = paths.length === 0;
    this.plotPaths(paths);
  }
  plotPaths(paths) {
    const c = this.plot, ctx = c.getContext('2d'), w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0c121b'; ctx.fillRect(0, 0, w, h);
    const max = Math.max(1, ...paths.map(p => p.delay)) * 1.05;
    ctx.strokeStyle = '#425469'; ctx.beginPath(); ctx.moveTo(10, h - 22); ctx.lineTo(w - 12, h - 22); ctx.stroke();
    for (const path of paths) {
      const x = 10 + path.delay / max * (w - 22), y = (1 - Math.max(0, Math.min(1, (path.gainDb + 80) / 80))) * (h - 34) + 8;
      ctx.strokeStyle = path.kind === 'direct' ? '#65d7c2' : '#eec582';
      ctx.beginPath(); ctx.moveTo(x, h - 22); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.fillStyle = '#91a0b3'; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.fillText('0 ms', 10, h - 6);
    ctx.textAlign = 'right'; ctx.fillText(`${max.toFixed(1)} ms`, w - 12, h - 6);
  }
}
