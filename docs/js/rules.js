// Convert the learner's YAML into the JSON rule list the engine accepts, with friendly validation.
import { jsyaml } from '../vendor/editor.bundle.js';

const LEGACY_SEVERITY = { CRITICAL: 'ERROR', HIGH: 'ERROR', MEDIUM: 'WARNING', LOW: 'INFO', ERROR: 'ERROR', WARNING: 'WARNING', INFO: 'INFO',
  INVENTORY: 'INFO', EXPERIMENT: 'INFO' };
const TOP_LEVEL_KEYS = new Set(['id', 'message', 'severity', 'languages', 'mode', 'min-version', 'max-version', 'version', 'paths', 'metadata',
  'options', 'fix', 'fix-regex', 'category', 'pattern', 'patterns', 'pattern-either', 'pattern-regex', 'pattern-sources', 'pattern-sinks',
  'pattern-sanitizers', 'pattern-propagators', 'r2c-internal-project-depends-on', 'validators']);
const PATTERN_KEYS = ['pattern', 'patterns', 'pattern-either', 'pattern-regex'];
const BROWSER_UNSUPPORTED = {
  'pattern-regex': 'pattern-regex is not functional in the browser engine (no PCRE); use the CLI for regex operators',
  'pattern-not-regex': 'pattern-not-regex is not functional in the browser engine; use the CLI',
  'metavariable-regex': 'metavariable-regex is silently ignored by the browser engine (every binding passes); use the CLI',
  'metavariable-analysis': 'metavariable-analysis crashes the browser engine; use the CLI',
  'metavariable-type': 'metavariable-type is not supported by this engine',
  'paths': 'paths filters are ignored by the browser engine',
};

/**
 * @param {string} text  YAML typed by the learner
 * @returns {{rules: object[]|null, error: {message:string, line?:number}|null, warnings: string[]}}
 */
export function parseRuleYaml(text) {
  const warnings = [];
  if (!text || !text.trim()) return { rules: null, error: { message: "You can't run Semgrep with an empty rule." }, warnings };
  let doc;
  try {
    doc = jsyaml.load(text, { schema: jsyaml.CORE_SCHEMA });
  } catch (e) {
    const line = e.mark && typeof e.mark.line === 'number' ? e.mark.line + 1 : undefined;
    return { rules: null, error: { message: 'YAML syntax error: ' + (e.reason || e.message), line }, warnings };
  }
  let rules;
  if (doc && typeof doc === 'object' && Array.isArray(doc.rules)) rules = doc.rules;
  else if (doc && typeof doc === 'object' && !Array.isArray(doc) && (doc.pattern || doc.patterns || doc['pattern-either'] || doc.id)) {
    rules = [doc];
    warnings.push('Wrapped your rule in a top-level `rules:` list.');
  } else if (typeof doc === 'string') {
    rules = [{ id: 'my-rule', pattern: doc }];
    warnings.push('Treated the text as a bare pattern and wrapped it in a rule.');
  } else {
    return { rules: null, error: { message: 'Expected a top-level `rules:` list containing at least one rule.' }, warnings };
  }
  if (!rules.length) return { rules: null, error: { message: '`rules:` is empty.' }, warnings };
  const out = [];
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r || typeof r !== 'object') return { rules: null, error: { message: `rules[${i}] is not a mapping.` }, warnings };
    const rule = { ...r };
    if (!rule.id) { rule.id = `rule-${i + 1}`; warnings.push(`rules[${i}] has no id; using \`${rule.id}\`.`); }
    if (!rule.message) rule.message = `matched ${rule.id}`;
    if (!rule.languages) { rule.languages = ['csharp']; warnings.push('Added `languages: [csharp]`.'); }
    rule.languages = rule.languages.map((l) => (String(l).toLowerCase() === 'c#' ? 'csharp' : l));
    const sev = String(rule.severity || 'WARNING').toUpperCase();
    if (!LEGACY_SEVERITY[sev]) return { rules: null, error: { message: `Unknown severity \`${rule.severity}\` (use ERROR, WARNING or INFO).` }, warnings };
    if (LEGACY_SEVERITY[sev] !== sev) warnings.push(`Severity \`${sev}\` was mapped to \`${LEGACY_SEVERITY[sev]}\` for the 2023 browser engine (current Semgrep accepts it).`);
    rule.severity = LEGACY_SEVERITY[sev];
    const mode = rule.mode || 'search';
    const hasPattern = PATTERN_KEYS.some((k) => k in rule);
    if (mode === 'search' && !hasPattern) return { rules: null, error: { message: `Rule \`${rule.id}\` needs one of: ${PATTERN_KEYS.join(', ')}.` }, warnings };
    if (mode === 'taint' && !rule['pattern-sources']) return { rules: null, error: { message: `Taint rule \`${rule.id}\` needs \`pattern-sources\` (and usually \`pattern-sinks\`).` }, warnings };
    for (const k of Object.keys(rule)) if (!TOP_LEVEL_KEYS.has(k)) warnings.push(`Unknown top-level key \`${k}\` in rule \`${rule.id}\` (the engine ignores it).`);
    for (const [k, msg] of Object.entries(BROWSER_UNSUPPORTED)) if (containsKey(rule, k)) warnings.push(msg);
    // 2023 engine quirk: `if (<call>) { ... }` with a lone ellipsis body never matches; `{ $S; ... }` does.
    if (/\bif\s*\((?!\s*\$[A-Z_][A-Z0-9_]*\s*\))[^\n]*\)\s*\{\s*\.\.\.\s*\}(?!\s*else)/.test(JSON.stringify(rule))) {
      warnings.push('Browser engine limitation: an `if (...) { ... }` pattern with a lone `...` body does not match here unless the condition is a bare metavariable; write the body as `{ $S; ... }` (current Semgrep accepts both).');
    }
    out.push(rule);
  }
  return { rules: out, error: null, warnings };
}

function containsKey(obj, key) {
  if (Array.isArray(obj)) return obj.some((x) => containsKey(x, key));
  if (obj && typeof obj === 'object') return Object.keys(obj).some((k) => k === key || containsKey(obj[k], key));
  return false;
}

export { renderFixes } from './fixes.js';
