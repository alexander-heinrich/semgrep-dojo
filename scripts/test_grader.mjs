#!/usr/bin/env node
// Shared-fixture test for the JS grader/annotation parser (mirror of scripts/test_grader.py).
import { readFileSync } from 'node:fs';
import { grade } from '../docs/js/grader.js';
import { parseAnnotations } from '../docs/js/annotations.js';
const fx = JSON.parse(readFileSync(new URL('../tests/grader-fixtures.json', import.meta.url), 'utf8'));
let failed = 0;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const t of fx.annotations) {
  const got = parseAnnotations(t.text, t.ruleId);
  const ok = same(got, t.expect); failed += !ok;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} annotations: ${t.name}${ok ? '' : ' got=' + JSON.stringify(got)}`);
}
for (const t of fx.grades) {
  const g = grade(t.result, t.expected, { wasm: t.wasm });
  const got = Object.fromEntries(Object.keys(t.expect).map((k) => [k, g[k]]));
  const ok = same(got, t.expect); failed += !ok;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} grade: ${t.name}${ok ? '' : ' got=' + JSON.stringify(got)}`);
}
console.log('js grader:', failed ? `${failed} failure(s)` : 'all fixtures pass');
process.exit(failed ? 1 : 0);
