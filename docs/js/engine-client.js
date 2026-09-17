// Main-thread facade for the engine worker: download progress, lazy start, serialized runs, timeout, cancel.
const VENDOR_FILES = [
  ['vendor/semgrep/engine-1.81.0.mjs', 6351287],
  ['vendor/semgrep/csharp-1.81.0.mjs', 3351311],
  ['vendor/semgrep/csharp-1.81.0.wasm', 5693063],
  ['vendor/semgrep/python-1.81.0.mjs', 3823434],
  ['vendor/semgrep/python-1.81.0.wasm', 425874],
];
// Parsers the worker loads on demand; prefetchLanguage() warms the cache with progress so the first run is quick.
const LANGUAGE_FILES = {
  cpp: [['vendor/semgrep/cpp-1.81.0.mjs', 5157751], ['vendor/semgrep/cpp-1.81.0.wasm', 3887500]],
};
LANGUAGE_FILES.c = LANGUAGE_FILES.cpp;
// A run gets 20 s plus 2 s per target file, at most two minutes. A download that makes no progress for a
// minute, or a worker that does not report ready within a minute of starting, counts as failed.
const RUN_TIMEOUT_BASE_MS = 20000, RUN_TIMEOUT_PER_FILE_MS = 2000, RUN_TIMEOUT_MAX_MS = 120000;
const STALL_MS = 60000, START_TIMEOUT_MS = 60000;

export class EngineClient {
  constructor(base = './') {
    this.base = base;
    this.worker = null;
    this.readyPromise = null;
    this.pending = new Map(); // id → {resolve, reject, timer, posted}
    this.nextId = 1;
    this.status = 'idle'; // idle | downloading | starting | ready | fatal
    this.listeners = new Set();
    this.timings = null;
    this.prefetched = new Map(); // language → promise of its on-demand files being in the cache
  }
  onStatus(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(extra = {}) { for (const fn of this.listeners) fn({ status: this.status, ...extra }); }
  /** A run is waiting for the engine or for its answer. */
  get busy() { return this.pending.size > 0; }

  /** Warm the HTTP cache with byte-level progress so the worker's import() is instant. */
  prefetch(onProgress) { return this._fetchAll(VENDOR_FILES, onProgress); }

  /** Warm the cache for a parser that loads on demand; resolves at once for languages that load at start or need no parser. */
  prefetchLanguage(lang) {
    const files = LANGUAGE_FILES[lang];
    if (!files) return Promise.resolve();
    if (!this.prefetched.has(lang)) {
      this.prefetched.set(lang, (async () => {
        await this.load();
        await this._fetchAll(files, (p) => this._emit({ stage: lang, progress: p }));
        this._emit();
      })().catch((e) => {
        this.prefetched.delete(lang);
        if (this.status === 'ready') this._emit({ message: String(e.message || e) });
      }));
    }
    return this.prefetched.get(lang);
  }

  async _fetchAll(files, onProgress) {
    const total = files.reduce((a, [, s]) => a + s, 0);
    let done = 0, lastProgress = Date.now();
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const watchdog = setInterval(() => { if (ctrl && Date.now() - lastProgress > STALL_MS) ctrl.abort(); }, 5000);
    try {
      for (const [rel] of files) {
        const res = await fetch(this.base + rel, { cache: 'force-cache', signal: ctrl ? ctrl.signal : undefined });
        if (!res.ok) throw new Error(`failed to download ${rel}: HTTP ${res.status}`);
        if (!res.body) continue;
        const reader = res.body.getReader();
        for (;;) {
          const { done: end, value } = await reader.read();
          if (end) break;
          done += value.length;
          lastProgress = Date.now();
          onProgress && onProgress(total ? Math.min(1, done / total) : 0, rel);
        }
      }
    } catch (e) {
      throw ctrl && ctrl.signal.aborted ? new Error(`the download made no progress for ${STALL_MS / 1000}s`) : e;
    } finally {
      clearInterval(watchdog);
    }
    onProgress && onProgress(1, '');
  }

  /** Download and start the engine once; a failed start is forgotten so the next run can try again. */
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
        let startTimer = null;
        const fail = (message) => {
          clearTimeout(startTimer);
          if (this.worker) this.worker.terminate();
          this.worker = null;
          this.status = 'fatal';
          this._emit({ message });
          reject(new Error(message));
        };
        try {
          this.worker = new Worker(new URL('../vendor/semgrep/semgrep-worker.js', import.meta.url), { type: 'module' });
        } catch (e) {
          fail('cannot start worker: ' + String(e.message || e));
          return;
        }
        startTimer = setTimeout(() => fail(`the engine did not start within ${START_TIMEOUT_MS / 1000}s`), START_TIMEOUT_MS);
        this.worker.onerror = (e) => fail(e.message || 'worker error');
        this.worker.onmessage = (ev) => {
          const m = ev.data || {};
          if (m.type === 'progress') this._emit({ stage: m.stage });
          else if (m.type === 'ready') { clearTimeout(startTimer); this.status = 'ready'; this.timings = m.timings; this._emit({ timings: m.timings }); resolve(); }
          else if (m.type === 'fatal') fail(m.message);
          else if (m.type === 'result') {
            const p = this.pending.get(m.id);
            if (p) { clearTimeout(p.timer); this.pending.delete(m.id); p.resolve({ matches: m.matches, errors: m.errors, ms: m.ms }); }
            this._emit(); // a parser loaded on demand during the run leaves the pill saying so
          } else if (m.type === 'log') console.info('[engine]', m.message);
        };
        this.worker.postMessage({ type: 'init' });
      });
    })().catch((e) => { this.readyPromise = null; throw e; });
    return this.readyPromise;
  }

  _failPending(error) {
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const p of pending) { clearTimeout(p.timer); p.reject(error); }
  }
  /** Kill the worker (a hung or cancelled run), fail every pending run; the next run starts a fresh worker. */
  _restart(message, error) {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.status = 'idle';
    this._failPending(error);
    this._emit({ message });
  }
  /** Abort the run in progress: a run the worker is chewing on restarts the worker, a run still waiting for the engine is simply dropped. */
  cancel() {
    if (!this.busy) return;
    if ([...this.pending.values()].some((p) => p.posted)) this._restart('run cancelled; engine restarted', new Error('run cancelled'));
    else this._failPending(new Error('run cancelled'));
  }

  /** The rules on one file (the challenge page). @returns {Promise<{matches:any[], errors:any[], ms:number}>} */
  run(rules, target, targetPath) { return this.runTargets(rules, [{ path: targetPath, text: target }], 'csharp'); }

  /** The rules on several files, parsed as `lang`. @param {{path:string, text:string}[]} targets */
  runTargets(rules, targets, lang = 'csharp') {
    const id = this.nextId++;
    const timeoutMs = Math.min(RUN_TIMEOUT_MAX_MS, RUN_TIMEOUT_BASE_MS + RUN_TIMEOUT_PER_FILE_MS * targets.length);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, timer: null, posted: false });
      this.load().then(() => {
        const p = this.pending.get(id);
        if (!p) return; // cancelled while the engine was loading
        p.posted = true;
        p.timer = setTimeout(() => this._restart('run timed out; engine restarted',
          new Error(`the engine did not answer within ${Math.round(timeoutMs / 1000)}s (pattern too expensive?); it was restarted — try again`)), timeoutMs);
        this.worker.postMessage({ type: 'run', id, rules, lang, targets });
      }, (e) => { if (this.pending.delete(id)) reject(e); });
    });
  }
}
