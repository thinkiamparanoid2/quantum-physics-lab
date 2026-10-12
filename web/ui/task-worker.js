// Worker side of ui/worker.js: imports the requested module and runs one exported function.
self.onmessage = async ({ data }) => {
  try {
    const mod = await import(data.module);
    const result = await mod[data.fn](data.args, (progress) => self.postMessage({ progress }));
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: String(error?.stack ?? error) });
  }
};
