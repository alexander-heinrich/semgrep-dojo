# Semgrep Dojo — practice Semgrep rules on real C# code

A static site (GitHub Pages) plus a CLI checker for learning the
[Semgrep pattern syntax](https://semgrep.dev/docs/writing-rules/pattern-syntax) and
[rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax) the way the official
[semgrep.dev/learn](https://semgrep.dev/learn) tutorial does — but with new challenges, three
difficulty levels, and target code taken from real open-source .NET projects.

Live site: https://alexander-heinrich.github.io/Semgrep-Dojo/

Your rule runs **in the browser** on a WebAssembly build of the Semgrep OSS engine; nothing is sent
anywhere. Grading works like `semgrep --test`: the set of matched start lines must equal the set of
`// ruleid:` lines in the target.

## Practice loop (browser)

1. Open a challenge, read the left pane, look at the ▶ (must match) and ○ (must not match) markers.
2. Edit `rule.yaml`, press **Run** (or Ctrl/Cmd+Enter). Green = matched as expected, red = false
   positive, orange = missed.
3. Use hints if stuck; **Show solution** counts the challenge as solved-with-help.
4. The home page tracks progress in your browser and offers a daily pick.

## Practice loop (terminal, real Semgrep)

```sh
pip install -r requirements.txt          # pyyaml
python3 scripts/check.py challenges/csharp/1-basics/07-any-depth --start
$EDITOR workspace/07-any-depth/rule.yaml
python3 scripts/check.py challenges/csharp/1-basics/07-any-depth workspace/07-any-depth/rule.yaml
python3 scripts/check.py challenges/csharp/1-basics/07-any-depth --hint      # next hint
python3 scripts/check.py challenges/csharp/1-basics/07-any-depth --solution
```

Every challenge works both ways; the terminal path uses whatever `semgrep` (or Opengrep, see below) is
on your `PATH`.

## Repository layout

| path | what |
|---|---|
| `challenges/csharp/<level>/<NN-slug>/` | one challenge = `challenge.yaml`, `starter.yaml`, `solution.yaml`, `target.cs` (format: `challenges/README.md`) |
| `scripts/build.py` | validates every challenge with the local Semgrep CLI and writes `docs/data/challenges.json` + the attribution block of `THIRD_PARTY_NOTICES.md` |
| `scripts/check.py` | terminal practice (above) |
| `scripts/wasm_parity.mjs` | runs every solution through the browser engine (Node build) and compares with the CLI result |
| `scripts/network_check.mjs` | records every request a rule run makes and fails if any leaves the local origin |
| `scripts/browser-test.mjs` | end-to-end check in headless Chrome over the DevTools protocol |
| `scripts/fetch_snippet.py` | fetches a file from GitHub at a pinned commit and prints attribution blocks for authoring |
| `scripts/update_engine.sh` | refreshes the vendored engine from a checkout of Semgrep-WASM |
| `scripts/vendor.mjs` | rebuild the CodeMirror editor bundle |
| `docs/` | the static site (served by GitHub Pages from `main` / `docs`) |

## Building and testing

```sh
npm install                      # only for scripts/vendor.mjs and wasm_parity (js-yaml for ad-hoc runs)
python3 scripts/build.py         # validate all challenges, emit docs/data/challenges.json
node scripts/wasm_parity.mjs     # browser-engine parity for every challenge
node scripts/network_check.mjs   # confirms a rule run makes no external requests
node scripts/browser-test.mjs --all   # headless Chrome end-to-end (needs Google Chrome installed)
sh scripts/serve.sh              # http://127.0.0.1:8000/
```

Publishing is "push to publish": everything under `docs/` is static. After changing challenges run
`build.py` and commit `docs/data/challenges.json` and `THIRD_PARTY_NOTICES.md`.

## Adding a challenge

See `challenges/README.md` for the schema and authoring rules. In short: pick a permissively
licensed project, pin a commit, keep the snippet ≤ ~90 lines, annotate with `// ruleid:` / `// ok:`,
write a starter that is a plausible near-miss, validate with
`python3 scripts/build.py --only <slug> --emit-to /tmp/x.json && node scripts/wasm_parity.mjs --data /tmp/x.json`.

## The browser engine

The site runs a WebAssembly build of the Semgrep OSS engine (js_of_ocaml + emscripten) built from the
Semgrep source tree at tag `v1.81.0` (July 2024), the last release that still contains the browser
build tooling. The build, its reproducible Docker recipe, the loaders and the suites that show it agreeing
with the current Semgrep release live in a separate repository:
**https://github.com/alexander-heinrich/Semgrep-WASM**. `docs/vendor/semgrep/` is a verbatim copy of its
`dist/` (engine, parsers, the worker and Node loader, licence, checksums); `sh scripts/update_engine.sh`
refreshes it from a sibling checkout, verifies the checksums and records the source revision in
`docs/vendor/semgrep/SOURCE`.

Every check in that repository runs on C#, the only language the site exposes; the same challenges also
pass unchanged on Opengrep 1.29.0. Everything is LGPL-2.1 and unmodified; see `THIRD_PARTY_NOTICES.md`.

## License

Site code and prose: MIT. The vendored Semgrep engine and parsers are LGPL-2.1, used unmodified and
loaded as separate modules; `THIRD_PARTY_NOTICES.md` records the obligations and how they are met, and
the Semgrep-WASM repository holds the corresponding build recipe. Challenge target code keeps its upstream
licence and attribution.

Not affiliated with, sponsored by, or endorsed by Semgrep, Inc. "Semgrep" is a trademark of Semgrep, Inc.
and is used here only to refer to their software.
