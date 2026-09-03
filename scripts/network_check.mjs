#!/usr/bin/env node
// Proves the claim on the About page: running a rule sends nothing to the network.
//
// Serves docs/, opens a challenge in headless Chrome, runs the reference solution, and records every
// request the page makes over the DevTools protocol. Exits non-zero if any request leaves the local origin.
//
// Usage: node scripts/network_check.mjs [--id SUBSTRING] [--verbose]      (needs Google Chrome)
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const idArg = (args.find((a) => a.startsWith('--id=')) || '').slice(5) || (args.includes('--id') ? args[args.indexOf('--id') + 1] : '');
const verbose = args.includes('--verbose');
const port = 8124, cdpPort = 9336;
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const data = JSON.parse(readFileSync(path.join(root, 'docs', 'data', 'challenges.json'), 'utf8'));
const ch = idArg ? data.challenges.find((c) => c.id.includes(idArg)) : data.challenges[0];
if (!ch) { console.error(`no challenge matching "${idArg}"`); process.exit(2); }

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', path.join(root, 'docs')], { stdio: 'ignore' });
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${cdpPort}`,
  '--user-data-dir=/tmp/claude-dojo-netcheck', 'about:blank'], { stdio: 'ignore' });
const stop = (code) => { server.kill(); browser.kill(); process.exit(code); };

try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); break; } catch { await sleep(200); } }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const requests = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result || {}); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  await send('Network.enable'); await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/challenge.html#/${ch.id}` });
  await sleep(1500);
  for (let i = 0; i < 80; i++) {
    if (await evaluate(`!!(document.getElementById('engine-status') && /ready/.test(document.getElementById('engine-status').textContent))`)) break;
    await sleep(500);
  }
  await evaluate(`__dojo.ruleEd.set(${JSON.stringify(ch.solution)}); __dojo.run()`);
  await sleep(3000);
  const verdict = await evaluate(`document.querySelector('#results .verdict') && document.querySelector('#results .verdict').className`);

  const local = `http://127.0.0.1:${port}`;
  const external = [...new Set(requests.filter((u) => !u.startsWith(local) && !u.startsWith('data:') && !u.startsWith('blob:')))];
  console.log(`challenge: ${ch.id}`);
  console.log(`verdict:   ${verdict || 'none'}`);
  console.log(`requests:  ${requests.length} (${new Set(requests).size} unique)`);
  if (verbose) [...new Set(requests)].forEach((u) => console.log('   ' + u.replace(local, '')));
  if (!/pass/.test(String(verdict))) { console.log('FAIL the solution did not pass, so the run may not have happened'); stop(1); }
  if (external.length) { console.log('FAIL external requests:'); external.forEach((u) => console.log('   ' + u)); stop(1); }
  console.log('ok   every request stayed on the local origin');
  stop(0);
} catch (e) {
  console.error('error: ' + String(e && e.message ? e.message : e));
  stop(2);
}
