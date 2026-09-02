#!/usr/bin/env node
// Run every challenge's reference solution through the browser engine (Node build) and compare with
// the CLI-derived expectations in docs/data/challenges.json.
//
// Usage: node scripts/wasm_parity.mjs [--only SUBSTRING] [--rule rule.yaml --target file.cs] [--verbose]
//
// Needs the CommonJS builds of the same package versions (the .mjs builds cannot run in Node); they are
// downloaded into scripts/.cache/ on first use.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installJsooRuntimeShim } from '../docs/js/jsoo-shims.mjs';
import { grade } from '../docs/js/grader.js';
import { renderFixes } from '../docs/js/fixes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cache = path.join(here, '.cache');
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7) || (args.includes('--only') ? args[args.indexOf('--only') + 1] : '');
const verbose = args.includes('--verbose');

const FILES = {
  engine: ['engine-1.17.1-alpha.2.cjs', 'https://cdn.jsdelivr.net/npm/@semgrep/engine@1.17.1-alpha.2/dist/index.cjs'],
  csharp: ['csharp-1.17.1-alpha.0.cjs', 'https://cdn.jsdelivr.net/npm/@semgrep/languages@1.17.1-alpha.0/dist/csharp/index.cjs'],
  python: ['python-0.0.4.cjs', 'https://cdn.jsdelivr.net/npm/@semgrep/lang-python@0.0.4/dist/index.cjs'],
  pythonWasm: ['semgrep-parser.wasm', 'https://cdn.jsdelivr.net/npm/@semgrep/lang-python@0.0.4/dist/semgrep-parser.wasm'],
};
mkdirSync(cache, { recursive: true });
for (const [name, url] of Object.values(FILES)) {
  const p = path.join(cache, name);
  if (!existsSync(p)) {
    process.stdout.write(`downloading ${name} … `);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(p, buf);
    console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
  }
}

globalThis.require = createRequire(import.meta.url);
installJsooRuntimeShim(globalThis, verbose ? (m) => console.log(m) : () => {});
const { EngineFactory } = globalThis.require(path.join(cache, FILES.engine[0]));
const engine = await EngineFactory();
const { ParserFactory: CsFactory } = globalThis.require(path.join(cache, FILES.csharp[0]));
engine.addParser(await CsFactory());
const { ParserFactory: PyFactory } = globalThis.require(path.join(cache, FILES.python[0]));
const py = await PyFactory();
const pyLang = py.getLangs()[0];
engine.addParser({ setMountPoints: (m) => py.setMountpoints(m), getLang: () => pyLang,
  parsePattern: (pe, s) => py.parsePattern(pe, pyLang, s), parseTarget: (f) => py.parseTarget(pyLang, f) });

const fsRoot = path.join(cache, 'fs-' + process.pid);
rmSync(fsRoot, { recursive: true, force: true });
let n = 0;
function execute(rulesObj, targetText, targetPath) {
  n += 1;
  const dir = path.join(fsRoot, String(n));
  const rulesPath = path.join(dir, 'rules.json');
  const tPath = path.join(dir, targetPath);
  mkdirSync(path.dirname(tPath), { recursive: true });
  writeFileSync(rulesPath, JSON.stringify(rulesObj));
  writeFileSync(tPath, targetText);
  const origLog = console.log;
  console.log = () => {};
  const started = Date.now();
  try {
    const out = engine.execute('csharp', rulesPath, tPath);
    return { ...JSON.parse(out), ms: Date.now() - started };
  } catch (e) {
    return { matches: [], errors: [{ error_type: 'engine exception', message: describeThrown(e) }], ms: Date.now() - started };
  } finally {
    console.log = origLog;
  }
}
function describeThrown(e) {
  if (Array.isArray(e)) {
    // OCaml exception value: [0, [248, "Rule.Err", -n], payload...]
    const flat = [];
    const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (typeof v === 'string') flat.push(v); };
    walk(e);
    return flat.filter((s) => s.length > 1).join(' | ').slice(0, 300);
  }
  return String(e && e.message ? e.message : e).slice(0, 300);
}

// Ad-hoc mode
if (args.includes('--rule')) {
  const yaml = await import('js-yaml').catch(() => null);
  if (!yaml) { console.error('ad-hoc mode needs js-yaml (npm install)'); process.exit(2); }
  const rule = yaml.default.load(readFileSync(args[args.indexOf('--rule') + 1], 'utf8'));
  const target = readFileSync(args[args.indexOf('--target') + 1], 'utf8');
  const res = execute(rule, target, 'target.cs');
  console.log(JSON.stringify(res, null, 1));
  process.exit(0);
}

const dataArg = (args.find((a) => a.startsWith('--data=')) || '').slice(7) || (args.includes('--data') ? args[args.indexOf('--data') + 1] : '');
const data = JSON.parse(readFileSync(dataArg ? path.resolve(dataArg) : path.join(root, 'docs', 'data', 'challenges.json'), 'utf8'));
let failures = 0, warnings = 0, skipped = 0, passed = 0;
console.log(`engine pair: ${data.engine.engine} + ${data.engine.csharp} (+ ${data.engine.python})`);
for (const ch of data.challenges) {
  if (only && !ch.id.includes(only)) continue;
  if (ch.wasm === 'cli-only') { skipped++; console.log(`  skip  ${ch.id}  (cli-only)`); continue; }
  const res = execute(ch.solution_rules, ch.target, ch.target_path);
  renderFixes(res.matches, ch.solution_rules.rules, ch.target);
  const g = grade(res, ch.expected, { wasm: ch.wasm });
  const summary = `matched=${JSON.stringify(g.matchedLines)} missed=${JSON.stringify(g.missed)} unexpected=${JSON.stringify(g.unexpected)}` +
    (g.errors.length ? ` errors=${JSON.stringify(g.errors).slice(0, 200)}` : '') + (g.details && g.details.length ? ` details=${JSON.stringify(g.details).slice(0, 200)}` : '');
  if (g.status === 'pass') { passed++; console.log(`  ok    ${ch.id}  ${res.ms}ms`); }
  else if (ch.wasm === 'todo') { warnings++; console.log(`  WARN  ${ch.id}  (wasm: todo) ${summary}`); }
  else { failures++; console.log(`  FAIL  ${ch.id}  ${summary}`); }
  // starter should not pass in the browser either (unless intro)
  if (ch.starter_rules && !ch.intro && g.status === 'pass') {
    const rs = execute(ch.starter_rules, ch.target, ch.target_path);
    const gs = grade(rs, ch.expected, { wasm: ch.wasm });
    if (gs.status === 'pass') { failures++; console.log(`  FAIL  ${ch.id}  starter already passes in the browser engine`); }
  }
}
console.log(`\n${passed} ok, ${failures} failed, ${warnings} warnings (wasm: todo), ${skipped} skipped (cli-only)`);
rmSync(fsRoot, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
