#!/usr/bin/env node
// The playground and one challenge in WebKit (Safari's engine), through Playwright. Safari gives a worker a far
// smaller stack than Chrome does, which once broke the C++ parser at load; this check keeps that class of failure
// visible. Opt-in: it needs `npm install --no-save playwright && npx playwright install webkit` and skips itself
// otherwise. Usage: node scripts/webkit-test.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let webkit;
try { ({ webkit } = await import('playwright')); }
catch { console.log('skipped: playwright is not installed (npm install --no-save playwright && npx playwright install webkit)'); process.exit(0); }
const port = 8127;
const data = JSON.parse(readFileSync(path.join(root, 'docs/data/challenges.json'), 'utf8'));
const ch = data.challenges.find((c) => c.wasm !== 'cli-only');
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', path.join(root, 'docs')], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let failures = 0;
const check = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures++; };
let browser;
try {
  browser = await webkit.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  console.log('playground (WebKit)');
  await page.goto(`http://127.0.0.1:${port}/playground.html`);
  await page.waitForFunction(() => window.__playground && ['ready', 'fatal'].includes(__playground.engine.status), null, { timeout: 120000 });
  check(await page.evaluate(() => __playground.engine.status === 'ready'), 'engine ready');
  const summary = () => page.evaluate(() => (document.querySelector('#results .summary') || {}).textContent || '');
  await page.evaluate(() => __playground.run());
  check(/^● 1 match/.test(await summary()), `C# sample rule matches (${(await summary()).slice(0, 50)})`);
  for (const lang of ['python', 'cpp']) {
    await page.evaluate((l) => { __playground.setLang(l); __playground.clearFiles(); document.getElementById('reset').click(); }, lang);
    await page.evaluate(() => __playground.run());
    check(/^● 1 match/.test(await summary()), `${lang} sample rule matches, parser ${lang === 'cpp' ? 'loaded on demand' : 'ready'} (${(await summary()).slice(0, 50)})`);
  }
  console.log(`challenge ${ch.id} (WebKit)`);
  await page.goto(`http://127.0.0.1:${port}/challenge.html#/${ch.id}`);
  await page.waitForFunction(() => window.__dojo && __dojo.ruleEd && ['ready', 'fatal'].includes(__dojo.engine.status), null, { timeout: 120000 });
  await page.evaluate((sol) => { __dojo.ruleEd.set(sol); return __dojo.run(); }, ch.solution);
  check(await page.evaluate(() => !!document.querySelector('#results .verdict.pass')), 'solution passes');
  check(errors.length === 0, errors.length ? 'page errors: ' + errors[0].slice(0, 120) : 'no page errors');
} catch (e) { console.log('ERROR', e.message); failures++; }
finally { if (browser) await browser.close(); server.kill(); }
console.log(failures ? `\n${failures} failure(s)` : '\nall WebKit checks passed');
process.exit(failures ? 1 : 0);
