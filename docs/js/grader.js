// Grade an engine result against a challenge's expectations.
// Mirrors scripts/build.py::grade — keep both in sync (shared fixtures in tests/grader-fixtures.json).

/**
 * @typedef {Object} Expected
 * @property {string} ruleId
 * @property {'lines'|'ranges'|'fixes'} grade
 * @property {number[]} ruleidLines
 * @property {number[]} okLines
 * @property {number[]} todoLines        // todoruleid lines (counted as expected unless wasm === 'todo')
 * @property {Array<[number,number,number,number]>|null} ranges   // [sl, sc, el, ec]
 * @property {Object<string,string>|null} fixes  // line -> rendered fix text
 */

/**
 * @param {{matches: any[], errors: any[]}} result   engine output (matches with location.start/end, extra.fix?)
 * @param {Expected} expected
 * @param {{wasm?: string}} [opts]
 */
export function grade(result, expected, opts = {}) {
  const errors = (result.errors || []).map(describeError);
  if (errors.length) {
    return { status: 'error', errors, matchedLines: [], missed: [], unexpected: [], unexpectedOk: [], otherIds: [] };
  }
  const wantLines = new Set(expected.ruleidLines);
  if (opts.wasm !== 'todo') for (const l of expected.todoLines || []) wantLines.add(l);
  const okLines = new Set(expected.okLines || []);

  const mine = [];
  const otherIds = new Set();
  for (const m of result.matches || []) {
    const id = String(m.rule_id || m.check_id || '');
    if (id === expected.ruleId || id.endsWith('.' + expected.ruleId)) mine.push(m);
    else otherIds.add(id);
  }
  const matchedLines = [...new Set(mine.map((m) => startLine(m)))].sort((a, b) => a - b);
  const matchedSet = new Set(matchedLines);
  const missed = [...wantLines].filter((l) => !matchedSet.has(l)).sort((a, b) => a - b);
  const unexpected = matchedLines.filter((l) => !wantLines.has(l));
  const unexpectedOk = unexpected.filter((l) => okLines.has(l));
  let pass = missed.length === 0 && unexpected.length === 0;
  const details = [];

  if (pass && expected.grade === 'ranges' && expected.ranges) {
    const want = new Set(expected.ranges.map((r) => r.join(':')));
    const got = new Set(mine.map((m) => rangeKey(m)));
    const missingRanges = [...want].filter((k) => !got.has(k));
    const extraRanges = [...got].filter((k) => !want.has(k));
    if (missingRanges.length || extraRanges.length) {
      pass = false;
      details.push({ kind: 'ranges', missingRanges, extraRanges });
    }
  }
  if (pass && expected.grade === 'fixes' && expected.fixes) {
    const bad = [];
    for (const m of mine) {
      const line = String(startLine(m));
      const want = expected.fixes[line];
      const got = renderedFix(m);
      if (want !== undefined && (got || '').trimEnd() !== want.trimEnd()) bad.push({ line: Number(line), want, got });
    }
    if (bad.length) {
      pass = false;
      details.push({ kind: 'fixes', bad });
    }
  }
  return {
    status: pass ? 'pass' : 'fail',
    errors: [],
    matchedLines, missed, unexpected, unexpectedOk,
    otherIds: [...otherIds],
    details,
    matches: mine,
  };
}

export function startLine(m) {
  return m.location ? m.location.start.line : m.start.line;
}
export function rangeKey(m) {
  const s = m.location ? m.location.start : m.start;
  const e = m.location ? m.location.end : m.end;
  return [s.line, s.col, e.line, e.col].join(':');
}
export function renderedFix(m) {
  const extra = m.extra || {};
  if (typeof extra.fix === 'string') return extra.fix;
  if (typeof extra.rendered_fix === 'string') return extra.rendered_fix;
  if (Array.isArray(extra.fixed_lines)) return extra.fixed_lines.join('\n');
  if (typeof m.__renderedFix === 'string') return m.__renderedFix; // computed client-side
  return null;
}
export function describeError(e) {
  if (typeof e === 'string') return e;
  const type = e.error_type || e.type || (e.code !== undefined ? 'error ' + e.code : 'error');
  const msg = e.message || e.long_msg || e.short_msg || JSON.stringify(e);
  const loc = e.location ? ` (line ${e.location.start ? e.location.start.line : '?'})` : '';
  return `${type}: ${msg}${loc}`.replace(/\s+/g, ' ').trim();
}
