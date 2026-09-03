// Fallback rendering of `fix:` / `fix-regex:`. The engine emits `extra.fix` itself; this fills the preview
// in for matches where it did not. Shared by the site (rules.js) and the Node scripts.
export function renderFixes(matches, rules, targetText) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const lines = targetText.split('\n');
  for (const m of matches) {
    if (m.extra && typeof m.extra.fix === 'string') continue; // the engine already rendered it
    const id = String(m.rule_id || '');
    const rule = byId.get(id) || [...byId.values()].find((r) => id.endsWith('.' + r.id));
    if (!rule) continue;
    const s = m.location ? m.location.start : m.start;
    const e = m.location ? m.location.end : m.end;
    const matched = sliceRange(lines, s, e);
    if (typeof rule.fix === 'string') {
      const mv = (m.extra && m.extra.metavars) || {};
      m.__renderedFix = rule.fix.replace(/\$\.\.\.[A-Z_][A-Z0-9_]*|\$[A-Z_][A-Z0-9_]*/g, (name) => {
        const b = mv[name];
        return b && typeof b.abstract_content === 'string' ? b.abstract_content : name;
      });
    } else if (rule['fix-regex'] && rule['fix-regex'].regex) {
      try {
        const fr = rule['fix-regex'];
        const re = new RegExp(fr.regex, fr.count ? '' : 'g');
        m.__renderedFix = matched.replace(re, String(fr.replacement || '').replace(/\\(\d)/g, '$$$1'));
      } catch { /* invalid regex: leave undefined */ }
    }
  }
  return matches;
}
function sliceRange(lines, s, e) {
  if (s.line === e.line) return (lines[s.line - 1] || '').slice(s.col - 1, e.col - 1);
  const parts = [(lines[s.line - 1] || '').slice(s.col - 1)];
  for (let l = s.line + 1; l < e.line; l++) parts.push(lines[l - 1] || '');
  parts.push((lines[e.line - 1] || '').slice(0, e.col - 1));
  return parts.join('\n');
}
