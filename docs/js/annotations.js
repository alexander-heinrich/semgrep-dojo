// Parse `// ruleid:` / `// ok:` / `// todoruleid:` / `// todook:` annotations from a C# target.
// Mirrors scripts/build.py::parse_annotations — keep both in sync (shared fixtures in tests/grader-fixtures.json).

const ANNOTATION = /^\s*\/\/\s*(ruleid|ok|todoruleid|todook)\s*:\s*(.+?)\s*$/;

/**
 * @param {string} text  target file content
 * @param {string} ruleId  only annotations naming this id count
 * @returns {{ruleid: number[], ok: number[], todoruleid: number[], todook: number[]}} 1-based line numbers, sorted
 */
export function parseAnnotations(text, ruleId) {
  const lines = text.split(/\r?\n/);
  const out = { ruleid: [], ok: [], todoruleid: [], todook: [] };
  const pending = [];
  for (let i = 0; i < lines.length; i++) {
    const m = ANNOTATION.exec(lines[i]);
    if (m) {
      const ids = m[2].split(',').map((s) => s.trim());
      if (ids.includes(ruleId)) pending.push(m[1]);
      continue;
    }
    if (pending.length) {
      const lineNo = i + 1;
      for (const kind of pending) if (!out[kind].includes(lineNo)) out[kind].push(lineNo);
      pending.length = 0;
    }
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
  return out;
}

/** Lines that are annotation comments (for hiding/greying them in the editor). */
export function annotationLines(text) {
  const lines = text.split(/\r?\n/);
  const res = [];
  for (let i = 0; i < lines.length; i++) if (ANNOTATION.test(lines[i])) res.push(i + 1);
  return res;
}
