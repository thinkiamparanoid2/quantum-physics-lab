// Runs a long simulation off the main thread so the page stays responsive. The function must be
// exported by a module (pass its URL, e.g. new URL('../lib/qec.js', import.meta.url)) and take
// (args, reportProgress); args and the result must be structured-clonable (typed arrays are fine).
// Returns { promise, cancel }. Without Worker support it runs on the main thread instead.

export function runTask(moduleUrl, fn, args, { onProgress } = {}) {
  const module = String(moduleUrl);
  if (typeof Worker === 'undefined') {
    const promise = import(module).then((m) => m[fn](args, (p) => onProgress?.(p)));
    return { promise, cancel() {} };
  }
  const worker = new Worker(new URL('./task-worker.js', import.meta.url), { type: 'module' });
  let settle;
  const promise = new Promise((resolve, reject) => {
    settle = { resolve, reject };
    worker.onmessage = ({ data }) => {
      if ('progress' in data) onProgress?.(data.progress);
      else {
        worker.terminate();
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
  });
  worker.postMessage({ module, fn, args });
  return {
    promise,
    cancel() {
      worker.terminate();
      settle.reject(new Error('cancelled'));
    },
  };
}
