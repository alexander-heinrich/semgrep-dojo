#!/usr/bin/env node
// End-to-end browser check with headless Chrome over the DevTools protocol (no extra dependencies).
// Serves docs/ on a local port, opens the home page and one challenge, runs starter (must fail) and
// solution (must pass). Usage: node scripts/browser-test.mjs [--id csharp/1-basics/04-metavariables] [--all]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 8123, cdpPort = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const data = JSON.parse(readFileSync(path.join(root, 'docs/data/challenges.json'), 'utf8'));
const onlyId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const ids = args.includes('--all') ? data.challenges.filter((c) => c.wasm !== 'cli-only').map((c) => c.id) : [onlyId || data.challenges[0].id];

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', path.join(root, 'docs')], { stdio: 'ignore' });
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${cdpPort}`, '--user-data-dir=/tmp/claude-dojo-profile', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('page exception: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || JSON.stringify(r.exceptionDetails)).slice(0, 400)); return r.result.value; };
const waitFor = async (expression, timeoutMs, what) => { const t0 = Date.now(); for (;;) { try { if (await evaluate(`!!(${expression})`)) return; } catch (e) { if (!/context|navigat|destroyed/i.test(String(e.message))) throw e; } if (Date.now() - t0 > timeoutMs) throw new Error('timeout waiting for ' + what); await sleep(300); } };
let failures = 0;
const check = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failures++; };
const consoleErrors = [];
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); break; } catch { await sleep(200); } }
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result || {}); }
    else if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); };
  await send('Runtime.enable'); await send('Page.enable');

  console.log('home page');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
  await waitFor(`document.querySelectorAll('ol.challenges li').length > 0`, 15000, 'challenge list');
  check((await evaluate(`document.querySelectorAll('ol.challenges li').length`)) === data.challenges.length, `lists ${data.challenges.length} challenges`);
  check(await evaluate(`!!document.querySelector('#daily .card-link')`), 'daily pick rendered');

  for (const cid of ids) {
    const ch = data.challenges.find((c) => c.id === cid);
    console.log(`challenge ${cid}`);
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/challenge.html#/${cid}` });
    await waitFor(`window.__dojo && __dojo.challenge && __dojo.challenge.id === ${JSON.stringify(cid)} && __dojo.ruleEd`, 15000, 'challenge page');
    check((await evaluate(`document.getElementById('title').textContent`)) === ch.title, 'title rendered');
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line').length`)) > 5, 'target editor rendered');
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line-expected').length`)) >= (ch.expected.ruleidLines.length ? 1 : 0), 'expected lines highlighted');
    await waitFor(`__dojo.engine.status === 'ready' || __dojo.engine.status === 'fatal'`, 90000, 'engine ready');
    check((await evaluate(`__dojo.engine.status`)) === 'ready', `engine ready (${await evaluate(`document.getElementById('engine-status').title`)})`);
    // starter
    if (!ch.intro && !ch.starter_expects_error) {
      await evaluate(`__dojo.ruleEd.set(${JSON.stringify(ch.starter)}); __dojo.run()`);
      await waitFor(`document.querySelector('#results .verdict')`, 30000, 'starter verdict');
      const v1 = await evaluate(`document.querySelector('#results .verdict').className`);
      check(/fail/.test(v1), `starter fails (${v1})`);
    }
    await evaluate(`__dojo.ruleEd.set(${JSON.stringify(ch.solution)}); __dojo.run()`);
    await waitFor(`document.querySelector('#results .verdict') && !document.querySelector('#results .msg') || document.querySelector('#results .verdict.pass') || document.querySelector('#results .verdict.fail')`, 30000, 'solution verdict');
    await sleep(200);
    const v2 = await evaluate(`document.querySelector('#results .verdict').className + ' | ' + document.querySelector('#results .verdict').textContent`);
    check(/pass/.test(v2), `solution passes (${v2.slice(0, 120)})`);
    check(await evaluate(`!document.getElementById('followup').classList.contains('hidden')`), 'follow-up shown');
    check(await evaluate(`document.querySelectorAll('#target-editor .cm-line-matched').length > 0`), 'matched lines highlighted');
    // YAML error path
    await evaluate(`__dojo.ruleEd.set('rules:\\n  - id: x\\n    pattern: [unclosed'); __dojo.run()`);
    await sleep(300);
    check(await evaluate(`!!document.querySelector('#rule-messages .msg.error')`), 'YAML error surfaced');
    check(await evaluate(`JSON.parse(localStorage.getItem('semgrep-dojo.v1')).progress[${JSON.stringify(cid)}].status.startsWith('solved')`), 'progress saved');
  }
  if (consoleErrors.length) { console.log('console errors:'); consoleErrors.forEach((e) => console.log('   ' + String(e).slice(0, 300))); }
  check(consoleErrors.length === 0, 'no console errors');
} catch (e) { console.log('ERROR', e.message || e); failures++; }
finally { browser.kill(); server.kill(); }
console.log(failures ? `\n${failures} failure(s)` : '\nall browser checks passed');
process.exit(failures ? 1 : 0);
