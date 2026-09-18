import { fieldKey, createFieldJob } from './acoustics.js';
import { copy } from './model.js';
// At most one in-flight worker request + one newest pending scene; stale results
// cannot overwrite a newer edit. Fallback yields between four-row chunks.
export class FieldController {
  constructor(onResult, onStatus, WorkerClass = globalThis.Worker) {
    this.onResult = onResult; this.onStatus = onStatus; this.worker = null;
    this.latest = 0; this.key = null; this.pending = null; this.running = null;
    this.jobs = 0; this.completed = 0; this.fallbackTimer = null; this.disposed = false;
    try {
      if (!WorkerClass) throw new Error('Worker not supported');
      this.worker = new WorkerClass(new URL('./field-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => this.finish(data);
      this.worker.onerror = event => { event.preventDefault?.(); this.fallback(); };
    } catch { this.worker = null; }
  }
  request(scene) {
    if (this.disposed) return;
    const key = fieldKey(scene); if (key === this.key) return;
    this.key = key; const id = ++this.latest;
    if (scene.settings.field === 'off') { this.pending = null; this.onStatus('Map off · rendering on demand'); return; }
    this.pending = { id, scene: copy(scene) }; this.onStatus('Updating sound map…'); this.dispatch();
  }
  dispatch() {
    if (this.running || !this.pending || this.disposed) return;
    this.running = this.pending; this.pending = null; this.jobs++;
    if (this.worker) { try { this.worker.postMessage(this.running); } catch { this.fallback(); } }
    else this.startFallback();
  }
  startFallback() {
    const request = this.running, job = createFieldJob(request.scene);
    const step = () => {
      if (this.disposed) return;
      if (request.id !== this.latest) { this.running = null; this.dispatch(); return; }
      try {
        const result = job.step(4);
        if (result) this.finish({ id: request.id, result });
        else this.fallbackTimer = setTimeout(step, 0);
      } catch (error) { this.finish({ id: request.id, error: error.message }); }
    };
    this.fallbackTimer = setTimeout(step, 0);
  }
  fallback() {
    this.worker?.terminate(); this.worker = null;
    if (this.running) this.startFallback(); else this.dispatch();
  }
  finish(data) {
    if (this.disposed) return;
    this.running = null;
    if (data.id === this.latest) {
      if (data.error) { this.key = null; this.onStatus(`Map error: ${data.error}`); }
      else { this.completed++; this.onResult(data.result, !this.worker); }
    }
    this.dispatch();
  }
  dispose() { this.disposed = true; this.worker?.terminate(); clearTimeout(this.fallbackTimer); this.running = this.pending = null; }
}
