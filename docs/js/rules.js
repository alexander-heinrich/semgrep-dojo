// Convert the learner's YAML into the JSON rule list the engine accepts, with friendly validation.
import { jsyaml } from '../vendor/editor.bundle.js';

const SEVERITIES = new Set(['ERROR', 'WARNING', 'INFO', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INVENTORY', 'EXPERIMENT']);
const TOP_LEVEL_KEYS = new Set(['id', 'message', 'severity', 'languages', 'mode', 'min-version', 'max-version', 'version', 'paths', 'metadata',
  'options', 'fix', 'fix-regex', 'category', 'pattern', 'patterns', 'pattern-either', 'pattern-regex', 'pattern-sources', 'pattern-sinks',
  'pattern-sanitizers', 'pattern-propagators', 'r2c-internal-project-depends-on', 'validators']);
const PATTERN_KEYS = ['pattern', 'patterns', 'pattern-either', 'pattern-regex'];

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
    if (!SEVERITIES.has(sev)) return { rules: null, error: { message: `Unknown severity \`${rule.severity}\` (use ERROR, WARNING, INFO, CRITICAL, HIGH, MEDIUM or LOW).` }, warnings };
    rule.severity = sev;
    const mode = rule.mode || 'search';
    const hasPattern = PATTERN_KEYS.some((k) => k in rule);
    if (mode === 'search' && !hasPattern) return { rules: null, error: { message: `Rule \`${rule.id}\` needs one of: ${PATTERN_KEYS.join(', ')}.` }, warnings };
    if (mode === 'taint' && !rule['pattern-sources']) return { rules: null, error: { message: `Taint rule \`${rule.id}\` needs \`pattern-sources\` (and usually \`pattern-sinks\`).` }, warnings };
    for (const k of Object.keys(rule)) if (!TOP_LEVEL_KEYS.has(k)) warnings.push(`Unknown top-level key \`${k}\` in rule \`${rule.id}\` (the engine ignores it).`);
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
