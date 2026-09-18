// Presentation only: these values never feed the acoustic solver or audio graph.
export const INK = Object.freeze({
  background: '#101f2a', floor: '#142936', wall: '#203845', grid: '#cfddd51a',
  text: '#f3eedf', muted: '#b0c4c8', line: '#829f9f', direct: '#faf2da',
  reflected: '#ffc184', selected: '#f6efdb', contour: '#ebf4dc',
});
export const FIELD_RAMP = Object.freeze([
  [17, 35, 50], [35, 65, 90], [40, 106, 125], [65, 158, 145], [155, 193, 139], [240, 209, 137],
]);
export const sourceColor = source => source.frequency < 200 ? '#c4b2fa' : source.frequency < 2000 ? '#87e0ca' : source.frequency < 6000 ? '#ffd08e' : '#ffaebf';
// A separate ink ramp is required for the light inspector; pastel canvas colors
// are not readable as text on paper. The frequency label supplies a non-color cue.
export const sourceInk = source => source.frequency < 200 ? '#60488b' : source.frequency < 2000 ? '#176353' : source.frequency < 6000 ? '#885019' : '#943d57';
export function fieldColor(db) {
  const t = Math.max(0, Math.min(1, (db + 60) / 60)) * (FIELD_RAMP.length - 1);
  const i = Math.min(FIELD_RAMP.length - 2, Math.floor(t)), f = t - i;
  return FIELD_RAMP[i].map((a, channel) => Math.round(a + (FIELD_RAMP[i + 1][channel] - a) * f));
}
export function frequencyLabel(hz) {
  return hz < 1000 ? `${Math.round(hz)} Hz` : `${+(hz / 1000).toFixed(2)} kHz`;
}
// Marching-squares contours on sample centres. No extrapolation over room masks.
// Cached once when a new field arrives; camera movement only reprojects segments.
export function fieldContours(field, levels = [-48, -36, -24, -12, 0]) {
  const { nx, nz, values, minX, minZ, width, depth } = field;
  const result = levels.map(level => ({ level, segments: [] }));
  if (nx < 2 || nz < 2) return result;
  const pairs = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]],
    7: [[3, 2]], 8: [[2, 3]], 9: [[2, 0]], 11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]] };
  for (let z = 0; z < nz - 1; z++) for (let x = 0; x < nx - 1; x++) {
    const v = [values[z * nx + x], values[z * nx + x + 1], values[(z + 1) * nx + x + 1], values[(z + 1) * nx + x]];
    if (!v.every(Number.isFinite)) continue;
    for (const group of result) {
      const mask = v.reduce((n, value, i) => n | (value >= group.level ? 1 << i : 0), 0);
      if (mask === 0 || mask === 15) continue;
      let joins = pairs[mask];
      if (mask === 5 || mask === 10) {
        // Bilinear asymptotic decider: avoid joining the wrong diagonal near saddles.
        const q = (v[0] - group.level) * (v[2] - group.level) - (v[1] - group.level) * (v[3] - group.level);
        joins = q >= 0 ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
      }
      const points = [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]];
      const edge = i => {
        const j = (i + 1) % 4, t = (group.level - v[i]) / (v[j] - v[i]);
        return { x: minX + (points[i][0] + (points[j][0] - points[i][0]) * t + .5) / nx * width,
          z: minZ + (points[i][1] + (points[j][1] - points[i][1]) * t + .5) / nz * depth };
      };
      for (const [a, b] of joins) group.segments.push([edge(a), edge(b)]);
    }
  }
  return result;
}
