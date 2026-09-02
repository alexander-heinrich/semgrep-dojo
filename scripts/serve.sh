#!/bin/sh
# Serve the static site locally (GitHub Pages equivalent). Open http://127.0.0.1:8000/
cd "$(dirname "$0")/.." && exec python3 -m http.server 8000 --bind 127.0.0.1 -d docs
