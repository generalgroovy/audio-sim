import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';
import { preset, speaker } from '../src/model.js';
class Parameter {
  constructor(value = 0) { this.value = value; this.events = []; }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
  cancelAndHoldAtTime(t) { this.events.push(['hold', t]); }
  setTargetAtTime(value, t, c) { this.value = value; this.events.push(['target', value, t, c]); }
  setValueAtTime(value, t) { this.value = value; this.events.push(['set', value, t]); }
  linearRampToValueAtTime(value, t) { this.value = value; this.events.push(['ramp', value, t]); }
}
class Node {
  constructor() { this.connections = []; this.disconnected = false; this.gain = new Parameter(1); this.frequency = new Parameter(440); this.delayTime = new Parameter(); }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; this.connections = []; }
  start(t) { this.started = t; }
  stop(t) { this.stopped = t; queueMicrotask(() => this.onended?.()); }
  setPeriodicWave(wave) { this.wave = wave; }
}
class Context {
  constructor() { this.currentTime = 1; this.state = 'suspended'; this.destination = new Node(); this.nodes = []; this.listener = {}; for (const prefix of ['position', 'forward', 'up']) for (const axis of ['X', 'Y', 'Z']) this.listener[prefix + axis] = new Parameter(); }
  node() { const n = new Node(); this.nodes.push(n); return n; }
  createGain() { return this.node(); }
  createDelay() { return this.node(); }
  createOscillator() { return this.node(); }
  createPanner() { const n = this.node(); for (const axis of ['X', 'Y', 'Z']) n[`position${axis}`] = new Parameter(); return n; }
  createPeriodicWave(real, imag) { return { real, imag }; }
  createDynamicsCompressor() { const n = this.node(); for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[key] = new Parameter(); return n; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
test('audio is lazy: construction creates no context or oscillator', () => { const audio = new AudioEngine(Context); assert.equal(audio.context, null); assert.equal(audio.diagnostics().voices, 0); });
test('explicit start creates the expected direct and reflected graphs', async () => { const a = new AudioEngine(Context); await a.start(preset()); assert.equal(a.diagnostics().voices, 4); assert.equal(a.diagnostics().paths, 28); assert.equal(a.enabled, true); await a.dispose(); });
test('repeating unchanged synchronization schedules zero parameter writes', async () => { const a = new AudioEngine(Context), s = preset(); await a.start(s); const writes = a.parameterWrites; a.sync(s); a.sync(s); assert.equal(a.parameterWrites, writes); await a.dispose(); });
test('camera changes do not alter the spatial audio graph', async () => { const a = new AudioEngine(Context), s = preset(); await a.start(s); const writes = a.parameterWrites, nodes = a.context.nodes.length; s.view.yaw = 75; s.settings.mode = '3d'; a.sync(s); assert.equal(a.parameterWrites, writes); assert.equal(a.context.nodes.length, nodes); await a.dispose(); });
test('listener position and orientation match the scene', async () => { const a = new AudioEngine(Context), s = preset(); s.listener = { x: 1, y: 2, z: -1, yaw: 90 }; await a.start(s); const l = a.context.listener; assert.equal(l.positionX.value, 1); assert.equal(l.positionY.value, 2); assert.equal(l.positionZ.value, -1); assert.ok(Math.abs(l.forwardX.value - 1) < 1e-9); assert.equal(l.upY.value, 1); await a.dispose(); });
test('direct panners use HRTF and do not double-apply path attenuation', async () => { const a = new AudioEngine(Context); await a.start(preset()); const v = a.voices.values().next().value; assert.equal(v.paths.get('direct').panner.panningModel, 'HRTF'); for (const path of v.paths.values()) assert.equal(path.panner.rolloffFactor, 0); assert.equal(v.paths.get('floor').panner.panningModel, 'equalpower'); await a.dispose(); });
test('muting and removing sources releases complete audio graphs', async () => { const a = new AudioEngine(Context), s = preset(); await a.start(s); const first = a.voices.get('1'); s.speakers[0].muted = true; a.sync(s); await Promise.resolve(); assert.equal(a.voices.size, 3); assert.ok(first.input.disconnected); for (const branch of first.paths.values()) assert.ok(branch.panner.disconnected); s.speakers = []; a.sync(s); await Promise.resolve(); assert.equal(a.voices.size, 0); assert.equal(a.retired.size, 0); await a.dispose(); });
test('frequency edits crossfade instead of leaking old oscillators', async () => { const a = new AudioEngine(Context), s = preset(); await a.start(s); const old = a.voices.get('1').oscillator; s.speakers[0].frequency = 120; a.sync(s); await Promise.resolve(); assert.ok(old.osc.disconnected); assert.ok(old.fade.disconnected); assert.equal(a.retired.size, 0); assert.equal(a.voices.get('1').oscillator.osc.frequency.value, 120); await a.dispose(); });
test('reflections can be muted without allocating replacement nodes', async () => { const a = new AudioEngine(Context), s = preset(); await a.start(s); const count = a.context.nodes.length; s.settings.reflections = false; a.sync(s); assert.equal(a.context.nodes.length, count); for (const v of a.voices.values()) for (const [key, path] of v.paths) if (key !== 'direct') assert.equal(path.gain.gain.value, 0); s.settings.reflections = true; a.sync(s); assert.equal(a.context.nodes.length, count); await a.dispose(); });
test('master preview has bounded gain and pauses the context', async () => { const a = new AudioEngine(Context), s = preset(); s.settings.master = -6; await a.start(s); assert.ok(a.master.gain.value <= 10 ** (-6 / 20)); await a.pause(); assert.equal(a.enabled, false); assert.equal(a.context.state, 'suspended'); assert.equal(a.master.gain.value, 0); await a.dispose(); });
test('unavailable Web Audio rejects clearly without breaking visual state', async () => { const a = new AudioEngine(null); await assert.rejects(a.start(preset()), /unavailable/); });

class DeferredContext extends Context {
  constructor() { super(); this.resumes = []; }
  resume() { return new Promise(resolve => { this.resumes.push(() => { this.state = 'running'; resolve(); }); }); }
}
test('an older resume completion cannot suspend a newer successful start', async () => {
  const a = new AudioEngine(DeferredContext);
  try {
    const first = a.start(preset()); const context = a.context;
    const pause = a.pause(); const second = a.start(preset('stereo'));
    context.resumes[1](); await second; context.resumes[0](); await first; await pause;
    assert.equal(context.state, 'running'); assert.equal(a.enabled, true); assert.equal(a.voices.size, 2);
  } finally { await a.dispose(); }
});
test('a scene replacement during resume uses the latest scene, not an obsolete snapshot', async () => {
  const a = new AudioEngine(DeferredContext);
  try {
    const start = a.start(preset()); a.sync(preset('empty'));
    a.context.resumes[0](); await start; assert.equal(a.voices.size, 0);
  } finally { await a.dispose(); }
});
test('external interruption revokes playback intent until another explicit start', async () => {
  const a = new AudioEngine(Context);
  try {
    await a.start(preset()); a.context.state = 'interrupted'; a.context.onstatechange?.();
    assert.equal(a.enabled, false); assert.equal(a.master.gain.value, 0);
  } finally { await a.dispose(); }
});
test('a blocked resume times out and restores a muted, retryable state', async () => {
  const a = new AudioEngine(DeferredContext, { resumeTimeout: 15 });
  try {
    await assert.rejects(a.start(preset()), /timed out/);
    assert.equal(a.enabled, false); assert.equal(a.master.gain.value, 0);
    const next = a.start(preset('stereo')); a.context.resumes[1](); await next;
    assert.equal(a.enabled, true); assert.equal(a.voices.size, 2);
  } finally { await a.dispose(); }
});
test('late resume after pause stays inaudible and suspended', async () => {
  const a = new AudioEngine(DeferredContext);
  try {
    const start = a.start(preset()); await a.pause(); a.context.resumes[0](); await start;
    assert.equal(a.enabled, false); assert.equal(a.context.state, 'suspended'); assert.equal(a.voices.size, 0);
  } finally { await a.dispose(); }
});
test('dispose disconnects live and retired nodes without waiting for onended', async () => {
  class NoEndedContext extends Context { createOscillator() { const osc = super.createOscillator(); osc.stop = () => {}; return osc; } }
  const a = new AudioEngine(NoEndedContext); await a.start(preset());
  const ctx = a.context; const s = preset(); s.speakers[0].frequency = 120; a.sync(s);
  assert.equal(a.retired.size, 1); await a.dispose();
  assert.equal(ctx.state, 'closed'); assert.equal(a.retired.size, 0); assert.equal(a.voices.size, 0);
  assert.ok(ctx.nodes.every(n => n.disconnected));
});
test('closed contexts can be explicitly recreated without stale voices', async () => {
  const a = new AudioEngine(Context);
  try {
    await a.start(preset()); const old = a.context; await old.close(); old.onstatechange?.();
    await a.start(preset('stereo')); assert.notEqual(a.context, old); assert.equal(a.voices.size, 2);
  } finally { await a.dispose(); }
});
test('source solo and mute precedence select the same voices as the acoustic model', async () => {
  const a = new AudioEngine(Context), scene = preset();
  try {
    scene.speakers[1].solo = true; await a.start(scene); assert.deepEqual([...a.voices.keys()], ['2']);
    scene.speakers[1].muted = true; a.sync(scene); assert.equal(a.voices.size, 0);
    scene.speakers[1].solo = false; a.sync(scene); assert.equal(a.voices.size, 3);
  } finally { await a.dispose(); }
});
test('pitched listener audio forward and up vectors stay perpendicular', async () => {
  const a = new AudioEngine(Context), scene = preset(); scene.listener.yaw = 40; scene.listener.pitch = 65;
  try {
    await a.start(scene); const l = a.context.listener;
    const dot = ['X', 'Y', 'Z'].reduce((sum, axis) => sum + l[`forward${axis}`].value * l[`up${axis}`].value, 0);
    assert.ok(Math.abs(dot) < 1e-9); assert.ok(l.forwardY.value > 0.9);
  } finally { await a.dispose(); }
});
