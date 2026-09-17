// Playground: run a rule on files you bring yourself (drop, pick, or type). No grading and no progress;
// the files live in this tab only. The rule text and the language are remembered in localStorage.
import { EngineClient } from './engine-client.js';
import { parseRuleYaml, renderFixes } from './rules.js';
import { createRuleEditor, createTargetEditor, smallScreen } from './editors.js';
import { storage } from './storage.js';
import { escapeHtml } from './markdown.js';
import { renderMatchList } from './results.js';
import { describeError } from './grader.js';
import { bindEngineStatus, showRuleError, markErrorLine } from './ui.js';
import { sanitizeTargetPath } from '../vendor/semgrep/engine-output.js';

const $ = (id) => document.getElementById(id);
const engine = new EngineClient('./');
bindEngineStatus(engine, $('engine-status'));

const LANGS = {
  csharp: { label: 'C#', exts: ['.cs'], newName: 'Program.cs' },
  python: { label: 'Python', exts: ['.py'], newName: 'main.py' },
  cpp: { label: 'C++', exts: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hh', '.hxx'], newName: 'main.cpp' },
};
// Folders a picker or a drop walks past; the page's fine print is filled from this list.
const SKIP_DIRS = ['.git', 'node_modules', 'bin', 'obj', '__pycache__', '.venv', 'venv'];
const LIMITS = { files: 200, bytes: 1_000_000, readBatch: 8, skipDirs: new Set(SKIP_DIRS) };

// Starter content so the page is never empty (authored here, not taken from any project).
const SAMPLE = {
  csharp: {
    path: 'Sample/OrderService.cs',
    text: `using System;
using System.Data.SqlClient;

namespace Sample
{
    public class OrderService
    {
        public int Count(string customer)
        {
            var cmd = new SqlCommand("SELECT COUNT(*) FROM Orders WHERE Customer = '" + customer + "'");
            return (int)cmd.ExecuteScalar();
        }

        public int CountSafe(string customer)
        {
            var cmd = new SqlCommand("SELECT COUNT(*) FROM Orders WHERE Customer = @c");
            cmd.Parameters.AddWithValue("@c", customer);
            return (int)cmd.ExecuteScalar();
        }

        public void Log(string message)
        {
            Console.WriteLine("order: " + message);
            Console.WriteLine(message);
        }
    }
}
`,
    rule: `rules:
  - id: sql-string-concat
    languages: [csharp]
    severity: WARNING
    message: SQL text built by concatenation — use a parameter
    pattern: new SqlCommand($A + $B)
`,
  },
  python: {
    path: 'sample/main.py',
    text: `import os
import subprocess


def list_dir(path):
    os.system("ls " + path)


def list_dir_safe(path):
    subprocess.run(["ls", path], check=True)


def main():
    path = input("directory: ")
    list_dir(path)
`,
    rule: `rules:
  - id: shell-string-concat
    languages: [python]
    severity: WARNING
    message: shell command built by concatenation — pass an argument list instead
    pattern: os.system("..." + $X)
`,
  },
  cpp: {
    path: 'src/greet.cpp',
    text: `#include <cstdio>
#include <cstring>

void greet(const char* name) {
    char buf[32];
    strcpy(buf, name);
    printf(buf);
}

void greet_safe(const char* name) {
    char buf[32];
    snprintf(buf, sizeof(buf), "hello %s", name);
    printf("%s\\n", buf);
}

int main(int argc, char** argv) {
    if (argc > 1) greet(argv[1]);
    return 0;
}
`,
    rule: `rules:
  - id: unbounded-copy
    languages: [cpp]
    severity: WARNING
    message: strcpy has no length limit — use snprintf or strncpy
    pattern: strcpy(...)
`,
  },
};

const state = { lang: 'csharp', files: [], active: -1, result: null };
let ruleEd = null, targetEd = null, targetEdLang = null, running = false, saveTimer = null, settingText = false, runGen = 0;

// ---- files ---------------------------------------------------------------------------------------
// The engine reports paths exactly as given; sanitizing here only keeps the list tidy and free of duplicates.
const cleanPath = (p, fallback) => sanitizeTargetPath(p, fallback || LANGS[state.lang].newName);
const inSkippedDir = (path) => path.split('/').slice(0, -1).some((seg) => LIMITS.skipDirs.has(seg));
function fileMsg(cls, text) { $('file-messages').innerHTML = text ? `<div class="msg ${cls}">${escapeHtml(text)}</div>` : ''; }
/** Forget the last run: its highlights, its counts, and any answer still on its way. */
function invalidateResult() { runGen++; state.result = null; $('results').innerHTML = ''; if (targetEd) targetEd.clearResult(); }
const matchesFor = (path) => (state.result ? state.result.byPath.get(path) || [] : []);
/** The open file's text lives in the editor; copy it back before the list is read or changed. */
function syncActiveText() { const f = state.files[state.active]; if (f && targetEd) f.text = targetEd.get(); }

/** Insert or replace a file: {index, added}, or null when the file limit is reached. */
function insertFile(path, text) {
  path = cleanPath(path);
  const i = state.files.findIndex((f) => f.path === path);
  if (i >= 0) {
    state.files[i].text = text;
    state.files[i].dirty = false;
    if (i === state.active && targetEd) { settingText = true; targetEd.set(text); settingText = false; }
    return { index: i, added: false };
  }
  if (state.files.length >= LIMITS.files) return null;
  state.files.push({ path, text, dirty: false });
  return { index: state.files.length - 1, added: true };
}
function addFile(path, text) {
  syncActiveText();
  const ins = insertFile(path, text);
  if (!ins) { fileMsg('warn', `File limit of ${LIMITS.files} reached.`); return -1; }
  invalidateResult();
  fileMsg('', '');
  setActive(ins.index);
  return ins.index;
}
function removeFile(i) {
  if (!state.files[i]) return;
  syncActiveText();
  state.files.splice(i, 1);
  invalidateResult();
  fileMsg('', '');
  setActive(Math.min(i, state.files.length - 1));
}
function clearFiles() { state.files = []; invalidateResult(); fileMsg('', ''); setActive(-1); }
function uniqueName(base) {
  if (!state.files.some((f) => f.path === base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
  for (let n = 2; ; n++) { const p = `${stem}-${n}${ext}`; if (!state.files.some((f) => f.path === p)) return p; }
}

/** An edit to the open file: the last result no longer describes it. */
function markDirty() {
  const f = state.files[state.active];
  if (!f || f.dirty) return;
  f.dirty = true;
  if (state.result) { targetEd.clearResult(); renderFileList(); }
}
function ensureTargetEditor() {
  if (targetEd && targetEdLang === state.lang) return;
  if (targetEd) { targetEd.destroy(); $('target-editor').innerHTML = ''; }
  targetEd = createTargetEditor($('target-editor'), '', { language: state.lang, editable: true, onRun: run, onChange: () => { if (!settingText) markDirty(); } });
  targetEdLang = state.lang;
}
function setActive(i) {
  ensureTargetEditor();
  const f = state.files[i];
  state.active = f ? i : -1;
  settingText = true;
  targetEd.set(f ? f.text : '');
  settingText = false;
  $('target-name').value = f ? f.path : '';
  $('target-name').disabled = !f;
  $('remove-file').disabled = !f;
  if (f && !f.dirty) targetEd.showMatches(matchesFor(f.path));
  renderFileList();
}
function renderFileList() {
  const ul = $('filelist');
  ul.innerHTML = state.files.map((f, i) => {
    let badge = '';
    if (state.result && f.dirty) badge = '<span class="count stale" title="edited since the last run">edited</span>';
    else if (state.result) { const n = matchesFor(f.path).length; badge = `<span class="count${n ? '' : ' zero'}" title="${n} match${n === 1 ? '' : 'es'}">${n}</span>`; }
    return `<li class="${i === state.active ? 'active' : ''}"><button class="name" data-i="${i}" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</button>${badge}` +
      `<button class="remove" data-i="${i}" title="remove ${escapeHtml(f.path)}">✕</button></li>`;
  }).join('');
  ul.querySelectorAll('button.name').forEach((b) => b.addEventListener('click', () => { syncActiveText(); setActive(Number(b.dataset.i)); }));
  ul.querySelectorAll('button.remove').forEach((b) => b.addEventListener('click', () => removeFile(Number(b.dataset.i))));
  $('clear-files').classList.toggle('hidden', !state.files.length);
  $('file-count').textContent = state.files.length ? `${state.files.length} file${state.files.length === 1 ? '' : 's'}` : 'no files yet';
}
function setLang(lang) {
  if (!LANGS[lang]) return;
  syncActiveText();
  state.lang = lang;
  $('lang').value = lang;
  storage.setting('playground.lang', lang);
  engine.prefetchLanguage(lang);
  invalidateResult();
  setActive(state.active); // re-creates the editor in the new language mode, keeps the text
}

// ---- bringing files in ---------------------------------------------------------------------------
async function readTextFile(file) {
  if (file.size > LIMITS.bytes) return { skipped: 'large' };
  const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
  if (head.includes(0)) return { skipped: 'binary' };
  return { text: await file.text() };
}
/** entries: [{file, path}] from a picker or a drop. The file limit is applied before anything is read. */
async function ingest(entries, ignoredDirs = 0) {
  syncActiveText();
  const skips = { large: 0, binary: 0, limit: 0, ignored: ignoredDirs };
  const planned = new Set(state.files.map((f) => f.path)), todo = [];
  for (const { file, path } of entries) {
    const clean = cleanPath(path, file.name);
    if (inSkippedDir(clean)) { skips.ignored++; continue; }
    if (!planned.has(clean)) {
      if (planned.size >= LIMITS.files) { skips.limit++; continue; }
      planned.add(clean);
    }
    todo.push({ file, path: clean });
  }
  let added = 0, replaced = 0, last = -1;
  for (let i = 0; i < todo.length; i += LIMITS.readBatch) {
    const batch = await Promise.all(todo.slice(i, i + LIMITS.readBatch).map(async (t) => ({ path: t.path, ...(await readTextFile(t.file)) })));
    for (const r of batch) {
      if (r.skipped) { skips[r.skipped]++; continue; }
      const ins = insertFile(r.path, r.text);
      if (!ins) { skips.limit++; continue; }
      if (ins.added) added++; else replaced++;
      last = ins.index;
    }
  }
  invalidateResult();
  const parts = [];
  if (added) parts.push(`added ${added} file${added === 1 ? '' : 's'}`);
  if (replaced) parts.push(`replaced ${replaced}`);
  const sk = [];
  if (skips.binary) sk.push(`${skips.binary} binary`);
  if (skips.large) sk.push(`${skips.large} over ${LIMITS.bytes / 1e6} MB`);
  if (skips.ignored) sk.push(`${skips.ignored} in ignored folders (${SKIP_DIRS.join(', ')})`);
  if (skips.limit) sk.push(`${skips.limit} beyond the ${LIMITS.files}-file limit`);
  if (sk.length) parts.push(`skipped ${sk.join(', ')}`);
  fileMsg(sk.length ? 'warn' : '', parts.join('; ') || 'nothing to add');
  if (last >= 0) setActive(last); else renderFileList();
}
async function ingestFileList(files) {
  await ingest([...files].map((f) => ({ file: f, path: f.webkitRelativePath || f.name })));
}
async function collectEntry(entry, out, counters) {
  if (out.length >= LIMITS.files * 2) return; // far past the cap; stop walking
  if (entry.isFile) {
    const file = await new Promise((res, rej) => entry.file(res, rej));
    out.push({ file, path: entry.fullPath });
  } else if (entry.isDirectory) {
    if (LIMITS.skipDirs.has(entry.name)) { counters.ignoredDirs++; return; }
    const reader = entry.createReader();
    for (;;) { // readEntries answers in batches until an empty one
      const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await collectEntry(e, out, counters);
    }
  }
}
async function ingestDataTransfer(dt) {
  // webkitGetAsEntry must be called synchronously, before the first await
  const entries = [...(dt.items || [])].map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
  const out = [], counters = { ignoredDirs: 0 };
  if (entries.length) for (const e of entries) await collectEntry(e, out, counters);
  else for (const f of dt.files || []) out.push({ file: f, path: f.name });
  await ingest(out, counters.ignoredDirs);
}

// ---- running -------------------------------------------------------------------------------------
function setRunning(on) { running = on; $('run').disabled = on; $('stop').classList.toggle('hidden', !on); }
async function run() {
  if (running) return;
  syncActiveText();
  const parsed = parseRuleYaml(ruleEd.get(), { language: state.lang });
  const msgs = $('rule-messages');
  msgs.innerHTML = '';
  ruleEd.markError(null);
  if (parsed.error) { showRuleError(msgs, ruleEd, parsed.error); return; }
  if (!state.files.length) { msgs.innerHTML = '<div class="msg warn">Add a file first: drop one on the left, pick files, or start a new one.</div>'; return; }
  setRunning(true);
  invalidateResult();
  for (const f of state.files) f.dirty = false;
  const gen = runGen; // a file added, removed or renamed while the engine works makes the answer stale
  $('results').innerHTML = '<div class="msg">running…</div>';
  try {
    const res = await engine.runTargets(parsed.rules, state.files.map((f) => ({ path: f.path, text: f.text })), state.lang);
    if (gen !== runGen) { $('results').innerHTML = '<div class="msg warn">The files changed while the rule was running — run again.</div>'; return; }
    const byPath = new Map();
    for (const m of res.matches) { const p = m.location.path; if (!byPath.has(p)) byPath.set(p, []); byPath.get(p).push(m); }
    for (const f of state.files) if (byPath.has(f.path)) renderFixes(byPath.get(f.path), parsed.rules, f.text);
    state.result = { ...res, byPath };
    renderResults(res, parsed.warnings);
    renderFileList();
    const f = state.files[state.active];
    if (f && !f.dirty) targetEd.showMatches(byPath.get(f.path) || []);
    if (smallScreen()) $('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    $('results').innerHTML = e && e.message === 'run cancelled' ? '<div class="msg">stopped</div>' : `<div class="msg error">${escapeHtml(String(e.message || e))}</div>`;
  } finally {
    setRunning(false);
  }
}
function renderResults(res, warnings) {
  const out = [];
  if (warnings && warnings.length) out.push(`<div class="msg warn">${warnings.map(escapeHtml).join('<br>')}</div>`);
  const n = res.matches.length, k = state.files.length;
  const hit = new Set(res.matches.map((m) => m.location.path)).size;
  const ruleErrors = res.errors.filter((e) => !e.path);
  if (n || !ruleErrors.length) {
    out.push(`<div class="summary ${n ? 'hit' : 'none'}">${n ? '●' : '○'} ${n} match${n === 1 ? '' : 'es'} in ${hit} of ${k} file${k === 1 ? '' : 's'} (${res.ms} ms)</div>`);
  } else {
    out.push('<div class="verdict error">Semgrep could not run this rule</div>');
  }
  const { exts, label } = LANGS[state.lang];
  const foreign = state.files.filter((f) => !exts.some((e) => f.path.toLowerCase().endsWith(e))).length;
  const extList = exts.length === 1 ? exts[0] : exts.slice(0, -1).join(', ') + ' or ' + exts[exts.length - 1];
  if (foreign) out.push(`<div class="msg warn">${foreign} of ${k} file${k === 1 ? '' : 's'} ${foreign === 1 ? 'does' : 'do'} not end in ${extList}. A file the ${label} parser cannot read yields no matches and, unless it parses partially, no error.</div>`);
  for (const e of res.errors) out.push(`<div class="msg error">${e.path ? `<b>${escapeHtml(e.path)}</b>: ` : ''}${escapeHtml(describeError(e))}</div>`);
  out.push(renderMatchList(res.matches, { showPath: k > 1 }));
  $('results').innerHTML = out.join('');
  markErrorLine(ruleEd, ruleErrors);
}
function saveRule(t) { clearTimeout(saveTimer); saveTimer = setTimeout(() => storage.setting('playground.rule', t), 300); }

// ---- wiring --------------------------------------------------------------------------------------
$('run').addEventListener('click', run);
$('stop').addEventListener('click', () => engine.cancel());
$('lang').addEventListener('change', () => setLang($('lang').value));
$('reset').addEventListener('click', () => {
  syncActiveText();
  ruleEd.set(SAMPLE[state.lang].rule);
  if (!state.files.length) insertFile(SAMPLE[state.lang].path, SAMPLE[state.lang].text);
  $('rule-messages').innerHTML = '';
  invalidateResult();
  setActive(state.active < 0 ? 0 : state.active);
  ruleEd.focus();
});
$('pick-files').addEventListener('click', () => $('file-input').click());
$('pick-dir').addEventListener('click', () => $('dir-input').click());
$('file-input').addEventListener('change', (e) => { ingestFileList(e.target.files); e.target.value = ''; });
$('dir-input').addEventListener('change', (e) => { ingestFileList(e.target.files); e.target.value = ''; });
if (!('webkitdirectory' in document.createElement('input'))) $('pick-dir').classList.add('hidden');
$('new-file').addEventListener('click', () => {
  const i = addFile(uniqueName(LANGS[state.lang].newName), '');
  if (i >= 0) targetEd.view.focus();
});
$('clear-files').addEventListener('click', clearFiles);
$('remove-file').addEventListener('click', () => removeFile(state.active));
$('target-name').addEventListener('change', () => {
  const f = state.files[state.active];
  if (!f) return;
  const p = cleanPath($('target-name').value, f.path);
  if (p !== f.path && state.files.some((o) => o.path === p)) { fileMsg('warn', `There is already a file named ${p}.`); $('target-name').value = f.path; return; }
  f.path = p;
  $('target-name').value = p;
  fileMsg('', '');
  invalidateResult();
  renderFileList();
});
// a drop anywhere on the files pane adds files; a drop elsewhere must not navigate the tab
const pane = $('files-pane'), zone = $('dropzone');
let dragDepth = 0;
pane.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; zone.classList.add('dragover'); });
pane.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
pane.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; zone.classList.remove('dragover'); } });
pane.addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; zone.classList.remove('dragover'); ingestDataTransfer(e.dataTransfer); });
document.addEventListener('dragover', (e) => { if (!pane.contains(e.target)) e.preventDefault(); });
document.addEventListener('drop', (e) => { if (!pane.contains(e.target)) e.preventDefault(); });
// both editors bind Mod-Enter themselves; this catches the shortcut when the focus is elsewhere
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !(e.target.closest && e.target.closest('.cm-editor'))) { e.preventDefault(); run(); }
});

