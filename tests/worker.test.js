import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { FieldController } from '../src/field-controller.js';
import { computeField } from '../src/acoustics.js';
import { preset, copy } from '../src/model.js';
class MockWorker {
  static instance;
  constructor() { MockWorker.instance = this; this.sent = []; }
  postMessage(data) { this.sent.push(data); }
  terminate() { this.terminated = true; }
  finish(data) { this.onmessage({ data }); }
}
test('coalesces rapid edits into one in-flight job and only the latest pending scene', () => {
  const results = [], c = new FieldController(r => results.push(r), () => {}, MockWorker), s = preset(); c.request(s);
  for (let i = 0; i < 12; i++) { s.speakers[0].frequency++; c.request(s); }
  const w = MockWorker.instance; assert.equal(w.sent.length, 1); assert.equal(c.jobs, 1);
  w.finish({ id: 1, result: 'stale' }); assert.deepEqual(results, []); assert.equal(w.sent.length, 2); assert.equal(w.sent[1].scene.speakers[0].frequency, 92);
  w.finish({ id: c.latest, result: 'latest' }); assert.deepEqual(results, ['latest']); c.dispose();
});
test('mode, listener and selection changes do not recompute a map', () => { const c = new FieldController(() => {}, () => {}, MockWorker), s = preset(); c.request(s); s.listener.x++; s.settings.mode = '3d'; s.selected = '2'; c.request(s); assert.equal(c.latest, 1); c.dispose(); });
test('turning map off invalidates outstanding results', () => { const results = [], c = new FieldController(r => results.push(r), () => {}, MockWorker), s = preset(); c.request(s); s.settings.field = 'off'; c.request(s); MockWorker.instance.finish({ id: 1, result: 'stale' }); assert.deepEqual(results, []); assert.equal(c.running, null); c.dispose(); });
test('chunked fallback yields and returns the same field', async () => { const s = preset(); let yields = 0; const interval = setInterval(() => yields++, 0); let controller; const result = await new Promise(resolve => { controller = new FieldController(resolve, () => {}, null); controller.request(s); }); clearInterval(interval); assert.ok(yields > 1); assert.deepEqual(result.values, computeField(s).values); controller.dispose(); });
test('failed worker falls back instead of leaving an endless busy state', async () => { let c; const result = await new Promise(resolve => { c = new FieldController(resolve, () => {}, MockWorker); c.request(preset()); MockWorker.instance.onerror({ preventDefault() {} }); }); assert.ok(result.values.length > 0); assert.equal(c.worker, null); assert.equal(c.running, null); c.dispose(); });
test('worker module computes and transfers results on an actual background thread', async () => {
  const s = preset(), expected = computeField(s);
  const script = `import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)}; await import(${JSON.stringify(new URL('../src/field-worker.js', import.meta.url).href)}); parentPort.on('message', data=>self.onmessage({data}));`;
  const worker = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(script)}`));
  try { const result = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); worker.postMessage({ id: 7, scene: s }); }); assert.equal(result.id, 7); assert.deepEqual(result.result.values, expected.values); }
  finally { await worker.terminate(); }
});
