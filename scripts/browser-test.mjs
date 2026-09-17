#!/usr/bin/env node
// End-to-end browser check with headless Chrome over the DevTools protocol (no extra dependencies).
// Serves docs/ on a local port, opens the home page and one challenge, runs starter (must fail) and
// solution (must pass); --playground drives the playground page instead (--all does both).
// Usage: node scripts/browser-test.mjs [--id csharp/1-basics/04-metavariables] [--all] [--playground]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 8123, cdpPort = 9334;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const data = JSON.parse(readFileSync(path.join(root, 'docs/data/challenges.json'), 'utf8'));
const onlyId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;
const doPlayground = args.includes('--playground') || args.includes('--all');
const doChallenges = !args.includes('--playground') || args.includes('--all') || !!onlyId;
const ids = !doChallenges ? [] : args.includes('--all') ? data.challenges.filter((c) => c.wasm !== 'cli-only').map((c) => c.id) : [onlyId || data.challenges[0].id];

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '-d', path.join(root, 'docs')], { stdio: 'ignore' });
// a fresh profile every run: Chrome's heuristic caching could otherwise serve a vendored file replaced minutes ago
const profile = mkdtempSync(path.join(os.tmpdir(), 'dojo-browser-test-'));
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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
    // a challenge whose solution must match nothing (e.g. a `paths:` exclude) has no lines to highlight
    check(await evaluate(`document.querySelectorAll('#target-editor .cm-line-expected').length === 0 || document.querySelectorAll('#target-editor .cm-line-matched').length > 0`), 'matched lines highlighted (or nothing expected)');
    // YAML error path
    await evaluate(`__dojo.ruleEd.set('rules:\\n  - id: x\\n    pattern: [unclosed'); __dojo.run()`);
    await sleep(300);
    check(await evaluate(`!!document.querySelector('#rule-messages .msg.error')`), 'YAML error surfaced');
    check(await evaluate(`JSON.parse(localStorage.getItem('semgrep-dojo.v1')).progress[${JSON.stringify(cid)}].status.startsWith('solved')`), 'progress saved');
  }
  if (doPlayground) {
    console.log('playground');
    const first = data.challenges[0];
    const cs = 'class Extra { void M(string s) { Console.WriteLine(s); } }';
    const csRule = 'rules:\n  - id: console\n    languages: [csharp]\n    severity: WARNING\n    message: console\n    pattern: Console.WriteLine(...)\n';
    const py = 'import os\n\ndef go(p):\n    os.system("ls " + p)\n    print(p)\n';
    const pyRule = 'rules:\n  - id: shell\n    languages: [python]\n    severity: WARNING\n    message: shell\n    pattern: os.system(...)\n';
    const summary = () => evaluate(`(document.querySelector('#results .summary') || {}).textContent || ''`);
    await evaluate(`localStorage.removeItem('semgrep-dojo.v1')`);
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/playground.html` });
    await waitFor(`window.__playground && __playground.ruleEd && __playground.targetEd`, 15000, 'playground page');
    check((await evaluate(`__playground.files.length`)) === 1, 'sample file loaded');
    check((await evaluate(`document.querySelectorAll('#filelist li').length`)) === 1, 'file list rendered');
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line').length`)) > 5, 'target editor rendered');
    await waitFor(`__playground.engine.status === 'ready' || __playground.engine.status === 'fatal'`, 90000, 'engine ready');
    check((await evaluate(`__playground.engine.status`)) === 'ready', `engine ready (${await evaluate(`document.getElementById('engine-status').title`)})`);
    // the sample rule on the sample file
    await evaluate(`__playground.run()`);
    check(/^● 1 match in 1 of 1 file/.test(await summary()), `sample rule matches once (${(await summary()).slice(0, 60)})`);
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line-matched').length`)) === 1, 'matched line highlighted');
    // a second file, results per file
    await evaluate(`__playground.addFile('Extra/Other.cs', ${JSON.stringify(cs)}); __playground.ruleEd.set(${JSON.stringify(csRule)}); __playground.run()`);
    check(/^● 3 matches in 2 of 2 files/.test(await summary()), `two files summarised (${(await summary()).slice(0, 60)})`);
    check((await evaluate(`[...document.querySelectorAll('#filelist .count')].map((e) => e.textContent).join(',')`)) === '2,1', 'per-file counts');
    check((await evaluate(`document.querySelectorAll('#results .match .path').length`)) === 3, 'paths in the raw match list');
    check((await evaluate(`__playground.state.active === 1 && document.querySelectorAll('#target-editor .cm-line-matched').length === 1`)), 'new file active with its match highlighted');
    await evaluate(`document.querySelector('#filelist button.name').click()`);
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line-matched').length`)) === 2, 'switching files switches highlights');
    // a path that looks like an engine scratch directory round-trips untouched
    await evaluate(`__playground.addFile('run-1/Nested.cs', ${JSON.stringify(cs)}); __playground.run()`);
    check(/^● 4 matches in 3 of 3 files/.test(await summary()), `a run-N folder name round-trips (${(await summary()).slice(0, 60)})`);
    check((await evaluate(`[...document.querySelectorAll('#filelist .count')].map((e) => e.textContent).join(',')`)) === '2,1,1', 'per-file counts with a run-N path');
    // editing a file marks it stale and clears its highlights; the text is read back at the next run
    await evaluate(`__playground.targetEd.view.dispatch({ changes: { from: 0, insert: '// edited\\n' } })`);
    check(await evaluate(`!!document.querySelector('#filelist li.active .count.stale') && document.querySelectorAll('#target-editor .cm-line-matched').length === 0`), 'edit marks the file stale and clears its highlights');
    check(await evaluate(`__playground.files[2].text.startsWith('// edited')`), 'edited text is read back');
    await evaluate(`__playground.run()`);
    check(/^● 4 matches in 3 of 3 files/.test(await summary()) && !(await evaluate(`!!document.querySelector('#filelist .count.stale')`)), 'rerun clears the stale marks');
    // python
    await evaluate(`__playground.setLang('python'); __playground.clearFiles(); __playground.addFile('pkg/app.py', ${JSON.stringify(py)}); __playground.ruleEd.set(${JSON.stringify(pyRule)}); __playground.run()`);
    check(/^● 1 match in 1 of 1 file/.test(await summary()), `python rule matches (${(await summary()).slice(0, 60)})`);
    check((await evaluate(`document.querySelectorAll('#target-editor .cm-line-matched').length`)) === 1, 'python match highlighted');
    // a file that does not carry the selected language's extension draws a hint
    await evaluate(`__playground.addFile('legacy/Old.cs', ${JSON.stringify(cs)}); __playground.run()`);
    check(await evaluate(`/does not end in \\.py/.test(document.getElementById('results').textContent)`), 'extension mismatch hinted');
    await evaluate(`__playground.removeFile(1)`);
    // C++: the parser loads on demand, a header counts as C++
    const cppText = '#include <cstdio>\n\nvoid greet(const char* name) {\n    printf(name);\n    printf("%s\\n", name);\n}\n';
    const cppRule = 'rules:\n  - id: fmt\n    languages: [cpp]\n    severity: WARNING\n    message: format string\n    pattern: printf($FMT)\n';
    await evaluate(`__playground.setLang('cpp'); __playground.clearFiles(); __playground.addFile('src/greet.cpp', ${JSON.stringify(cppText)}); __playground.addFile('include/greet.h', 'void greet(const char* name);\\n'); __playground.ruleEd.set(${JSON.stringify(cppRule)}); __playground.run()`);
    check(/^● 1 match in 1 of 2 files/.test(await summary()), `C++ rule matches with the parser loaded on demand (${(await summary()).slice(0, 60)})`);
    check(!(await evaluate(`/not end in/.test(document.getElementById('results').textContent)`)), 'a header counts as a C++ file');
    check((await evaluate(`[...document.querySelectorAll('#filelist .count')].map((e) => e.textContent).join(',')`)) === '1,0', 'per-file counts for C++');
    await evaluate(`__playground.engine.prefetchLanguage('cpp')`); // the pill reports the prefetch until it is done
    check(await evaluate(`__playground.engine.status === 'ready' && /engine: ready/.test(document.getElementById('engine-status').textContent)`), 'engine pill back to ready after the on-demand load');
    await evaluate(`__playground.setLang('python'); __playground.clearFiles(); __playground.addFile('pkg/app.py', ${JSON.stringify(py)})`);
    // a rule for the other language is skipped by the engine: the page must say so
    await evaluate(`__playground.ruleEd.set(${JSON.stringify(csRule)}); __playground.run()`);
    check(await evaluate(`/No rule lists/.test((document.querySelector('#results .msg.warn') || {}).textContent || '')`), 'language mismatch warned');
    check(/^○ 0 matches/.test(await summary()), 'language mismatch yields no matches');
    // YAML error path
    await evaluate(`__playground.ruleEd.set('rules:\\n  - id: x\\n    pattern: [unclosed'); __playground.run()`);
    check(await evaluate(`!!document.querySelector('#rule-messages .msg.error')`), 'YAML error surfaced');
    // the language survives a reload
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/playground.html` });
    await waitFor(`window.__playground && __playground.ruleEd`, 15000, 'playground reload');
    check((await evaluate(`__playground.state.lang + '/' + document.getElementById('lang').value`)) === 'python/python', 'language remembered');
    check((await evaluate(`__playground.files[0].path`)) === 'sample/main.py', 'python sample loaded');
    // hand-over from a challenge
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/challenge.html#/${first.id}` });
    await waitFor(`window.__dojo && __dojo.ruleEd`, 15000, 'challenge page');
    await evaluate(`document.getElementById('open-playground').click()`);
    await waitFor(`location.pathname.endsWith('playground.html') && window.__playground && __playground.files.length === 1`, 15000, 'hand-over');
    check((await evaluate(`__playground.files[0].path`)) === first.target_path, 'challenge target handed over');
    check((await evaluate(`__playground.ruleEd.get()`)) === first.starter, 'challenge rule handed over');
    check((await evaluate(`__playground.state.lang`)) === 'csharp', 'hand-over sets C#');
    check((await evaluate(`sessionStorage.getItem('semgrep-dojo.playground.handoff')`)) === null, 'hand-over consumed');
  }
  if (consoleErrors.length) { console.log('console errors:'); consoleErrors.forEach((e) => console.log('   ' + String(e).slice(0, 300))); }
  check(consoleErrors.length === 0, 'no console errors');
} catch (e) { console.log('ERROR', e.message || e); failures++; }
finally { browser.kill(); server.kill(); setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500); }
console.log(failures ? `\n${failures} failure(s)` : '\nall browser checks passed');
process.exit(failures ? 1 : 0);