function init() {
  $('skip-list').textContent = SKIP_DIRS.join(', ');
  const h = storage.handoff();
  let lang = (h && h.lang) || storage.setting('playground.lang') || 'csharp';
  if (!LANGS[lang]) lang = 'csharp';
  state.lang = lang;
  $('lang').value = lang;
  const rule = (h && typeof h.rule === 'string' && h.rule) || storage.setting('playground.rule') || SAMPLE[lang].rule;
  if (h) { storage.setting('playground.lang', lang); storage.setting('playground.rule', rule); } // what came over is what the page remembers from now on
  ruleEd = createRuleEditor($('rule-editor'), rule, { onRun: run, onChange: (t) => { $('rule-messages').innerHTML = ''; saveRule(t); } });
  if (h && Array.isArray(h.files)) for (const f of h.files) if (f && typeof f.text === 'string') insertFile(f.path, f.text);
  if (!state.files.length) insertFile(SAMPLE[lang].path, SAMPLE[lang].text);
  setActive(0);
  engine.load().then(() => engine.prefetchLanguage(state.lang)).catch(() => {});
}
init();
// Debug / test hooks (used by scripts/browser-test.mjs and scripts/network_check.mjs)
window.__playground = { get state() { return state; }, get files() { syncActiveText(); return state.files; }, addFile, removeFile, clearFiles, setLang,
  get ruleEd() { return ruleEd; }, get targetEd() { return targetEd; }, run, engine };
