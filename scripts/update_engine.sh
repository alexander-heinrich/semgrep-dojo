#!/bin/sh
# Refreshes the vendored browser engine from a checkout of Semgrep-WASM (default: a sibling directory).
# docs/vendor/semgrep/ is a verbatim copy of that repository's dist/ (engine, parsers, loader files, licence,
# SHA256SUMS, VERSIONS.md); SOURCE records which revision it came from.
# Usage: sh scripts/update_engine.sh [PATH_TO_SEMGREP_WASM]
set -eu
cd "$(dirname "$0")/.."
SRC="${1:-../Semgrep-WASM}"
test -f "$SRC/dist/SHA256SUMS" || { echo "no dist/SHA256SUMS under $SRC — clone https://github.com/alexander-heinrich/Semgrep-WASM next to this repo" >&2; exit 1; }
DEST=docs/vendor/semgrep
mkdir -p "$DEST"
rm -f "$DEST"/*
cp "$SRC"/dist/* "$DEST"/
(cd "$DEST" && shasum -a 256 -c SHA256SUMS --quiet)
{
  echo "Semgrep-WASM $(git -C "$SRC" describe --tags --always --dirty)"
  echo "commit $(git -C "$SRC" rev-parse HEAD)"
} > "$DEST/SOURCE"
echo "engine files match $SRC/dist/SHA256SUMS"; cat "$DEST/SOURCE"
