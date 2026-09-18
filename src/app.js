import { preset, normalizeScene, copy, bounds, MATERIALS, MAX_SPEAKERS, speaker, constrainPoint, constrainScene, validRoom, rectangle, resizeRoom, clamp, heading, History } from './model.js';
import { prepare, samplePower, powerToDb } from './acoustics.js';
import { AudioEngine } from './audio.js';
import { View, speakerColor } from './view.js';
import { FieldController } from './field-controller.js';
const $ = id => document.getElementById(id), STORAGE = 'audio-sim.scene.v2';
let scene = preset(), storageError = '', saveTimer, toastTimer, raf = 0, uiDirty = true, lastTick = 0, drag = null, audioKey = '', audioBusy = false;
try { const saved = localStorage.getItem(STORAGE); if (saved) scene = normalizeScene(JSON.parse(saved)); }
catch { storageError = 'Stored scene could not be loaded. Using the reference scene; Import / Export remains available.'; }
// An animation never starts unexpectedly after reopening a page.
scene.settings.animate = false;
const history = new History(scene), audio = new AudioEngine(), view = new View($('scene')), keys = new Set();
let fieldInfo = null;
const field = new FieldController((result, fallback) => {
  view.setField(result); fieldInfo = result;
  $('render-status').textContent = `${result.nx} × ${result.nz} samples · ${result.elapsed.toFixed(1)} ms · ${fallback ? 'chunked fallback' : 'worker'} · cached`;
  invalidate(true);
}, text => { $('render-status').textContent = text; });
const freqLabel = frequency => frequency >= 1000 ? `${(frequency / 1000).toFixed(frequency % 1000 ? 1 : 0)} kHz` : `${Math.round(frequency)} Hz`;
const selected = () => scene.selected === 'listener' ? scene.listener : scene.speakers.find(s => s.id === scene.selected);
function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500); }
function save() {
  clearTimeout(saveTimer); $('save-status').textContent = 'Saving…';
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE, JSON.stringify(scene)); $('save-status').textContent = 'Saved locally'; } catch { $('save-status').textContent = 'Export to save'; } }, 350);
}
function commit() { history.push(scene); save(); invalidate(true); }
function changed(shouldCommit = false) {
  const key = JSON.stringify([scene.room, scene.listener, scene.speakers.map(({ name, ...s }) => s), scene.settings.reflections, scene.settings.master]);
  if (key !== audioKey) { audioKey = key; audio.sync(scene); }
  field.request(scene); invalidate(true); if (shouldCommit) commit();
}
function invalidate(ui = false) { uiDirty ||= ui; if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
function setValue(id, value) { const node = $(id); if (document.activeElement !== node && String(node.value) !== String(value)) node.value = String(value); }
function renderUI() {
  const b = bounds(scene.room.vertices), isSpeaker = scene.selected !== 'listener', current = selected() ?? scene.listener;
  $('mode-2d').setAttribute('aria-pressed', scene.settings.mode === '2d'); $('mode-3d').setAttribute('aria-pressed', scene.settings.mode === '3d');
  setValue('field-mode', scene.settings.field); setValue('quality', scene.settings.quality);
  $('room-summary').textContent = `${+b.width.toFixed(1)} × ${+b.depth.toFixed(1)} × ${+scene.room.height.toFixed(1)} m`;
  const frequencies = scene.speakers.map(s => s.frequency);
  $('scene-summary').textContent = `${scene.speakers.length} speaker${scene.speakers.length === 1 ? '' : 's'}${frequencies.length ? ` · ${freqLabel(Math.min(...frequencies))}–${freqLabel(Math.max(...frequencies))}` : ''}`;
  $('source-count').textContent = `${scene.speakers.length} / ${MAX_SPEAKERS}`;
  $('add').disabled = scene.speakers.length >= MAX_SPEAKERS; $('duplicate').disabled = scene.speakers.length >= MAX_SPEAKERS;
  const rows = $('source-list');
  for (const row of [...rows.children]) if (!scene.speakers.some(s => s.id === row.dataset.id)) row.remove();
  for (const source of scene.speakers) {
    let row = [...rows.children].find(e => e.dataset.id === source.id);
    if (!row) {
      row = document.createElement('button'); row.className = 'source-row'; row.dataset.id = source.id;
      for (const className of ['source-dot', 'source-name', 'source-frequency']) { const node = document.createElement('span'); node.className = className; row.append(node); }
      row.addEventListener('click', () => { scene.selected = source.id; changed(); }); rows.append(row);
    }
    row.classList.toggle('active', scene.selected === source.id); row.classList.toggle('muted', source.muted); row.style.setProperty('--source-color', speakerColor(source));
    row.setAttribute('aria-pressed', scene.selected === source.id); row.querySelector('.source-name').textContent = source.name;
    row.querySelector('.source-frequency').textContent = `${freqLabel(source.frequency)} · ${source.muted ? 'muted' : `${source.level} dB`}`;
  }
  $('select-listener').classList.toggle('active', !isSpeaker); $('select-listener').setAttribute('aria-pressed', !isSpeaker);
  const power = samplePower(prepare(scene), scene.listener);
  $('listener-reading').textContent = power > 1e-18 ? `${powerToDb(power).toFixed(1)} dB rel.` : '−∞ dB rel.';
  $('selection-title').textContent = isSpeaker ? current.name : 'Listener';
  $('speaker-only').hidden = !isSpeaker; $('speaker-direction').hidden = !isSpeaker;
  if (isSpeaker) {
    setValue('speaker-name', current.name); setValue('frequency', Math.round(Math.log(current.frequency / 20) / Math.log(800) * 1000));
    setValue('frequency-number', current.frequency); setValue('level', current.level); $('level-value').textContent = `${current.level} dB`;
    setValue('cone', current.cone); $('cone-value').textContent = current.cone === 360 ? 'Omni' : `${current.cone}°`;
    setValue('phase', current.phase); $('phase-value').textContent = `${current.phase}°`;
    $('mute').setAttribute('aria-pressed', current.muted); $('mute').textContent = current.muted ? 'Unmute' : 'Mute';
  }
  for (const axis of ['x', 'y', 'z']) setValue(`position-${axis}`, +current[axis].toFixed(2));
  $('position-y').max = scene.room.height - 0.1;
  setValue('yaw', current.yaw); $('yaw-value').textContent = `${Math.round(current.yaw)}°`;
  $('selection-hint').textContent = isSpeaker ? 'Level is relative to a unit source at 1 m, not calibrated SPL.' : 'This marker is the audio receiver. WASD moves; Q / E turns. Camera orbit is independent.';
  for (const [id, value] of [['room-width', b.width], ['room-depth', b.depth], ['room-height', scene.room.height]]) setValue(id, +value.toFixed(2));
  for (const material of ['wall', 'floor', 'ceiling']) setValue(`${material}-material`, scene.room[material]);
  setValue('air-loss', scene.room.airLoss); setValue('slice', scene.settings.slice); $('slice').max = scene.room.height - 0.1;
  $('slice-value').textContent = `${scene.settings.slice.toFixed(1)} m`; $('slice-label').textContent = `SLICE ${scene.settings.slice.toFixed(1)} m`;
  for (const [id, key] of [['edit-room', 'editRoom'], ['reflections', 'reflections'], ['paths', 'paths'], ['animate', 'animate']]) $(id).checked = scene.settings[key];
  setValue('master', scene.settings.master); $('master-value').textContent = `${scene.settings.master} dB`;
  $('undo').disabled = history.index === 0; $('redo').disabled = history.index === history.entries.length - 1;
  $('sampling-warning').hidden = scene.settings.field !== 'coherent' || !fieldInfo?.undersampled;
  $('map-legend').hidden = scene.settings.field === 'off';
  $('gesture-hint').textContent = scene.settings.editRoom ? 'Drag gold corners · convex outlines only' : scene.settings.mode === '3d' ? 'Drag empty space to orbit · Shift-drag to pan' : 'Drag a speaker or listener · scroll to zoom';
  $('audio-toggle').setAttribute('aria-pressed', audio.enabled); $('audio-toggle').textContent = audio.enabled ? 'Ⅱ Pause audio' : '▶ Enable audio';
}
function moveKeys(dt) {
  if (!keys.size) return false;
  const speed = (keys.has('shift') ? 4 : 1.6) * dt, listener = scene.listener, f = heading(listener.yaw), right = { x: -f.z, z: f.x };
  let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), dz = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  if (dx && dz) { dx /= Math.SQRT2; dz /= Math.SQRT2; }
  listener.x += (f.x * dz + right.x * dx) * speed; listener.z += (f.z * dz + right.z * dx) * speed;
  listener.yaw = ((listener.yaw + ((keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0)) * 90 * dt + 540) % 360) - 180;
  const target = selected();
  if (target) { target.x += ((keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0)) * speed; target.z += ((keys.has('arrowdown') ? 1 : 0) - (keys.has('arrowup') ? 1 : 0)) * speed; }
  constrainScene(scene); changed(); return true;
}
function frame(time) {
  raf = 0; if (document.hidden) return;
  const dt = Math.min(0.05, lastTick ? (time - lastTick) / 1000 : 1 / 60); lastTick = time;
  moveKeys(dt); if (uiDirty) { renderUI(); uiDirty = false; }
  view.draw(scene, time);
  if (keys.size || (scene.settings.animate && scene.settings.paths && scene.selected !== 'listener')) invalidate();
}
function replace(next) { scene = next; changed(true); }
function setMode(mode) { scene.settings.mode = mode; changed(true); }
function fit() { scene.view = { yaw: -32, pitch: 48, zoom: 1, panX: 0, panY: 0 }; changed(true); }
function addSpeaker(duplicate = false) {
  if (scene.speakers.length >= MAX_SPEAKERS) { notify(`Limit: ${MAX_SPEAKERS} speakers.`); return; }
  const used = new Set(scene.speakers.map(s => s.id)); let id = 1; while (used.has(String(id))) id++;
  const source = duplicate && scene.selected !== 'listener' ? { ...selected(), id: String(id), name: `${selected().name} copy`.slice(0, 48), x: selected().x + 0.5 } : speaker(id, scene.listener.x, scene.listener.z - 1);
  Object.assign(source, constrainPoint(source, scene.room)); scene.speakers.push(source); scene.selected = source.id; changed(true);
}
function removeSelected() { if (scene.selected === 'listener') return; scene.speakers = scene.speakers.filter(s => s.id !== scene.selected); scene.selected = scene.speakers[0]?.id ?? 'listener'; changed(true); }
function undo() { const state = history.undo(); if (state) { scene = state; changed(); save(); } }
function redo() { const state = history.redo(); if (state) { scene = state; changed(); save(); } }
async function toggleAudio() {
  if (audioBusy) return; audioBusy = true; $('audio-toggle').disabled = true;
  try { if (audio.enabled) await audio.pause(); else await audio.start(scene); }
  catch (error) { notify(`Audio: ${error.message}`); }
  finally { audioBusy = false; $('audio-toggle').disabled = false; invalidate(true); }
}
function on(id, event, handler) { $(id).addEventListener(event, handler); }
for (const [id, handler] of Object.entries({ 'mode-2d': () => setMode('2d'), 'mode-3d': () => setMode('3d'), fit, add: () => addSpeaker(), duplicate: () => addSpeaker(true), remove: removeSelected, undo, redo, 'audio-toggle': toggleAudio, 'select-listener': () => { scene.selected = 'listener'; changed(); }, mute: () => { const s = selected(); if (scene.selected !== 'listener') { s.muted = !s.muted; changed(true); } }, 'zoom-in': () => { scene.view.zoom = clamp(scene.view.zoom * 1.2, 0.4, 3); changed(true); }, 'zoom-out': () => { scene.view.zoom = clamp(scene.view.zoom / 1.2, 0.4, 3); changed(true); } })) on(id, 'click', handler);
for (const id of ['help', 'model-help']) on(id, 'click', () => { keys.clear(); $('help-dialog').showModal(); });
on('close-help', 'click', () => $('help-dialog').close());
on('fullscreen', 'click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { notify('Fullscreen is not available in this browser.'); } });
on('preset', 'change', event => { if (event.target.value) { replace(preset(event.target.value)); event.target.value = ''; notify('Preset loaded. Undo restores the previous scene.'); } });
for (const [id, setting] of [['field-mode', 'field'], ['quality', 'quality']]) on(id, 'change', event => { scene.settings[setting] = event.target.value; changed(true); });
for (const [id, setting] of [['edit-room', 'editRoom'], ['reflections', 'reflections'], ['paths', 'paths'], ['animate', 'animate']]) on(id, 'change', event => { scene.settings[setting] = event.target.checked; changed(true); });
function numericInput(id, apply, event = 'input') {
  on(id, event, () => {
    const input = $(id), value = input.valueAsNumber; if (!Number.isFinite(value)) return;
    apply(clamp(value, Number(input.min), Number(input.max))); changed(event === 'change');
  });
  if (event !== 'change') on(id, 'change', () => { commit(); renderUI(); });
  on(id, 'blur', () => invalidate(true));
}
numericInput('frequency', v => { if (scene.selected !== 'listener') selected().frequency = Math.round(20 * 800 ** (v / 1000)); });
numericInput('frequency-number', v => { if (scene.selected !== 'listener') selected().frequency = Math.round(v); }, 'change');
for (const prop of ['level', 'cone', 'phase']) numericInput(prop, v => { if (scene.selected !== 'listener') selected()[prop] = v; });
numericInput('yaw', v => { selected().yaw = v; });
numericInput('slice', v => { scene.settings.slice = v; });
numericInput('master', v => { scene.settings.master = v; });
numericInput('air-loss', v => { scene.room.airLoss = v; }, 'change');
for (const axis of ['x', 'y', 'z']) numericInput(`position-${axis}`, v => { const target = selected(); target[axis] = v; Object.assign(target, constrainPoint(target, scene.room)); }, 'change');
on('speaker-name', 'change', event => { if (scene.selected !== 'listener') { selected().name = event.target.value.trim().slice(0, 48) || 'Speaker'; changed(true); } });
for (const id of ['room-width', 'room-depth', 'room-height']) numericInput(id, () => {
  const values = ['room-width', 'room-depth', 'room-height'].map(id => $(id).valueAsNumber);
  if (values.every(Number.isFinite)) { if (!resizeRoom(scene, ...values)) notify('That size would create an invalid room.'); }
}, 'change');
for (const key of ['wall', 'floor', 'ceiling']) {
  for (const [value, material] of Object.entries(MATERIALS)) { const option = document.createElement('option'); option.value = value; option.textContent = material.name.split(' / ')[0]; $(`${key}-material`).append(option); }
  on(`${key}-material`, 'change', event => { scene.room[key] = event.target.value; changed(true); });
}
on('rectangle', 'click', () => { const b = bounds(scene.room.vertices); scene.room.vertices = rectangle(b.width, b.depth); constrainScene(scene); changed(true); });
on('export', 'click', () => {
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'audio-sim-scene.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
on('import', 'click', () => $('import-file').click());
on('import-file', 'change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try { if (file.size > 128 * 1024) throw new Error('Scene file exceeds 128 KiB.'); const imported = normalizeScene(JSON.parse(await file.text())); imported.settings.animate = false; replace(imported); notify('Scene imported. Undo restores the previous scene.'); }
  catch (error) { notify(`Import rejected: ${error.message}`); }
  finally { event.target.value = ''; }
});
function canvasPoint(event) { const rect = $('scene').getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
on('scene', 'pointerdown', event => {
  if (drag || ![0, 1, 2].includes(event.button)) return;
  const at = canvasPoint(event), hit = view.hit(at.x, at.y);
  $('scene').focus({ preventScroll: true }); $('scene').setPointerCapture(event.pointerId);
  const object = hit?.type === 'object' ? hit.id === 'listener' ? scene.listener : scene.speakers.find(s => s.id === hit.id) : null;
  const planeY = object && scene.settings.mode === '3d' ? object.y : 0;
  const anchor = view.proj.unproject(at.x, at.y, planeY);
  drag = { pointer: event.pointerId, hit: event.button === 0 && !event.shiftKey ? hit : null, start: at, initialView: { ...scene.view }, anchor, object: object ? { x: object.x, z: object.z, y: object.y } : null, projection: view.proj, pan: event.shiftKey || event.button !== 0 || scene.settings.mode === '2d', moved: false };
  if (drag.hit?.type === 'object') { scene.selected = drag.hit.id; changed(); }
  $('scene').style.cursor = 'grabbing';
});
on('scene', 'pointermove', event => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const at = canvasPoint(event), dx = at.x - drag.start.x, dy = at.y - drag.start.y; drag.moved ||= Math.hypot(dx, dy) > 2;
  if (drag.hit?.type === 'corner') {
    const point = drag.projection.unproject(at.x, at.y, 0), vertices = scene.room.vertices.map(p => ({ ...p }));
    vertices[drag.hit.index] = { x: clamp(point.x, -25, 25), z: clamp(point.z, -25, 25) };
    if (validRoom(vertices)) { scene.room.vertices = vertices; constrainScene(scene); }
  } else if (drag.hit?.type === 'object') {
    const target = selected(), planeY = scene.settings.mode === '3d' ? target.y : 0, point = drag.projection.unproject(at.x, at.y, planeY);
    Object.assign(target, constrainPoint({ ...target, x: drag.object.x + point.x - drag.anchor.x, z: drag.object.z + point.z - drag.anchor.z }, scene.room));
  } else if (drag.pan) { scene.view.panX = clamp(drag.initialView.panX + dx, -1200, 1200); scene.view.panY = clamp(drag.initialView.panY + dy, -1200, 1200); }
  else { scene.view.yaw = ((drag.initialView.yaw + dx * 0.35 + 540) % 360) - 180; scene.view.pitch = clamp(drag.initialView.pitch + dy * 0.25, 18, 82); }
  changed();
});
function endDrag(event) {
  if (!drag || drag.pointer !== event.pointerId) return;
  const moved = drag.moved; drag = null; $('scene').style.cursor = 'grab';
  if ($('scene').hasPointerCapture(event.pointerId)) $('scene').releasePointerCapture(event.pointerId);
  if (moved) commit();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) on('scene', event, endDrag);
on('scene', 'contextmenu', event => event.preventDefault());
$('scene').addEventListener('wheel', event => { event.preventDefault(); scene.view.zoom = clamp(scene.view.zoom * Math.exp(-clamp(event.deltaY, -100, 100) * 0.002), 0.4, 3); changed(); clearTimeout($('scene').wheelTimer); $('scene').wheelTimer = setTimeout(commit, 180); }, { passive: false });
const editing = target => target instanceof Element && (target.closest('input,select,textarea,button,summary,[contenteditable=true]') || $('help-dialog').open);
window.addEventListener('keydown', event => {
  if (editing(event.target) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) { if (key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); } return; }
  if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) { event.preventDefault(); if (event.shiftKey) keys.add('shift'); keys.add(key); invalidate(); return; }
  if (key === 'shift') { if (keys.size) keys.add(key); return; }
  if (event.repeat) return;
  const shortcut = { '2': () => setMode('2d'), '3': () => setMode('3d'), home: fit, delete: removeSelected, l: () => { scene.selected = 'listener'; changed(); } }[key];
  if (shortcut) { event.preventDefault(); shortcut(); }
});
window.addEventListener('keyup', event => { if (keys.delete(event.key.toLowerCase()) && (!keys.size || (keys.size === 1 && keys.has('shift')))) { keys.clear(); commit(); } });
window.addEventListener('blur', () => { if (keys.size) commit(); keys.clear(); });
document.addEventListener('focusin', event => { if (editing(event.target)) keys.clear(); });
document.addEventListener('visibilitychange', () => {
  keys.clear(); lastTick = 0;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; audio.pause().catch(() => {}); }
  else invalidate(true);
});
const observer = new ResizeObserver(() => { view.resize(); invalidate(); }); observer.observe($('canvas-wrap'));
window.addEventListener('resize', () => { view.resize(); invalidate(); });
window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); try { localStorage.setItem(STORAGE, JSON.stringify(scene)); } catch {} } audio.pause().catch(() => {}); });
export function getDiagnostics() {
  return { scene: copy(scene), audio: audio.diagnostics(), field: { jobs: field.jobs, completed: field.completed, busy: Boolean(field.running || field.pending), worker: Boolean(field.worker), elapsed: fieldInfo?.elapsed ?? null, nx: fieldInfo?.nx ?? null, nz: fieldInfo?.nz ?? null, undersampled: fieldInfo?.undersampled ?? false }, draws: view.draws,
    screen: Object.fromEntries([...scene.speakers, { ...scene.listener, id: 'listener' }].map(s => [s.id, view.proj?.project(scene.settings.mode === '3d' ? s : { ...s, y: 0 })])) };
}
view.resize(); changed(); if (storageError) notify(storageError);
