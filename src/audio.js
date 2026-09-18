import { heading, radians, TAU } from './model.js';
import { dbToGain, pathsFor, SPEED_OF_SOUND } from './acoustics.js';
// Native Web Audio only. Scene gain/delay are calculated once per edit, never per video frame.
export class AudioEngine {
  constructor(Context = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.Context = Context; this.context = null; this.voices = new Map(); this.retired = new Set();
    this.enabled = false; this.parameterWrites = 0; this.generation = 0;
  }
  param(parameter, value, smooth = true) {
    if (!parameter || parameter._audioSimTarget === value) return;
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    if (smooth) parameter.setTargetAtTime(value, now, 0.02); else parameter.setValueAtTime(value, now);
    parameter._audioSimTarget = value; this.parameterWrites++;
  }
  async start(scene) {
    if (!this.Context) throw new Error('Web Audio is unavailable. Visual simulation still works.');
    const generation = ++this.generation;
    if (!this.context) {
      this.context = new this.Context({ latencyHint: 'interactive' });
      this.master = this.context.createGain(); this.master.gain.value = 0;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -6; this.compressor.knee.value = 0; this.compressor.ratio.value = 20;
      this.compressor.attack.value = 0.003; this.compressor.release.value = 0.15;
      this.master.connect(this.compressor).connect(this.context.destination);
    }
    await this.context.resume();
    if (generation !== this.generation) { await this.context.suspend(); return; }
    this.enabled = true; this.sync(scene);
  }
  async pause() {
    this.enabled = false; const generation = ++this.generation;
    if (!this.context) return;
    this.param(this.master.gain, 0);
    await new Promise(resolve => setTimeout(resolve, 80));
    if (generation === this.generation && this.context.state !== 'closed') await this.context.suspend();
  }
  makeOscillator(voice, source, start) {
    const ctx = this.context, osc = ctx.createOscillator(), fade = ctx.createGain();
    osc.frequency.value = source.frequency;
    // All oscillators share the AudioContext time origin, including speakers added later.
    const phase = radians(source.phase) + TAU * ((start * source.frequency) % 1);
    osc.setPeriodicWave(ctx.createPeriodicWave(new Float32Array([0, Math.cos(phase)]), new Float32Array([0, -Math.sin(phase)]), { disableNormalization: true }));
    fade.gain.setValueAtTime(0, start); fade.gain.linearRampToValueAtTime(1, start + 0.03);
    osc.connect(fade).connect(voice.input); osc.start(start);
    const old = voice.oscillator;
    if (old) {
      if (old.fade.gain.cancelAndHoldAtTime) old.fade.gain.cancelAndHoldAtTime(start);
      else { old.fade.gain.cancelScheduledValues(start); old.fade.gain.setValueAtTime(old.fade.gain.value, start); }
      old.fade.gain.linearRampToValueAtTime(0, start + 0.03);
      old.osc.stop(start + 0.04); this.retired.add(old);
      old.osc.onended = () => { old.osc.disconnect(); old.fade.disconnect(); this.retired.delete(old); };
    }
    voice.oscillator = { osc, fade }; voice.signature = `${source.frequency}:${source.phase}`;
  }
  removeVoice(id) {
    const voice = this.voices.get(id); if (!voice) return;
    // Mute the input before stopping/disconnecting the complete graph.
    this.param(voice.input.gain, 0);
    const { osc, fade } = voice.oscillator;
    const retired = { osc, fade, voice }; this.retired.add(retired);
    osc.onended = () => { osc.disconnect(); fade.disconnect(); voice.input.disconnect(); for (const p of voice.paths.values()) { p.delay.disconnect(); p.gain.disconnect(); p.panner.disconnect(); } this.retired.delete(retired); };
    osc.stop(this.context.currentTime + 0.08); this.voices.delete(id);
  }
  sync(scene) {
    if (!this.context || !this.enabled) return;
    const ctx = this.context, listener = scene.listener, forward = heading(listener.yaw), start = ctx.currentTime + 0.015;
    for (const axis of ['X', 'Y', 'Z']) {
      this.param(ctx.listener[`position${axis}`], listener[axis.toLowerCase()]);
      this.param(ctx.listener[`forward${axis}`], forward[axis.toLowerCase()]);
      this.param(ctx.listener[`up${axis}`], axis === 'Y' ? 1 : 0);
    }
    const active = new Set(scene.speakers.filter(s => !s.muted).map(s => s.id));
    for (const id of this.voices.keys()) if (!active.has(id)) this.removeVoice(id);
    let totalGain = 0;
    for (const source of scene.speakers) {
      if (source.muted) continue;
      let voice = this.voices.get(source.id);
      if (!voice) { voice = { input: ctx.createGain(), paths: new Map(), signature: '' }; this.voices.set(source.id, voice); }
      if (voice.signature !== `${source.frequency}:${source.phase}`) this.makeOscillator(voice, source, start);
      const wanted = new Set();
      for (const path of pathsFor(source, listener, scene)) {
        const key = path.kind === 'wall' ? `wall${path.image.wall}` : path.kind; wanted.add(key);
        let branch = voice.paths.get(key);
        if (!branch) {
          const delay = ctx.createDelay(1), gain = ctx.createGain(), panner = ctx.createPanner();
          gain.gain.value = 0; panner.panningModel = path.kind === 'direct' ? 'HRTF' : 'equalpower';
          panner.distanceModel = 'inverse'; panner.rolloffFactor = 0; // pathGain already applies distance/directivity.
          voice.input.connect(delay).connect(gain).connect(panner).connect(this.master);
          branch = { delay, gain, panner }; voice.paths.set(key, branch);
        }
        const position = path.kind === 'direct' ? source : path.points[1];
        for (const axis of ['X', 'Y', 'Z']) this.param(branch.panner[`position${axis}`], position[axis.toLowerCase()]);
        this.param(branch.delay.delayTime, path.length / SPEED_OF_SOUND);
        this.param(branch.gain.gain, path.gain); totalGain += path.gain;
      }
      // Keep silent branches reusable while dragging; there are at most 15 per source.
      for (const [key, branch] of voice.paths) if (!wanted.has(key)) this.param(branch.gain.gain, 0);
    }
    this.param(this.master.gain, dbToGain(scene.settings.master) / Math.max(1, totalGain));
  }
  diagnostics() { return { state: this.context?.state ?? 'not started', enabled: this.enabled, voices: this.voices.size, retired: this.retired.size, paths: [...this.voices.values()].reduce((sum, v) => sum + v.paths.size, 0), parameterWrites: this.parameterWrites }; }
  async dispose() {
    this.enabled = false; ++this.generation;
    if (!this.context) return;
    for (const id of [...this.voices.keys()]) this.removeVoice(id);
    await this.context.close(); this.retired.clear(); this.voices.clear(); this.context = null;
  }
}
