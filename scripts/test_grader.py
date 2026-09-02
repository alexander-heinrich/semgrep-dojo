#!/usr/bin/env python3
"""Shared-fixture test for the Python grader/annotation parser (mirror of scripts/test_grader.mjs)."""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build
fx = json.loads((Path(__file__).resolve().parent.parent / "tests" / "grader-fixtures.json").read_text())
failed = 0
for t in fx["annotations"]:
    got = build.parse_annotations(t["text"], t["ruleId"])
    ok = got == t["expect"]; failed += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} annotations: {t['name']}" + ("" if ok else f" got={got}"))
for t in fx["grades"]:
    g = build.grade(t["result"], t["expected"], t["wasm"])
    got = {k: g[k] for k in t["expect"]}
    ok = got == t["expect"]; failed += not ok
    print(f"  {'ok  ' if ok else 'FAIL'} grade: {t['name']}" + ("" if ok else f" got={got}"))
print("python grader:", "all fixtures pass" if not failed else f"{failed} failure(s)")
sys.exit(1 if failed else 0)
