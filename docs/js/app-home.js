import { storage } from './storage.js';
import { dailyPick, randomPick } from './daily.js';
import { escapeHtml } from './markdown.js';

const data = await (await fetch('data/challenges.json')).json();
const all = data.challenges;
const progress = storage.all();
let activeTag = null;

const dots = (n) => '●'.repeat(n) + '○'.repeat(5 - n);
const statusIcon = (id) => {
  const s = (progress[id] || {}).status;
  return s === 'solved' ? '✅' : s === 'solved-with-help' ? '☑️' : s === 'attempted' ? '✏️' : '▫️';
};
const link = (c) => `challenge.html#/${encodeURIComponent(c.id).replace(/%2F/g, '/')}`;

function renderProgress() {
  const solved = all.filter((c) => /^solved/.test((progress[c.id] || {}).status || '')).length;
  const pct = all.length ? Math.round((100 * solved) / all.length) : 0;
  document.getElementById('progress').innerHTML =
    `<div class="bar"><div style="width:${pct}%"></div></div><div class="bar-label">${solved} / ${all.length} solved</div>`;
}
function card(el, title, c, note) {
  if (!c) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card-title">${title}</div>
    <a class="card-link" href="${link(c)}">${escapeHtml(c.title)}</a>
    <div class="card-meta">${escapeHtml(c.level_name)} · <span class="dots" title="difficulty ${c.difficulty}/5">${dots(c.difficulty)}</span> ${note || ''}</div>`;
}
function renderPicks() {
  card(document.getElementById('daily'), "Today's pick", dailyPick(all, progress), '· changes every day');
  const attempted = all.filter((c) => (progress[c.id] || {}).status === 'attempted');
  const last = attempted.sort((a, b) => ((progress[b.id] || {}).solvedAt || '') > ((progress[a.id] || {}).solvedAt || '') ? 1 : -1)[0];
  const next = last || all.find((c) => !/^solved/.test((progress[c.id] || {}).status || ''));
  card(document.getElementById('resume'), last ? 'Continue where you left off' : 'Next unsolved', next);
}
function renderTags() {
  const counts = new Map();
  for (const c of all) for (const t of c.tags) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('tags');
  el.innerHTML = tags.map(([t, n]) => `<button class="chip ${activeTag === t ? 'active' : ''}" data-tag="${t}">${t} <span>${n}</span></button>`).join('') +
    (activeTag ? ' <button class="chip clear" data-tag="">✕ clear</button>' : '');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { activeTag = b.dataset.tag || null; renderTags(); renderLevels(); }));
}
function renderLevels() {
  const el = document.getElementById('levels');
  el.innerHTML = data.levels.map((lv) => {
    const items = all.filter((c) => c.level === lv.level && (!activeTag || c.tags.includes(activeTag)));
    if (!items.length) return '';
    const solved = items.filter((c) => /^solved/.test((progress[c.id] || {}).status || '')).length;
    return `<section class="level"><h2>${lv.level}. ${escapeHtml(lv.name)} <span class="count">${solved}/${items.length}</span></h2>
      <ol class="challenges">${items.map((c) => `<li>
        <span class="status">${statusIcon(c.id)}</span>
        <a href="${link(c)}">${escapeHtml(c.title)}</a>
        <span class="dots" title="difficulty ${c.difficulty}/5">${dots(c.difficulty)}</span>
        <span class="tags">${c.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</span>
        ${c.wasm === 'cli-only' ? '<span class="badge cli">CLI only</span>' : ''}${c.wasm === 'todo' ? '<span class="badge todo">engine gap</span>' : ''}
      </li>`).join('')}</ol></section>`;
  }).join('');
}
document.getElementById('engine-info').textContent = `${data.engine.engine} + ${data.engine.csharp} (validated with semgrep ${data.semgrepCliVersion})`;
document.getElementById('reset').addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('Reset all progress stored in this browser?')) { storage.reset(); location.reload(); }
});
renderProgress(); renderPicks(); renderTags(); renderLevels();
document.addEventListener('keydown', (e) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { const c = randomPick(all, progress); if (c) location.href = link(c); } });
