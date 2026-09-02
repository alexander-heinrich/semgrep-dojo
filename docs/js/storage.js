// Per-browser progress in localStorage (guarded: private mode / blocked storage → in-memory only).
const KEY = 'semgrep-dojo.v1';
let mem = null;

function read() {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(KEY);
    mem = raw ? JSON.parse(raw) : { progress: {}, settings: {} };
  } catch {
    mem = { progress: {}, settings: {} };
  }
  if (!mem.progress) mem.progress = {};
  if (!mem.settings) mem.settings = {};
  return mem;
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* ignore */ }
}

export const storage = {
  progress(id) { return read().progress[id] || { status: 'new', attempts: 0 }; },
  all() { return read().progress; },
  attempt(id, lastRule) {
    const p = { ...this.progress(id) };
    p.attempts = (p.attempts || 0) + 1;
    if (p.status === 'new') p.status = 'attempted';
    if (lastRule !== undefined) p.lastRule = lastRule;
    read().progress[id] = p; write();
    return p;
  },
  solved(id, withHelp = false, lastRule) {
    const p = { ...this.progress(id) };
    if (p.status !== 'solved') p.status = withHelp ? 'solved-with-help' : 'solved';
    p.solvedAt = p.solvedAt || new Date().toISOString();
    if (lastRule !== undefined) p.lastRule = lastRule;
    read().progress[id] = p; write();
    return p;
  },
  usedHelp(id) {
    const p = { ...this.progress(id) };
    p.help = true;
    read().progress[id] = p; write();
  },
  setting(k, v) {
    if (v === undefined) return read().settings[k];
    read().settings[k] = v; write();
    return v;
  },
  reset() { mem = { progress: {}, settings: {} }; write(); },
};
