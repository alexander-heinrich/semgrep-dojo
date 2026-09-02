#!/usr/bin/env python3
"""Practice a challenge from the terminal with the real Semgrep CLI.

Usage:
  python3 scripts/check.py <challenge-dir> [rule.yaml]   grade a rule file (default: the starter)
  python3 scripts/check.py <challenge-dir> --start       copy the starter to workspace/<slug>/rule.yaml and print the task
  python3 scripts/check.py <challenge-dir> --hint        show the next hint (call again for the next one)
  python3 scripts/check.py <challenge-dir> --solution    show the reference solution

Example loop:
  python3 scripts/check.py challenges/csharp/1-basics/07-any-depth --start
  $EDITOR workspace/07-any-depth/rule.yaml
  python3 scripts/check.py challenges/csharp/1-basics/07-any-depth workspace/07-any-depth/rule.yaml
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WORKSPACE = ROOT / "workspace"


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cdir = Path(argv[0]).resolve()
    if not (cdir / "challenge.yaml").exists():
        print(f"not a challenge directory: {cdir}", file=sys.stderr)
        return 2
    ch = build.load_challenge(cdir)
    ws = WORKSPACE / ch["slug"]
    state = ws / ".state.json"
    st = json.loads(state.read_text()) if state.exists() else {"hints": 0}

    if "--start" in argv:
        ws.mkdir(parents=True, exist_ok=True)
        (ws / "rule.yaml").write_text(ch["starter"], encoding="utf-8")
        (ws / ch["target_path"].replace("/", "_")).write_text(ch["target"], encoding="utf-8")
        print(f"# {ch['title']}  (level {ch['level']}, difficulty {ch['difficulty']}/5)\n")
        print(ch["instructions"])
        print(f"\nStarter copied to {ws / 'rule.yaml'} — edit it, then run:\n  python3 scripts/check.py {argv[0]} {ws / 'rule.yaml'}")
        return 0
    if "--hint" in argv:
        if st["hints"] >= len(ch["hints"]):
            print("No more hints." if ch["hints"] else "This challenge has no hints.")
            return 0
        print(f"Hint {st['hints'] + 1}/{len(ch['hints'])}: {ch['hints'][st['hints']]}")
        st["hints"] += 1
        ws.mkdir(parents=True, exist_ok=True)
        state.write_text(json.dumps(st))
        return 0
    if "--solution" in argv:
        print(ch["solution"])
        return 0

    rule_path = Path(argv[1]) if len(argv) > 1 else None
    rule_text = rule_path.read_text(encoding="utf-8") if rule_path else ch["starter"]
    ann = ch["annotations"]
    expected = {"ruleId": ch["rule_id"], "grade": ch["grade"], "ruleidLines": ann["ruleid"], "okLines": ann["ok"],
                "todoLines": ann["todoruleid"], "ranges": None, "fixes": None}
    if ch["grade"] in ("ranges", "fixes"):
        # derive from the reference solution, exactly like build.py
        expected = build.validate_with_cli(ch, lambda *a: None)
    res = build.run_semgrep(rule_text, ch["target"], ch["target_path"])
    g = build.grade(res, expected)
    src = rule_path or "starter.yaml"
    if g["status"] == "error":
        print(f"ERROR — semgrep could not run {src}:")
        for e in g["errors"]:
            print("  " + e)
        return 1
    lines = ch["target"].split("\n")
    show = lambda n: f"  line {n:3d}: {lines[n - 1].strip()[:90]}"
    print(f"{'PASS' if g['status'] == 'pass' else 'FAIL'} — {src} against {cdir.name} ({len(g['matchedLines'])} match(es))")
    if g["matchedLines"]:
        print("matched:")
        for n in g["matchedLines"]:
            tag = "expected" if n in expected["ruleidLines"] or n in expected["todoLines"] else ("marked ok — false positive" if n in g["unexpectedOk"] else "unannotated — false positive")
            print(show(n) + f"   [{tag}]")
    if g["missed"]:
        print("missed (false negatives):")
        for n in g["missed"]:
            print(show(n))
    if g["otherIds"]:
        print(f"note: matches from other rule ids were ignored: {', '.join(g['otherIds'])} (this challenge grades `{ch['rule_id']}`)")
    for d in g.get("details", []):
        print("details:", json.dumps(d))
    if g["status"] == "pass":
        print(f"\n{ch['followup_title']}\n{ch['followup']}")
    elif ch["hints"] and st["hints"] < len(ch["hints"]):
        print(f"\n({len(ch['hints']) - st['hints']} hint(s) available: --hint)")
    return 0 if g["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
