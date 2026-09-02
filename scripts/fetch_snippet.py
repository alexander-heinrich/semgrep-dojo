#!/usr/bin/env python3
"""Fetch a real-world C# file from GitHub at a pinned commit and print a numbered listing plus
ready-to-paste attribution blocks for a challenge.

Usage: python3 scripts/fetch_snippet.py owner/repo path/to/File.cs <sha-or-ref> [--lines A-B] [--write target.cs]

Requires the GitHub CLI (`gh`) to be authenticated. Prints:
  * the resolved full commit SHA, the repo's SPDX license id and the copyright line from its LICENSE
  * the numbered file (or the requested window)
  * a `sources:` YAML entry and the 3-line header for target.cs
With --write, writes the window (header + code, no annotations yet) to the given file.
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys


def gh(path: str) -> dict:
    r = subprocess.run(["gh", "api", path], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"gh api {path} failed: {r.stderr.strip()[:300]}")
    return json.loads(r.stdout)


def main(argv: list[str]) -> int:
    if len(argv) < 3 or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    repo, path, ref = argv[0], argv[1], argv[2]
    lines = None
    write = None
    if "--lines" in argv:
        a, b = argv[argv.index("--lines") + 1].split("-")
        lines = (int(a), int(b))
    if "--write" in argv:
        write = argv[argv.index("--write") + 1]

    commit = gh(f"repos/{repo}/commits/{ref}")["sha"]
    content = gh(f"repos/{repo}/contents/{path}?ref={commit}")
    text = base64.b64decode(content["content"]).decode("utf-8", errors="replace")
    lic = gh(f"repos/{repo}/license")
    spdx = (lic.get("license") or {}).get("spdx_id", "NOASSERTION")
    lic_text = base64.b64decode(lic.get("content", "")).decode("utf-8", errors="replace") if lic.get("content") else ""
    m = re.search(r"Copyright\s*(?:\(c\)|©)?\s*[^\n]{0,120}", lic_text, re.I)
    copyright_line = m.group(0).strip() if m else ""
    all_lines = text.split("\n")
    a, b = lines or (1, len(all_lines))
    window = all_lines[a - 1:b]
    url = f"https://github.com/{repo}/blob/{commit}/{path}"

    print(f"# {repo} @ {commit}  license={spdx}  {copyright_line}")
    print(f"# {url}#L{a}-L{b}   ({len(all_lines)} lines total)\n")
    for i, l in enumerate(window, start=a):
        print(f"{i:4d}  {l}")
    holder = re.sub(r"^Copyright\s*(?:\(c\)|©)?\s*", "", copyright_line, flags=re.I)
    header = (f"// Source: {url}  (lines {a}-{b})\n"
              f"// Copyright (c) {holder}. Licensed under {spdx}. See THIRD_PARTY_NOTICES.md.\n"
              f"// Modified for this tutorial: no\n")
    print("\n# ---- paste into challenge.yaml ----")
    print("sources:")
    print(f"  - repo: {repo}")
    print(f"    path: {path}")
    print(f"    commit: {commit}")
    print(f"    license: {spdx}")
    print(f"    copyright: {json.dumps(holder)}")
    print(f"    url: {url}")
    print(f"    lines: [4, {3 + len(window)}]   # adjust after adding annotation lines")
    print(f"    modified: false")
    print("\n# ---- header for target.cs ----")
    print(header)
    if write:
        with open(write, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(window).rstrip("\n") + "\n")
        print(f"wrote {write}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
