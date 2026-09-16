// Rendering of raw engine matches, shared by the challenge page and the playground.
import { escapeHtml } from './markdown.js';

const mvText = (v) => (v && v.abstract_content !== undefined ? v.abstract_content : JSON.stringify(v));

/** One match row: range, message, metavariable bindings, rendered fix; `showPath` prefixes the file path. */
export function renderMatchRow(m, { showPath = false } = {}) {
  const s = m.location.start, e = m.location.end;
  const mv = Object.entries((m.extra && m.extra.metavars) || {}).map(([k, v]) => `<span class="mv"><b>${escapeHtml(k)}</b> = <code>${escapeHtml(mvText(v))}</code></span>`).join(' ');
  const rendered = (m.extra && typeof m.extra.fix === 'string') ? m.extra.fix : m.__renderedFix;
  const fix = rendered !== undefined ? `<div class="fix">fix → <code>${escapeHtml(rendered)}</code></div>` : '';
  const path = showPath ? `<span class="path">${escapeHtml(m.location.path || '')}</span> ` : '';
  return `<div class="match">${path}<span class="ln">${s.line}:${s.col}–${e.line}:${e.col}</span> <span class="message">${escapeHtml((m.extra && m.extra.message) || '')}</span> ${mv}${fix}</div>`;
}

/** The collapsible "N raw matches" list (at most `limit` rows); an empty string when there is nothing to show. */
export function renderMatchList(matches, { showPath = false, limit = 500 } = {}) {
  if (!matches || !matches.length) return '';
  const rows = matches.slice(0, limit).map((m) => renderMatchRow(m, { showPath })).join('');
  const more = matches.length > limit ? `<div class="match more">… ${matches.length - limit} more not shown</div>` : '';
  return `<details class="matches"><summary>${matches.length} raw match${matches.length === 1 ? '' : 'es'}</summary>${rows}${more}</details>`;
}
