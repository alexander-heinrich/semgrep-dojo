import { EngineClient } from './engine-client.js';
import { parseRuleYaml, renderFixes } from './rules.js';
import { grade } from './grader.js';
import { annotationLines } from './annotations.js';
import { createRuleEditor, createTargetEditor, smallScreen } from './editors.js';
import { storage } from './storage.js';
import { md, escapeHtml } from './markdown.js';

const $ = (id) => document.getElementById(id);
const data = await (await fetch('data/challenges.json')).json();
const all = data.challenges;
const engine = new EngineClient('./');

let ch = null, ruleEd = null, targetEd = null, hintsShown = 0, solutionShown = false;

function currentId() { return decodeURIComponent(location.hash.replace(/^#\/?/, '')); }
function linkTo(c) { return `#/${c.id}`; }
const dots = (n) => '●'.repeat(n) + '○'.repeat(5 - n);

function renderStatus({ status, progress, stage, message, timings }) {
  const el = $('engine-status');
  el.className = 'pill ' + status;
  if (status === 'downloading') el.textContent = `engine: downloading ${Math.round((progress || 0) * 100)}%`;
  else if (status === 'starting') el.textContent = `engine: starting${stage ? ' (' + stage + ')' : ''}`;
  else if (status === 'ready') el.textContent = 'engine: ready';
  else if (status === 'fatal') el.textContent = 'engine: failed';
  else el.textContent = 'engine: idle';
  if (message) el.title = message; else if (timings) el.title = `ready in ${timings.python || timings.csharp} ms`;
}
engine.onStatus(renderStatus);

function load() {
  const id = currentId();
  ch = all.find((c) => c.id === id) || all[0];
  if (!ch) { document.body.innerHTML = '<p>No challenges built yet.</p>'; return; }
  if (ch.id !== id) history.replaceState(null, '', linkTo(ch));
  hintsShown = 0; solutionShown = false;
  document.title = `${ch.title} — Semgrep Dojo`;
  $('crumb-level').textContent = `${ch.level}. ${ch.level_name}`;
  $('crumb-title').textContent = ch.title;
  $('title').textContent = ch.title;
  $('difficulty').innerHTML = `<span title="difficulty ${ch.difficulty}/5">${dots(ch.difficulty)}</span>`;
  $('tags').innerHTML = ch.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  $('instructions').innerHTML = md(ch.instructions);
  $('followup').classList.add('hidden');
  $('followup').innerHTML = '';
  $('results').innerHTML = '';
  $('rule-messages').innerHTML = '';
  renderHints();
  renderAttribution();
  const idx = all.indexOf(ch);
  const prev = all[idx - 1], next = all[idx + 1];
  $('prev').style.visibility = prev ? '' : 'hidden'; if (prev) $('prev').href = linkTo(prev);
  $('next').style.visibility = next ? '' : 'hidden'; if (next) $('next').href = linkTo(next);
  $('target-name').textContent = ch.target_path;

  const saved = storage.progress(ch.id);
  const initial = saved.lastRule && saved.status !== 'solved' ? saved.lastRule : ch.starter;
  if (ruleEd) ruleEd.set(initial); else ruleEd = createRuleEditor($('rule-editor'), initial, { onRun: run, onChange: () => { $('rule-messages').innerHTML = ''; } });
  if (targetEd) { targetEd.view.destroy(); $('target-editor').innerHTML = ''; }
  targetEd = createTargetEditor($('target-editor'), ch.target);
  targetEd.showExpectations({ expected: ch.expected.ruleidLines, ok: ch.expected.okLines, todo: ch.wasm === 'todo' ? ch.expected.todoLines : [],
    annotations: annotationLines(ch.target) });
  const firstExpected = ch.expected.ruleidLines[0] || ch.expected.okLines[0];
  if (firstExpected) targetEd.scrollToLine(firstExpected);

  const cli = $('cli-box');
  if (ch.wasm === 'cli-only') {
    $('run').disabled = true;
    cli.classList.remove('hidden');
    cli.innerHTML = `<strong>CLI only.</strong> This feature does not work in the browser engine (see <a href="about.html#engine">About</a>).
      Practice it with the real Semgrep CLI:<pre>python3 scripts/check.py challenges/${escapeHtml(ch.id)} --start
python3 scripts/check.py challenges/${escapeHtml(ch.id)} workspace/${escapeHtml(ch.slug)}/rule.yaml</pre>`;
  } else {
    $('run').disabled = false;
    cli.classList.add('hidden');
    cli.innerHTML = '';
    engine.load().catch(() => {});
  }
}

function renderHints() {
  const el = $('hints');
  const shown = ch.hints.slice(0, hintsShown);
  el.innerHTML = shown.map((h, i) => `<div class="hint"><span class="hint-n">Hint ${i + 1}</span> ${md(h)}</div>`).join('') +
    (hintsShown < ch.hints.length ? `<button id="hint-btn" class="link">Show hint ${hintsShown + 1} of ${ch.hints.length}</button>` : '');
  const b = $('hint-btn');
  if (b) b.addEventListener('click', () => { hintsShown++; storage.usedHelp(ch.id); renderHints(); });
}
function renderAttribution() {
  // on a phone the attribution sits between the instructions and the editors, so keep it folded there
  $('attribution').innerHTML = `<details${smallScreen() ? '' : ' open'}><summary class="attr-title">Target code</summary>` + ch.sources.map((s) =>
    `<div class="attr"><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.repo)}</a> — <code>${escapeHtml(s.path)}</code> @ <code>${escapeHtml(String(s.commit).slice(0, 10))}</code>
     · ${escapeHtml(s.license)}${s.copyright ? ' · © ' + escapeHtml(s.copyright) : ''}${s.modified ? ` · <em>modified</em>${s.modification_note ? ': ' + escapeHtml(s.modification_note) : ''}` : ' · unmodified'}</div>`).join('') + '</details>';
}

let running = false;
async function run() {
  if (running || !ch || ch.wasm === 'cli-only') return;
  const text = ruleEd.get();
  const parsed = parseRuleYaml(text);
  const msgs = $('rule-messages');
  msgs.innerHTML = '';
  ruleEd.markError(null);
  if (parsed.error) {
    msgs.innerHTML = `<div class="msg error">${escapeHtml(parsed.error.message)}${parsed.error.line ? ` (line ${parsed.error.line})` : ''}</div>`;
    if (parsed.error.line) ruleEd.markError(parsed.error.line);
    return;
  }
  running = true;
  $('run').disabled = true;
  $('results').innerHTML = '<div class="msg">running…</div>';
  try {
    const res = await engine.run(parsed.rules, ch.target, ch.target_path);
    renderFixes(res.matches, parsed.rules, ch.target);
    const g = grade(res, ch.expected, { wasm: ch.wasm });
    storage.attempt(ch.id, text);
    showResult(g, res, parsed.warnings);
    if (smallScreen() && g.status !== 'pass') $('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (g.status === 'pass') {
      storage.solved(ch.id, solutionShown, text);
      $('followup').classList.remove('hidden');
      $('followup').innerHTML = `<h2>${escapeHtml(ch.followup_title)}</h2>${md(ch.followup)}` +
        ($('next').style.visibility !== 'hidden' ? `<p><a class="button primary" href="${$('next').getAttribute('href')}">Next challenge →</a></p>` : '<p>You finished the last challenge in the catalogue. 🎉</p>');
      $('followup').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (e) {
    $('results').innerHTML = `<div class="msg error">${escapeHtml(String(e.message || e))}</div>`;
  } finally {
    running = false;
    $('run').disabled = false;
  }
}

function lineText(n) { return (ch.target.split('\n')[n - 1] || '').trim(); }
function showResult(g, res, warnings) {
  const out = [];
  if (warnings && warnings.length) out.push(`<div class="msg warn">${warnings.map(escapeHtml).join('<br>')}</div>`);
  if (g.status === 'error') {
    out.push(`<div class="verdict error">Semgrep could not run this rule</div>` + g.errors.map((e) => `<div class="msg error">${escapeHtml(e)}</div>`).join(''));
    const m = /line (\d+)/.exec(g.errors.join(' '));
    targetEd.clearResult();
    $('results').innerHTML = out.join('');
    if (m) ruleEd.markError(Number(m[1]));
    return;
  }
  targetEd.showResult(g);
  const n = g.matchedLines.length;
  if (g.status === 'pass') out.push(`<div class="verdict pass">✔ Correct — ${n} match${n === 1 ? '' : 'es'}, exactly the expected line${n === 1 ? '' : 's'} (${res.ms} ms)</div>`);
  else out.push(`<div class="verdict fail">✖ Not yet — ${n} match${n === 1 ? '' : 'es'}, ${g.missed.length} missed, ${g.unexpected.length} unexpected (${res.ms} ms)</div>`);
  if (g.missed.length) out.push(`<div class="bucket missed"><div class="bucket-title">Missed (false negatives)</div>${g.missed.map((l) => `<div class="line"><span class="ln">${l}</span><code>${escapeHtml(lineText(l))}</code></div>`).join('')}</div>`);
  if (g.unexpected.length) out.push(`<div class="bucket unexpected"><div class="bucket-title">Unexpected (false positives)</div>${g.unexpected.map((l) => `<div class="line"><span class="ln">${l}</span><code>${escapeHtml(lineText(l))}</code>${g.unexpectedOk.includes(l) ? ' <span class="note">marked <b>ok</b> in the target</span>' : ''}</div>`).join('')}</div>`);
  if (g.details && g.details.length) for (const d of g.details) {
    if (d.kind === 'ranges') out.push(`<div class="bucket unexpected"><div class="bucket-title">Right lines, wrong ranges</div><div class="line">expected ranges ${escapeHtml(JSON.stringify(d.missingRanges))} but got ${escapeHtml(JSON.stringify(d.extraRanges))} (line:col-line:col). Hint: <code>focus-metavariable</code> changes what is reported.</div></div>`);
    if (d.kind === 'fixes') out.push(`<div class="bucket unexpected"><div class="bucket-title">Right lines, wrong fix</div>${d.bad.map((b) => `<div class="line"><span class="ln">${b.line}</span> expected fix <code>${escapeHtml(b.want)}</code> but got <code>${escapeHtml(b.got || '(none)')}</code></div>`).join('')}</div>`);
  }
  if (g.otherIds.length) out.push(`<div class="msg warn">Matches from other rule ids were ignored: ${g.otherIds.map(escapeHtml).join(', ')} — this challenge grades <code>${escapeHtml(ch.rule_id)}</code>.</div>`);
  if (g.matches.length) {
    out.push(`<details class="matches"><summary>${g.matches.length} raw match${g.matches.length === 1 ? '' : 'es'}</summary>${g.matches.map((m) => {
      const s = m.location.start, e = m.location.end;
      const mv = Object.entries((m.extra && m.extra.metavars) || {}).map(([k, v]) => `<span class="mv"><b>${escapeHtml(k)}</b> = <code>${escapeHtml(v && v.abstract_content !== undefined ? v.abstract_content : JSON.stringify(v))}</code></span>`).join(' ');
      const rendered = (m.extra && typeof m.extra.fix === 'string') ? m.extra.fix : m.__renderedFix;
      const fix = rendered !== undefined ? `<div class="fix">fix → <code>${escapeHtml(rendered)}</code></div>` : '';
      return `<div class="match"><span class="ln">${s.line}:${s.col}–${e.line}:${e.col}</span> <span class="message">${escapeHtml((m.extra && m.extra.message) || '')}</span> ${mv}${fix}</div>`;
    }).join('')}</details>`);
  }
  $('results').innerHTML = out.join('');
}

$('run').addEventListener('click', run);
$('reset').addEventListener('click', () => { ruleEd.set(ch.starter); $('rule-messages').innerHTML = ''; $('results').innerHTML = ''; targetEd.clearResult(); ruleEd.focus(); });
$('show-solution').addEventListener('click', () => {
  if (!confirm('Replace your rule with the reference solution? The challenge will count as solved with help.')) return;
  solutionShown = true; storage.usedHelp(ch.id); ruleEd.set(ch.solution);
  if (ch.wasm !== 'cli-only') run();
});
window.addEventListener('hashchange', load);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
});
load();
// Debug / test hooks (used by scripts/browser-test.mjs)
window.__dojo = { get challenge() { return ch; }, get ruleEd() { return ruleEd; }, get targetEd() { return targetEd; }, run, engine, all };
