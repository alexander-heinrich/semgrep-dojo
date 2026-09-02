#!/usr/bin/env python3
"""Attribution check: every code line of each target.cs must exist verbatim in the pinned upstream file.

Usage: python3 scripts/verify_sources.py [--only SUBSTRING] [--fix-lines]

For each challenge, each `sources:` entry is fetched (gh api, cached in scripts/.cache/sources/) and every
line of target.cs that is not the 3-line header, an annotation comment (`// ruleid:` etc.) or an
`// ... (omitted)` marker is looked up (whitespace-normalised) in the upstream files. Lines that are
not found are reported; a challenge whose sources say `modified: false` fails if any line is missing.
With --fix-lines, `sources[*].lines` is rewritten to the first/last target line attributed to each source.
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".cache" / "sources"
ANNOTATION = re.compile(r"^\s*//\s*(ruleid|ok|todoruleid|todook)\s*:")
OMITTED = re.compile(r"^\s*//\s*\.\.\.\s*\(omitted\)\s*$")
# lines we allow to differ from upstream when the challenge wraps a file-scoped namespace or trims
STRUCTURAL = re.compile(r"^\s*(\{|\}|\}\s*;|namespace\s+[\w.]+\s*\{?|#pragma .*|#region.*|#endregion.*)\s*$")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip())


def fetch(repo: str, path: str, commit: str) -> list[str]:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = re.sub(r"[^A-Za-z0-9._-]", "_", f"{repo}@{commit}@{path}")
    f = CACHE / key
    if not f.exists():
        r = subprocess.run(["gh", "api", f"repos/{repo}/contents/{path}?ref={commit}", "--jq", ".content"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"gh api failed for {repo}/{path}@{commit[:10]}: {r.stderr.strip()[:200]}")
        f.write_bytes(base64.b64decode(r.stdout))
    return f.read_text(encoding="utf-8", errors="replace").lstrip("﻿").split("\n")


def check(cdir: Path, fix_lines: bool) -> tuple[bool, list[str]]:
    meta = yaml.safe_load((cdir / "challenge.yaml").read_text(encoding="utf-8"))
    target = (cdir / "target.cs").read_text(encoding="utf-8").split("\n")
    sources = meta["sources"]
    upstream = []
    for s in sources:
        lines = fetch(s["repo"], s["path"], s["commit"])
        upstream.append({norm(l) for l in lines if norm(l)})
    msgs = []
    attributed: dict[int, list[int]] = {i: [] for i in range(len(sources))}
    missing = []
    for i, line in enumerate(target, start=1):
        if i <= 3 or ANNOTATION.match(line) or OMITTED.match(line) or not line.strip():
            continue
        n = norm(line)
        found = [k for k, up in enumerate(upstream) if n in up]
        if found:
            # a line present in several sources (shared `using`s, braces) is attributed to the source whose
            # declared range contains it, so composite targets keep non-overlapping ranges
            declared = [k for k in found if len(sources[k].get("lines", [])) == 2 and sources[k]["lines"][0] <= i <= sources[k]["lines"][1]]
            for k in (declared or found):
                attributed[k].append(i)
        elif STRUCTURAL.match(line):
            continue
        else:
            missing.append((i, line.strip()[:100]))
    ok = True
    if missing:
        for i, l in missing:
            msgs.append(f"line {i} not found upstream: {l}")
        if any(not s.get("modified") for s in sources):
            ok = False
            msgs.append("sources say modified: false but lines differ from upstream")
        else:
            msgs.append("(sources are marked modified: true — verify the modification_note covers this)")
    # lines ranges
    for k, s in enumerate(sources):
        if not attributed[k]:
            msgs.append(f"source {k} ({s['repo']}) contributes no line to target.cs")
            ok = False
            continue
        lo, hi = min(attributed[k]), max(attributed[k])
        want = [lo, hi]
        if list(s.get("lines", [])) != want:
            if fix_lines:
                s["lines"] = want
                msgs.append(f"source {k}: lines {s.get('lines')} set to {want}")
            else:
                msgs.append(f"source {k}: lines {s.get('lines')} but attributed range is {want}")
    if fix_lines and msgs:
        text = (cdir / "challenge.yaml").read_text(encoding="utf-8")
        # rewrite only the `lines:` entries in order
        entries = list(re.finditer(r"^(\s*lines:\s*)\[[^\]]*\]", text, flags=re.M))
        if len(entries) == len(sources):
            out, pos = [], 0
            for m, s in zip(entries, sources):
                out.append(text[pos:m.start()] + m.group(1) + f"[{s['lines'][0]}, {s['lines'][1]}]")
                pos = m.end()
            out.append(text[pos:])
            (cdir / "challenge.yaml").write_text("".join(out), encoding="utf-8")
    return ok, msgs


def main(argv) -> int:
    only = argv[argv.index("--only") + 1] if "--only" in argv else None
    fix = "--fix-lines" in argv
    failed = 0
    for lang in sorted((ROOT / "challenges").iterdir()):
        if not lang.is_dir():
            continue
        for level in sorted(lang.iterdir()):
            if not level.is_dir():
                continue
            for cdir in sorted(level.iterdir()):
                if not (cdir / "challenge.yaml").exists() or (only and only not in str(cdir)):
                    continue
                try:
                    ok, msgs = check(cdir, fix)
                except Exception as e:
                    ok, msgs = False, [f"error: {e}"]
                rel = cdir.relative_to(ROOT / "challenges")
                print(f"  {'ok  ' if ok else 'FAIL'} {rel}" + ("" if not msgs else "\n" + "\n".join("        " + m for m in msgs)))
                failed += not ok
    print(f"\n{failed} failure(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
