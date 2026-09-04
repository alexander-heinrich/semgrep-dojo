#!/usr/bin/env node
// Run every challenge's reference solution through the browser engine (Node build) and compare with
// the CLI-derived expectations in docs/data/challenges.json.
//
// Usage: node scripts/wasm_parity.mjs [--only SUBSTRING] [--data PATH] [--verbose]
//
// To run a single rule against a single file, use scripts/run_rule.mjs instead.
//
// Uses the CommonJS builds vendored next to the browser builds in docs/vendor/semgrep/ (same engine,
// same parsers, rebuilt from semgrep tag v1.81.0 by scripts/rebuild-engine/).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { grade } from '../docs/js/grader.js';
import { renderFixes } from '../docs/js/fixes.js';
import { loadEngine, ROOT as root } from './lib/engine-node.mjs';

const args = process.argv.slice(2);
const argValue = (name) => (args.find((a) => a.startsWith(`${name}=`)) || '').slice(name.length + 1) || (args.includes(name) ? args[args.indexOf(name) + 1] : '');
const only = argValue('--only');
const verbose = args.includes('--verbose');
const { execute, finish, startDir } = await loadEngine({ verbose });

const dataArg = argValue('--data');
const data = JSON.parse(readFileSync(dataArg ? path.resolve(startDir, dataArg) : path.join(root, 'docs', 'data', 'challenges.json'), 'utf8'));
let failures = 0, warnings = 0, skipped = 0, passed = 0;
console.log(`engine: ${data.engine.engine} + ${data.engine.csharp} (+ ${data.engine.python})`);
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
finish(failures ? 1 : 0);
