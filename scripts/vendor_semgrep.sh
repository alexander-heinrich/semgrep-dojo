#!/bin/sh
# Re-download the pinned Semgrep WASM builds into docs/vendor/semgrep and refresh SHA256SUMS.
set -e
cd "$(dirname "$0")/../docs/vendor/semgrep"
curl -sSL -o engine-1.17.1-alpha.2.mjs "https://cdn.jsdelivr.net/npm/@semgrep/engine@1.17.1-alpha.2/dist/index.mjs"
curl -sSL -o csharp-1.17.1-alpha.0.mjs "https://cdn.jsdelivr.net/npm/@semgrep/languages@1.17.1-alpha.0/dist/csharp/index.mjs"
curl -sSL -o python-0.0.4.mjs "https://cdn.jsdelivr.net/npm/@semgrep/lang-python@0.0.4/dist/index.mjs"
curl -sSL -o semgrep-parser.wasm "https://cdn.jsdelivr.net/npm/@semgrep/lang-python@0.0.4/dist/semgrep-parser.wasm"
shasum -a 256 *.mjs *.wasm > SHA256SUMS
cat SHA256SUMS
