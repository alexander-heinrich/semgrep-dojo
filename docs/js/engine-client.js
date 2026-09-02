// Main-thread facade for the engine worker: download progress, lazy start, serialized runs, timeout.
const VENDOR_FILES = [
  ['vendor/semgrep/engine-1.17.1-alpha.2.mjs', 4709490],
  ['vendor/semgrep/csharp-1.17.1-alpha.0.mjs', 8869263],
  ['vendor/semgrep/python-0.0.4.mjs', 3223869],
  ['vendor/semgrep/semgrep-parser.wasm', 432026],
];
const RUN_TIMEOUT_MS = 20000;

export class EngineClient {
  constructor(base = './') {
    this.base = base;
    this.worker = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.nextId = 1;
    this.status = 'idle'; // idle | downloading | starting | ready | fatal
    this.listeners = new Set();
    this.timings = null;
  }
  onStatus(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(extra = {}) { for (const fn of this.listeners) fn({ status: this.status, ...extra }); }

  /** Warm the HTTP cache with byte-level progress so the worker's import() is instant. */
  async prefetch(onProgress) {
    const total = VENDOR_FILES.reduce((a, [, s]) => a + s, 0);
    let done = 0;
    for (const [rel] of VENDOR_FILES) {
      const res = await fetch(this.base + rel, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`failed to download ${rel}: HTTP ${res.status}`);
      if (!res.body) { done += 0; continue; }
      const reader = res.body.getReader();
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        done += value.length;
        onProgress && onProgress(Math.min(1, done / total), rel);
      }
    }
    onProgress && onProgress(1, '');
  }

  load() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      this.status = 'downloading';
      this._emit({ progress: 0 });
      try {
        await this.prefetch((p) => this._emit({ progress: p }));
      } catch (e) {
        this.status = 'fatal';
        this._emit({ message: String(e.message || e) });
        throw e;
      }
      this.status = 'starting';
      this._emit({ progress: 1 });
      await new Promise((resolve, reject) => {
        try {
          this.worker = new Worker(new URL('./semgrep-worker.js', import.meta.url), { type: 'module' });
        } catch (e) {
          this.status = 'fatal';
          this._emit({ message: 'cannot start worker: ' + String(e.message || e) });
          reject(e);
          return;
        }
        this.worker.onerror = (e) => {
          this.status = 'fatal';
          this._emit({ message: e.message || 'worker error' });
          reject(new Error(e.message || 'worker error'));
        };
        this.worker.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.type === 'progress') this._emit({ stage: m.stage });
          else if (m.type === 'ready') { this.status = 'ready'; this.timings = m.timings; this._emit({ timings: m.timings }); resolve(); }
          else if (m.type === 'fatal') { this.status = 'fatal'; this._emit({ message: m.message }); reject(new Error(m.message)); }
          else if (m.type === 'result') {
            const p = this.pending.get(m.id);
            if (p) { clearTimeout(p.timer); this.pending.delete(m.id); p.resolve({ matches: m.matches, errors: m.errors, ms: m.ms }); }
          } else if (m.type === 'log') console.info('[engine]', m.message);
        };
        this.worker.postMessage({ type: 'init' });
      });
    })();
    return this.readyPromise;
  }

  /** @returns {Promise<{matches:any[], errors:any[], ms:number}>} */
  async run(rules, target, targetPath) {
    await this.load();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.worker.terminate();
        this.worker = null;
        this.readyPromise = null;
        this.status = 'idle';
        this._emit({ message: 'run timed out; engine restarted' });
        reject(new Error(`the engine did not answer within ${RUN_TIMEOUT_MS / 1000}s (pattern too expensive?); it was restarted — try again`));
      }, RUN_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: 'run', id, rules, target, targetPath });
    });
  }
}
