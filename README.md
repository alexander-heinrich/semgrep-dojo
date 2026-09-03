# Semgrep Dojo — practice Semgrep rules on real C# code

A static site (GitHub Pages) plus a CLI checker for learning the
[Semgrep pattern syntax](https://semgrep.dev/docs/writing-rules/pattern-syntax) and
[rule syntax](https://semgrep.dev/docs/writing-rules/rule-syntax) the way the official
[semgrep.dev/learn](https://semgrep.dev/learn) tutorial does — but with new challenges, three
difficulty levels, and target code taken from real open-source .NET projects.

Live site: https://alexander-heinrich.github.io/learn-semgrep/

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
| `scripts/browser-test.mjs` | end-to-end check in headless Chrome over the DevTools protocol |
| `scripts/fetch_snippet.py` | fetches a file from GitHub at a pinned commit and prints attribution blocks for authoring |
| `scripts/rebuild-engine/` | Dockerfile + scripts that rebuild the browser engine from the Semgrep source tree (see below) |
| `scripts/vendor.mjs` | rebuild the CodeMirror editor bundle |
| `docs/` | the static site (served by GitHub Pages from `main` / `docs`) |
| `spike/` | the feasibility spike for running Semgrep in the browser — read `spike/RESULTS.md` |

## Building and testing

```sh
npm install                      # only for scripts/vendor.mjs and wasm_parity (js-yaml for ad-hoc runs)
python3 scripts/build.py         # validate all challenges, emit docs/data/challenges.json
node scripts/wasm_parity.mjs     # browser-engine parity for every challenge
node scripts/semantics_check.mjs # 67 pattern-semantics checks against the browser engine
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

The site runs a WebAssembly build of the Semgrep OSS engine (js_of_ocaml + emscripten) that we build
ourselves from the Semgrep source tree at tag `v1.81.0` (July 2024), the last release that still
contains the `js/` build tooling — Semgrep moved it into its proprietary repository right after, and the
npm packages it once published stopped in April 2023. The C# and Python parsers (`metavariable-comparison`
parses its expression as Python) come from the same build.

```sh
sh scripts/rebuild-engine/build.sh     # Docker: OCaml 4.14 stage, then emscripten 3.1.51 stage → scripts/rebuild-engine/out/
sh scripts/rebuild-engine/install.sh   # copy into docs/vendor/semgrep/ under versioned names, refresh SHA256SUMS
```

The build pins the opam repository to a snapshot from the release day and takes about 15 minutes on an
Apple-silicon Mac with Colima (the emscripten stage runs under Rosetta). Everything is LGPL-2.1 and
unmodified; see `THIRD_PARTY_NOTICES.md`. `scripts/semantics_check.mjs`, `scripts/wasm_parity.mjs` and
the probes recorded in `spike/RESULTS.md` show this build agreeing with Semgrep 1.172.0 on every check;
the same challenges also pass unchanged on Opengrep 1.29.0.

## License

Site code and prose: MIT. Third-party components: see `THIRD_PARTY_NOTICES.md`.
