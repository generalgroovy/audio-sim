import { computeField } from './acoustics.js';
self.onmessage = ({ data }) => {
  try { const result = computeField(data.scene); self.postMessage({ id: data.id, result }, [result.values.buffer]); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
