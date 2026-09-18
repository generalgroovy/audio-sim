import { fieldKey, createFieldJob } from './acoustics.js';
import { copy } from './model.js';
// One running job and one newest pending edit; obsolete/foreign replies cannot
// release an occupied slot. A silent/crashed worker falls back to yielding chunks.
export class FieldController {
  constructor(onResult, onStatus, WorkerClass = globalThis.Worker, { timeout = 5000 } = {}) {
    this.onResult = onResult; this.onStatus = onStatus; this.worker = null;
    this.latest = 0; this.key = null; this.pending = null; this.running = null;
    this.jobs = 0; this.completed = 0; this.fallbackTimer = null; this.watchdog = null;
    this.disposed = false; this.timeout = timeout; this.fallbackReason = null;
    try {
      if (!WorkerClass) throw new Error('Worker not supported');
      const worker = new WorkerClass(new URL('./field-worker.js', import.meta.url), { type: 'module' });
      this.worker = worker;
      worker.onmessage = ({ data }) => { if (this.worker === worker) this.finish(data); };
      worker.onerror = event => { event.preventDefault?.(); if (this.worker === worker) this.fallback('Worker unavailable'); };
      worker.onmessageerror = () => { if (this.worker === worker) this.fallback('Worker message could not be decoded'); };
    } catch { this.worker = null; }
  }
  request(scene) {
    if (this.disposed) return false;
    const key = fieldKey(scene); if (key === this.key) return false;
    this.key = key; const id = ++this.latest;
    if (scene.settings.field === 'off') { this.pending = null; this.onStatus('Map off · rendering on demand'); return true; }
    this.pending = { id, scene: copy(scene) }; this.onStatus('Updating sound map…'); this.dispatch(); return true;
  }
  dispatch() {
    if (this.running || !this.pending || this.disposed) return;
    this.running = this.pending; this.pending = null; this.jobs++;
    if (this.worker) {
      this.watchdog = setTimeout(() => this.fallback('Worker timed out'), this.timeout);
      try { this.worker.postMessage(this.running); } catch { this.fallback('Worker unavailable'); }
    } else this.startFallback();
  }
  startFallback() {
    if (!this.running || this.disposed) return;
    clearTimeout(this.fallbackTimer);
    const request = this.running;
    let job;
    try { job = createFieldJob(request.scene); }
    catch (error) { this.finish({ id: request.id, error: error.message }); return; }
    const step = () => {
      if (this.disposed || this.running !== request) return;
      if (request.id !== this.latest) { this.running = null; this.dispatch(); return; }
      try {
        // Time-budgeted, one-row units: useful on small CPUs and large scenes.
        const end = performance.now() + 6;
        let result, rows = 0;
        do { result = job.step(1); } while (!result && ++rows < 4 && performance.now() < end);
        if (result) this.finish({ id: request.id, result });
        else this.fallbackTimer = setTimeout(step, 0);
      } catch (error) { this.finish({ id: request.id, error: error.message }); }
    };
    this.fallbackTimer = setTimeout(step, 0);
  }
  fallback(reason = 'Worker unavailable') {
    if (this.disposed) return;
    clearTimeout(this.watchdog); this.watchdog = null;
    const worker = this.worker; this.worker = null;
    if (worker) { worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); }
    this.fallbackReason = reason;
    if (this.running) {
      if (this.running.id !== this.latest) { this.running = null; this.dispatch(); }
      else { this.onStatus(`${reason} · using chunked fallback…`); this.startFallback(); }
    } else this.dispatch();
  }
  finish(data) {
    if (this.disposed || !data || data.id !== this.running?.id) return;
    clearTimeout(this.watchdog); this.watchdog = null;
    this.running = null;
    if (data.id === this.latest) {
      if (data.error) { this.key = null; this.onStatus(`Map error: ${data.error}`); }
      else { this.completed++; this.onResult(data.result, !this.worker); }
    }
    this.dispatch();
  }
  dispose() {
    this.disposed = true; clearTimeout(this.watchdog); clearTimeout(this.fallbackTimer);
    this.worker?.terminate(); this.worker = null; this.running = this.pending = null;
  }
}
