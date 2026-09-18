import { heading, listenerUp, activeSources, radians, TAU } from './model.js';
import { dbToGain, pathsFor, SPEED_OF_SOUND } from './acoustics.js';
// Native Web Audio only. Scene gain/delay are calculated once per edit, never per video frame.
export class AudioEngine {
  constructor(Context = globalThis.AudioContext || globalThis.webkitAudioContext, { resumeTimeout = 5000, onStateChange = () => {} } = {}) {
    this.Context = Context; this.context = null; this.voices = new Map(); this.retired = new Set();
    this.enabled = false; this.wantsAudio = false; this.parameterWrites = 0; this.generation = 0;
    this.scene = null; this.resumeTimeout = resumeTimeout; this.onStateChange = onStateChange;
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
    this.scene = scene; this.wantsAudio = true;
    const generation = ++this.generation;
    if (!this.context || this.context.state === 'closed') {
      this.disconnectAll();
      this.context = new this.Context({ latencyHint: 'interactive' });
      this.master = this.context.createGain(); this.master.gain.value = 0;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -6; this.compressor.knee.value = 0; this.compressor.ratio.value = 20;
      this.compressor.attack.value = 0.003; this.compressor.release.value = 0.15;
      this.master.connect(this.compressor).connect(this.context.destination);
      const context = this.context;
      context.onstatechange = () => {
        if (this.context !== context) return;
        // External suspension/interruption must never silently restore playback.
        if (this.enabled && context.state !== 'running') {
          this.enabled = false; this.wantsAudio = false; ++this.generation;
          if (context.state !== 'closed') {
            this.param(this.master.gain, 0, false);
            context.suspend().catch(() => {});
          }
          this.clearRetired();
        } else if (!this.wantsAudio && context.state === 'running') {
          this.param(this.master.gain, 0, false);
          context.suspend().catch(() => {});
        }
        this.onStateChange();
      };
    }
    const context = this.context;
    let timer;
    try {
      // Some browsers leave resume pending while the page is hidden. Keep the UI recoverable.
      await Promise.race([
        context.resume(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Audio start timed out. Return to this tab and try Enable audio again.')), this.resumeTimeout); }),
      ]);
      if (context !== this.context || generation !== this.generation) {
        // Only the newest intent owns suspension. An old completion must not stop a new start.
        if (context === this.context && !this.wantsAudio && context.state !== 'closed') await context.suspend();
        return;
      }
      if (context.state !== 'running') throw new Error(`Audio is ${context.state}. Enable audio again when the device is available.`);
      this.enabled = true; this.sync(this.scene);
    } catch (error) {
      if (context === this.context && generation === this.generation) {
        this.enabled = false; this.wantsAudio = false;
        this.param(this.master.gain, 0, false);
        if (context.state !== 'closed') context.suspend().catch(() => {});
      }
      throw error;
    } finally { clearTimeout(timer); this.onStateChange(); }
  }
  async pause({ immediate = false } = {}) {
    this.enabled = false; this.wantsAudio = false;
    const generation = ++this.generation, context = this.context;
    this.onStateChange();
    if (!context || context.state === 'closed') return;
    this.param(this.master.gain, 0, !immediate);
    if (!immediate && context.state === 'running') await new Promise(resolve => setTimeout(resolve, 80));
    if (context === this.context && generation === this.generation && !this.wantsAudio && context.state !== 'closed') {
      await context.suspend(); this.clearRetired(); this.onStateChange();
    }
  }
  disconnectRetired(item) {
    item.osc.onended = null;
    try { item.osc.stop(); } catch { /* The oscillator may already have ended. */ }
    item.osc.disconnect(); item.fade.disconnect();
    if (item.voice) this.disconnectVoice(item.voice);
    this.retired.delete(item);
  }
  clearRetired() { for (const item of [...this.retired]) this.disconnectRetired(item); }
  disconnectVoice(voice) {
    voice.input.disconnect();
    for (const branch of voice.paths.values()) {
      branch.delay.disconnect(); branch.gain.disconnect(); branch.panner.disconnect();
    }
    voice.paths.clear();
  }
  disconnectAll() {
    this.clearRetired();
    for (const voice of this.voices.values()) this.disconnectRetired({ ...voice.oscillator, voice });
    this.voices.clear(); this.master?.disconnect(); this.compressor?.disconnect();
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
      old.osc.onended = () => this.disconnectRetired(old);
    }
    voice.oscillator = { osc, fade }; voice.signature = `${source.frequency}:${source.phase}`;
  }
  removeVoice(id) {
    const voice = this.voices.get(id); if (!voice) return;
    // Mute the input before stopping/disconnecting the complete graph.
    this.param(voice.input.gain, 0);
    const { osc, fade } = voice.oscillator;
    const retired = { osc, fade, voice }; this.retired.add(retired);
    osc.onended = () => this.disconnectRetired(retired);
    osc.stop(this.context.currentTime + 0.08); this.voices.delete(id);
  }
  sync(scene) {
    this.scene = scene;
    if (!this.context || !this.enabled || this.context.state !== 'running') return;
    const ctx = this.context, listener = scene.listener, forward = heading(listener.yaw, listener.pitch), up = listenerUp(listener.yaw, listener.pitch), start = ctx.currentTime + 0.015;
    for (const axis of ['X', 'Y', 'Z']) {
      this.param(ctx.listener[`position${axis}`], listener[axis.toLowerCase()]);
      this.param(ctx.listener[`forward${axis}`], forward[axis.toLowerCase()]);
      this.param(ctx.listener[`up${axis}`], up[axis.toLowerCase()]);
    }
    const audible = activeSources(scene), active = new Set(audible.map(s => s.id));
    for (const id of this.voices.keys()) if (!active.has(id)) this.removeVoice(id);
    let totalGain = 0;
    for (const source of audible) {
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
    this.enabled = false; this.wantsAudio = false; ++this.generation;
    const context = this.context;
    if (!context) return;
    context.onstatechange = null;
    // Do not rely on onended after suspension/close to release retired graphs.
    this.disconnectAll(); this.context = null; this.scene = null;
    if (context.state !== 'closed') await context.close();
    this.onStateChange();
  }
}
