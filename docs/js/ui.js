// Small DOM helpers shared by the challenge page and the playground.
import { escapeHtml } from './markdown.js';

/** Keep the engine status pill in step with an EngineClient. */
export function bindEngineStatus(engine, el) {
  engine.onStatus(({ status, progress, stage, message, timings }) => {
    el.className = 'pill ' + status;
    if (status === 'downloading') el.textContent = `engine: downloading ${Math.round((progress || 0) * 100)}%`;
    else if (status === 'starting') el.textContent = `engine: starting${stage ? ' (' + stage + ')' : ''}`;
    else if (status === 'ready') el.textContent = 'engine: ready';
    else if (status === 'fatal') el.textContent = 'engine: failed';
    else el.textContent = 'engine: idle';
    if (message) el.title = message; else if (timings) el.title = `ready in ${timings.python || timings.csharp} ms`;
  });
}

/** Show a parseRuleYaml error under the rule editor and mark its line. */
export function showRuleError(msgsEl, ruleEd, error) {
  msgsEl.innerHTML = `<div class="msg error">${escapeHtml(error.message)}${error.line ? ` (line ${error.line})` : ''}</div>`;
  if (error.line) ruleEd.markError(error.line);
}

/** An engine error that names a rule line ("line N") marks that line in the rule editor. */
export function markErrorLine(ruleEd, errors) {
  const m = /line (\d+)/.exec(errors.map((e) => (typeof e === 'string' ? e : String(e.message || ''))).join(' '));
  if (m) ruleEd.markError(Number(m[1]));
}
