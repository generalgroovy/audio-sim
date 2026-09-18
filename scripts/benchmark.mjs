import { preset, speaker } from '../src/model.js';
import { computeField } from '../src/acoustics.js';
import { cpus } from 'node:os';
const results = [];
for (const quality of ['fast', 'balanced', 'fine']) for (const count of [4, 16]) {
  const s = preset(); s.settings.quality = quality;
  while (s.speakers.length < count) { const i = s.speakers.length; s.speakers.push(speaker(String(i + 1), (i % 4 - 1.5) * 2, (Math.floor(i / 4) - 1.5) * 1.5, 125 * (i + 1))); }
  for (let i = 0; i < 3; i++) computeField(s);
  const runs = Array.from({ length: 7 }, () => computeField(s));
  const times = runs.map(r => r.elapsed).sort((a, b) => a - b);
  results.push({ quality, speakers: count, samples: runs[0].values.length, median_ms: +times[3].toFixed(2), min_ms: +times[0].toFixed(2), max_ms: +times[6].toFixed(2) });
}
console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model, note: 'Synthetic warmed solver benchmark, not browser FPS; rendering/audio excluded.', results }, null, 2));
