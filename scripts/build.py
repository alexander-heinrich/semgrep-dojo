#!/usr/bin/env python3
"""Validate every challenge with the local Semgrep CLI and emit docs/data/challenges.json.

Usage: python3 scripts/build.py [--only SUBSTRING] [--strict-coverage] [--quiet] [--no-emit]

For each challenge directory (challenges/<lang>/<level>/<NN-slug>/):
  * validate challenge.yaml against the schema in challenges/README.md
  * parse // ruleid: / // ok: annotations from target.cs
  * run solution.yaml with `semgrep scan --json` → must match exactly the annotated lines
  * run starter.yaml → must NOT already pass (unless intro: true)
  * compute expected ranges / rendered fixes from the solution run
Then write docs/data/challenges.json and regenerate the attribution block in THIRD_PARTY_NOTICES.md.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import coverage  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CHALLENGES = ROOT / "challenges"
DOCS_DATA = ROOT / "docs" / "data"
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"

ANNOTATION = re.compile(r"^\s*//\s*(ruleid|ok|todoruleid|todook)\s*:\s*(.+?)\s*$")
LEVEL_DIRS = {"1-basics": 1, "2-composition": 2, "3-advanced": 3}
LEVEL_NAMES = {1: "Basics", 2: "Composition", 3: "Advanced"}
GRADES = {"lines", "ranges", "fixes"}
WASM = {"expected", "todo", "cli-only"}


class ChallengeError(Exception):
    pass


# ----------------------------------------------------------------------------- annotations / grading
def parse_annotations(text: str, rule_id: str) -> dict[str, list[int]]:
    """Mirror of docs/js/annotations.js::parseAnnotations."""
    out = {"ruleid": [], "ok": [], "todoruleid": [], "todook": []}
    pending: list[str] = []
    for i, line in enumerate(text.split("\n")):
        m = ANNOTATION.match(line.rstrip("\r"))
        if m:
            ids = [s.strip() for s in m.group(2).split(",")]
            if rule_id in ids:
                pending.append(m.group(1))
            continue
        if pending:
            line_no = i + 1
            for kind in pending:
                if line_no not in out[kind]:
                    out[kind].append(line_no)
            pending = []
    for k in out:
        out[k].sort()
    return out


def _start_line(m: dict) -> int:
    return m["location"]["start"]["line"] if "location" in m else m["start"]["line"]


def _range_key(m: dict) -> str:
    s = m["location"]["start"] if "location" in m else m["start"]
    e = m["location"]["end"] if "location" in m else m["end"]
    return ":".join(str(x) for x in (s["line"], s["col"], e["line"], e["col"]))


def _rendered_fix(m: dict):
    extra = m.get("extra") or {}
    if isinstance(extra.get("fix"), str):
        return extra["fix"]
    if isinstance(extra.get("rendered_fix"), str):
        return extra["rendered_fix"]
    if isinstance(extra.get("fixed_lines"), list):
        return "\n".join(extra["fixed_lines"])
    return None


def describe_error(e) -> str:
    if isinstance(e, str):
        return e
    typ = e.get("error_type") or e.get("type") or ("error %s" % e.get("code") if e.get("code") is not None else "error")
    msg = e.get("message") or e.get("long_msg") or e.get("short_msg") or json.dumps(e)
    loc = ""
    if e.get("location") and e["location"].get("start"):
        loc = " (line %s)" % e["location"]["start"].get("line", "?")
    return re.sub(r"\s+", " ", f"{typ}: {msg}{loc}").strip()


def grade(result: dict, expected: dict, wasm: str = "expected") -> dict:
    """Mirror of docs/js/grader.js::grade. `expected` uses camelCase keys like the JS side."""
    errors = [describe_error(e) for e in (result.get("errors") or [])]
    if errors:
        return {"status": "error", "errors": errors, "matchedLines": [], "missed": [], "unexpected": [],
                "unexpectedOk": [], "otherIds": [], "details": [], "matches": []}
    want = set(expected["ruleidLines"])
    if wasm != "todo":
        want |= set(expected.get("todoLines") or [])
    ok_lines = set(expected.get("okLines") or [])
    mine, other = [], set()
    for m in result.get("matches") or []:
        rid = str(m.get("rule_id") or m.get("check_id") or "")
        if rid == expected["ruleId"] or rid.endswith("." + expected["ruleId"]):
            mine.append(m)
        else:
            other.add(rid)
    matched = sorted({_start_line(m) for m in mine})
    matched_set = set(matched)
    missed = sorted(l for l in want if l not in matched_set)
    unexpected = [l for l in matched if l not in want]
    unexpected_ok = [l for l in unexpected if l in ok_lines]
    passed = not missed and not unexpected
    details = []
    if passed and expected["grade"] == "ranges" and expected.get("ranges"):
        want_r = {":".join(str(x) for x in r) for r in expected["ranges"]}
        got_r = {_range_key(m) for m in mine}
        if want_r != got_r:
            passed = False
            details.append({"kind": "ranges", "missingRanges": sorted(want_r - got_r), "extraRanges": sorted(got_r - want_r)})
    if passed and expected["grade"] == "fixes" and expected.get("fixes"):
        bad = []
        for m in mine:
            line = str(_start_line(m))
            want_f = expected["fixes"].get(line)
            got_f = _rendered_fix(m) or ""
            if want_f is not None and got_f.rstrip() != want_f.rstrip():
                bad.append({"line": int(line), "want": want_f, "got": got_f})
        if bad:
            passed = False
            details.append({"kind": "fixes", "bad": bad})
    return {"status": "pass" if passed else "fail", "errors": [], "matchedLines": matched, "missed": missed,
            "unexpected": unexpected, "unexpectedOk": unexpected_ok, "otherIds": sorted(other), "details": details,
            "matches": mine}


# ----------------------------------------------------------------------------- semgrep CLI
def semgrep_version() -> str:
    try:
        return subprocess.run(["semgrep", "--version"], capture_output=True, text=True, timeout=60).stdout.strip().splitlines()[-1]
    except Exception as e:  # pragma: no cover
        raise ChallengeError(f"semgrep CLI not available: {e}")


def run_semgrep(rule_text: str, target_text: str, target_path: str) -> dict:
    """Run one rule file against one target with the local CLI; return {matches, errors, raw}."""
    with tempfile.TemporaryDirectory(prefix="dojo-") as tmp:
        tmp_p = Path(tmp)
        (tmp_p / "rule.yaml").write_text(rule_text, encoding="utf-8")
        tpath = tmp_p / target_path
        tpath.parent.mkdir(parents=True, exist_ok=True)
        tpath.write_text(target_text, encoding="utf-8")
        cmd = ["semgrep", "scan", "--metrics=off", "--quiet", "--json", "--no-git-ignore", "--disable-version-check",
               "--config", "rule.yaml", target_path]
        proc = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True, timeout=300)
        try:
            data = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            raise ChallengeError(f"semgrep produced no JSON (exit {proc.returncode}): {proc.stderr.strip()[:500]}")
    matches = []
    for r in data.get("results", []):
        matches.append({
            "rule_id": r.get("check_id", ""),
            "location": {"path": r.get("path"), "start": r["start"], "end": r["end"]},
            "extra": {"message": r.get("extra", {}).get("message"), "metavars": r.get("extra", {}).get("metavars", {}),
                      "fix": r.get("extra", {}).get("fix"), "fixed_lines": r.get("extra", {}).get("fixed_lines")},
        })
    return {"matches": matches, "errors": data.get("errors", []), "raw": data}


# ----------------------------------------------------------------------------- challenge loading
def load_challenge(cdir: Path) -> dict:
    rel = cdir.relative_to(CHALLENGES)
    parts = rel.parts
    if len(parts) != 3:
        raise ChallengeError(f"unexpected directory depth: {rel}")
    lang, level_dir, name = parts
    if level_dir not in LEVEL_DIRS:
        raise ChallengeError(f"unknown level directory {level_dir}")
    m = re.match(r"^(\d\d)-([a-z0-9][a-z0-9-]*)$", name)
    if not m:
        raise ChallengeError(f"directory name must be NN-slug: {name}")
    order, slug = int(m.group(1)), m.group(2)
    for f in ("challenge.yaml", "starter.yaml", "solution.yaml", "target.cs"):
        if not (cdir / f).exists():
            raise ChallengeError(f"missing {f}")
    meta = yaml.safe_load((cdir / "challenge.yaml").read_text(encoding="utf-8")) or {}
    starter = (cdir / "starter.yaml").read_text(encoding="utf-8")
    solution = (cdir / "solution.yaml").read_text(encoding="utf-8")
    target = (cdir / "target.cs").read_text(encoding="utf-8")

    def req(key, typ):
        if key not in meta:
            raise ChallengeError(f"challenge.yaml: missing `{key}`")
        if not isinstance(meta[key], typ):
            raise ChallengeError(f"challenge.yaml: `{key}` must be {typ.__name__}")
        return meta[key]

    title = req("title", str)
    level = req("level", int)
    if LEVEL_DIRS[level_dir] != level:
        raise ChallengeError(f"level {level} does not match directory {level_dir}")
    difficulty = req("difficulty", int)
    if not 1 <= difficulty <= 5:
        raise ChallengeError("difficulty must be 1..5")
    rule_id = req("rule_id", str)
    instructions = req("instructions", str)
    followup = req("followup", str)
    hints = meta.get("hints") or []
    if not isinstance(hints, list) or not all(isinstance(h, str) for h in hints):
        raise ChallengeError("hints must be a list of strings")
    tags = meta.get("tags") or []
    if not isinstance(tags, list) or not all(re.match(r"^[a-z0-9][a-z0-9-]*$", t) for t in tags):
        raise ChallengeError("tags must be lower-kebab-case strings")
    covers = meta.get("covers") or {}
    cov_cs = covers.get("cheatsheet") or []
    cov_rk = covers.get("rule_keys") or []
    for c in cov_cs:
        if c not in coverage.CHEATSHEET:
            raise ChallengeError(f"covers.cheatsheet: unknown entry `{c}` (see scripts/coverage.py)")
    for c in cov_rk:
        if c not in coverage.RULE_KEYS:
            raise ChallengeError(f"covers.rule_keys: unknown entry `{c}` (see scripts/coverage.py)")
    grade_mode = meta.get("grade", "lines")
    if grade_mode not in GRADES:
        raise ChallengeError(f"grade must be one of {sorted(GRADES)}")
    wasm = meta.get("wasm", "expected")
    if wasm not in WASM:
        raise ChallengeError(f"wasm must be one of {sorted(WASM)}")
    target_path = meta.get("target_path", "target.cs")
    if not isinstance(target_path, str) or target_path.startswith("/") or ".." in target_path:
        raise ChallengeError("target_path must be a relative path")
    intro = bool(meta.get("intro", False))
    starter_expects_error = bool(meta.get("starter_expects_error", False))
    sources = meta.get("sources") or []
    if not sources:
        raise ChallengeError("sources: at least one real-world source is required")
    for s in sources:
        for k in ("repo", "path", "commit", "license", "url", "lines"):
            if k not in s:
                raise ChallengeError(f"sources: missing `{k}`")
        if not re.match(r"^[0-9a-f]{40}$", str(s["commit"])):
            raise ChallengeError(f"sources: commit must be a full 40-char sha ({s['commit']})")
        if s["license"] not in coverage.LICENSES:
            raise ChallengeError(f"sources: license {s['license']} is not in the allowed list")
        if not (isinstance(s["lines"], list) and len(s["lines"]) == 2):
            raise ChallengeError("sources: lines must be [start, end]")
        s.setdefault("modified", False)
        s.setdefault("modification_note", "")
        s.setdefault("copyright", "")

    header = target.split("\n")[:3]
    if not (len(header) == 3 and header[0].startswith("// Source:") and header[1].startswith("// Copyright")
            and header[2].startswith("// Modified for this tutorial:")):
        raise ChallengeError("target.cs must start with the 3-line attribution header (see challenges/README.md)")

    sol_rules = yaml.safe_load(solution) or {}
    if not isinstance(sol_rules.get("rules"), list) or len(sol_rules["rules"]) < 1:
        raise ChallengeError("solution.yaml must contain a `rules:` list")
    if sol_rules["rules"][0].get("id") != rule_id:
        raise ChallengeError(f"solution.yaml rule id {sol_rules['rules'][0].get('id')!r} != rule_id {rule_id!r}")
    try:
        starter_rules = yaml.safe_load(starter)
    except yaml.YAMLError as e:
        if not starter_expects_error:
            raise ChallengeError(f"starter.yaml does not parse: {e}")
        starter_rules = None

    ann = parse_annotations(target, rule_id)
    if not ann["ruleid"] and not ann["todoruleid"] and not intro and grade_mode != "lines":
        raise ChallengeError("no `// ruleid:` annotations for this rule_id")
    # Every annotation id in the file should be known (catches typos in ids).
    all_ids = set()
    for line in target.split("\n"):
        m = ANNOTATION.match(line)
        if m:
            all_ids.update(s.strip() for s in m.group(2).split(","))
    if rule_id not in all_ids and not intro:
        raise ChallengeError(f"target.cs has no annotation for rule_id {rule_id!r} (found ids: {sorted(all_ids)})")

    return {
        "id": f"{lang}/{level_dir}/{name}", "lang": lang, "level": level, "level_name": LEVEL_NAMES[level],
        "order": order, "slug": slug, "dir": str(cdir), "title": title, "difficulty": difficulty, "intro": intro,
        "rule_id": rule_id, "target_path": target_path, "tags": tags,
        "covers": {"cheatsheet": cov_cs, "rule_keys": cov_rk}, "grade": grade_mode, "wasm": wasm,
        "starter_expects_error": starter_expects_error, "instructions": instructions, "hints": hints,
        "followup_title": meta.get("followup_title", "Correct!"), "followup": followup, "sources": sources,
        "starter": starter, "solution": solution, "target": target, "solution_rules": sol_rules,
        "starter_rules": starter_rules, "annotations": ann,
    }


def validate_with_cli(ch: dict, log) -> dict:
    """Run solution + starter; return the `expected` block for the JSON (camelCase, like the JS grader)."""
    ann = ch["annotations"]
    expected = {"ruleId": ch["rule_id"], "grade": ch["grade"], "ruleidLines": ann["ruleid"], "okLines": ann["ok"],
                "todoLines": ann["todoruleid"], "todookLines": ann["todook"], "ranges": None, "fixes": None}
    sol = run_semgrep(ch["solution"], ch["target"], ch["target_path"])
    if sol["errors"]:
        raise ChallengeError("solution.yaml: semgrep reported errors: " + "; ".join(describe_error(e) for e in sol["errors"])[:800])
    if ch["grade"] == "ranges":
        expected["ranges"] = sorted([int(x) for x in _range_key(m).split(":")] for m in sol["matches"]
                                    if str(m["rule_id"]).endswith(ch["rule_id"]))
    if ch["grade"] == "fixes":
        fixes = {}
        for m in sol["matches"]:
            if not str(m["rule_id"]).endswith(ch["rule_id"]):
                continue
            f = _rendered_fix(m)
            if f is None:
                raise ChallengeError(f"grade: fixes but semgrep produced no fix for line {_start_line(m)}")
            fixes[str(_start_line(m))] = f
        expected["fixes"] = fixes
    g = grade(sol, expected, wasm="expected")
    if g["status"] != "pass":
        raise ChallengeError(
            "solution.yaml does not match the annotations: matched=%s missed=%s unexpected=%s details=%s otherIds=%s"
            % (g["matchedLines"], g["missed"], g["unexpected"], g["details"], g["otherIds"]))
    # metavariable bindings of the solution (for the UI's "Show solution" explanation)
    expected["solutionMatches"] = [{"line": _start_line(m), "metavars": {k: (v.get("abstract_content") if isinstance(v, dict) else v)
                                     for k, v in (m.get("extra", {}).get("metavars") or {}).items()}} for m in sol["matches"]]
    if ch["starter_rules"] is not None:
        st = run_semgrep(ch["starter"], ch["target"], ch["target_path"])
        if st["errors"] and not ch["starter_expects_error"]:
            raise ChallengeError("starter.yaml: semgrep reported errors: " + "; ".join(describe_error(e) for e in st["errors"])[:500])
        gs = grade(st, expected, wasm="expected")
        if gs["status"] == "pass" and not ch["intro"]:
            raise ChallengeError("starter.yaml already passes; the challenge has nothing to solve (set intro: true if intended)")
        expected["starterMatchedLines"] = gs["matchedLines"]
    return expected


# ----------------------------------------------------------------------------- notices
NOTICE_BEGIN = "<!-- BEGIN GENERATED SOURCES -->"
NOTICE_END = "<!-- END GENERATED SOURCES -->"


def render_sources_block(challenges: list[dict]) -> str:
    by_license: dict[str, list[tuple]] = {}
    for ch in challenges:
        for s in ch["sources"]:
            by_license.setdefault(s["license"], []).append((s["repo"], s["path"], s["commit"], s.get("copyright", ""),
                                                            s.get("modified", False), ch["id"]))
    out = [NOTICE_BEGIN, "", "Generated by `scripts/build.py` from `sources:` in every challenge.yaml.", ""]
    for lic in sorted(by_license):
        out.append(f"### {lic}")
        out.append("")
        out.append("| repository | file @ commit | copyright | modified | used by |")
        out.append("|---|---|---|---|---|")
        for repo, path, commit, cpy, modified, cid in sorted(set(by_license[lic])):
            url = f"https://github.com/{repo}/blob/{commit}/{path}"
            out.append(f"| [{repo}](https://github.com/{repo}) | [{path}]({url}) @ `{commit[:12]}` | {cpy} | {'yes' if modified else 'no'} | `{cid}` |")
        out.append("")
    out.append(NOTICE_END)
    return "\n".join(out)


def update_notices(challenges: list[dict]) -> None:
    block = render_sources_block(challenges)
    if NOTICES.exists():
        text = NOTICES.read_text(encoding="utf-8")
        if NOTICE_BEGIN in text and NOTICE_END in text:
            pre = text[: text.index(NOTICE_BEGIN)]
            post = text[text.index(NOTICE_END) + len(NOTICE_END):]
            NOTICES.write_text(pre + block + post, encoding="utf-8")
            return
        NOTICES.write_text(text.rstrip() + "\n\n## Challenge target code\n\n" + block + "\n", encoding="utf-8")
    else:
        NOTICES.write_text("# Third-party notices\n\n## Challenge target code\n\n" + block + "\n", encoding="utf-8")


# ----------------------------------------------------------------------------- main
def discover(only: str | None) -> list[Path]:
    dirs = []
    for lang in sorted(CHALLENGES.iterdir()):
        if not lang.is_dir():
            continue
        for level in sorted(lang.iterdir()):
            if not level.is_dir() or level.name not in LEVEL_DIRS:
                continue
            for c in sorted(level.iterdir()):
                if c.is_dir() and (c / "challenge.yaml").exists():
                    if only and only not in str(c.relative_to(CHALLENGES)):
                        continue
                    dirs.append(c)
    return dirs


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="only challenges whose path contains this substring")
    ap.add_argument("--strict-coverage", action="store_true", help="fail when the catalogue does not cover every entry")
    ap.add_argument("--no-emit", action="store_true", help="validate only; do not write challenges.json / notices")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--emit-to", help="write challenges.json to this path even with --only (for parity checks); notices untouched")
    args = ap.parse_args(argv)

    log = (lambda *a: None) if args.quiet else (lambda *a: print(*a))
    ver = semgrep_version()
    log(f"semgrep {ver}")
    dirs = discover(args.only)
    if not dirs:
        print("no challenges found", file=sys.stderr)
        return 1
    ok, failed = [], []
    for cdir in dirs:
        rel = cdir.relative_to(CHALLENGES)
        try:
            ch = load_challenge(cdir)
            ch["expected"] = validate_with_cli(ch, log)
            ok.append(ch)
            log(f"  ok    {rel}  ({len(ch['expected']['ruleidLines'])} expected line(s), wasm={ch['wasm']})")
        except ChallengeError as e:
            failed.append((rel, str(e)))
            print(f"  FAIL  {rel}: {e}", file=sys.stderr)
        except Exception as e:  # pragma: no cover
            failed.append((rel, f"{type(e).__name__}: {e}"))
            print(f"  FAIL  {rel}: {type(e).__name__}: {e}", file=sys.stderr)

    # coverage report
    cov_cs, cov_rk = set(), set()
    for ch in ok:
        cov_cs.update(ch["covers"]["cheatsheet"])
        cov_rk.update(ch["covers"]["rule_keys"])
    missing_cs = sorted(set(coverage.CHEATSHEET) - coverage.OPTIONAL_CHEATSHEET - cov_cs)
    missing_rk = sorted(set(coverage.RULE_KEYS) - coverage.OPTIONAL_RULE_KEYS - cov_rk)
    if not args.only:
        log(f"coverage: cheatsheet {len(cov_cs)}/{len(coverage.CHEATSHEET) - len(coverage.OPTIONAL_CHEATSHEET)} required entries, "
            f"rule keys {len(cov_rk)}/{len(coverage.RULE_KEYS)}")
        if missing_cs:
            log("  uncovered cheatsheet entries: " + ", ".join(missing_cs))
        if missing_rk:
            log("  uncovered rule keys: " + ", ".join(missing_rk))
        if args.strict_coverage and (missing_cs or missing_rk):
            failed.append(("coverage", "catalogue does not cover every required entry"))

    if failed:
        print(f"\n{len(failed)} failure(s), {len(ok)} ok", file=sys.stderr)
        return 1
    if args.no_emit or (args.only and not args.emit_to):
        log(f"\n{len(ok)} ok (not emitting: {'--only' if args.only else '--no-emit'})")
        return 0

    ok.sort(key=lambda c: (c["lang"], c["level"], c["order"]))
    out = {
        "version": 1,
        "generatedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "semgrepCliVersion": ver,
        "engine": {"engine": "@semgrep/engine@1.17.1-alpha.2", "csharp": "@semgrep/languages@1.17.1-alpha.0",
                   "python": "@semgrep/lang-python@0.0.4"},
        "levels": [{"level": n, "name": LEVEL_NAMES[n], "dir": d} for d, n in sorted(LEVEL_DIRS.items(), key=lambda x: x[1])],
        "coverage": {"cheatsheet": coverage.CHEATSHEET, "optionalCheatsheet": sorted(coverage.OPTIONAL_CHEATSHEET),
                     "ruleKeys": coverage.RULE_KEYS, "patternFeatures": coverage.PATTERN_FEATURES},
        "challenges": [{k: ch[k] for k in (
            "id", "lang", "level", "level_name", "order", "slug", "title", "difficulty", "intro", "rule_id", "target_path",
            "tags", "covers", "grade", "wasm", "starter_expects_error", "instructions", "hints", "followup_title",
            "followup", "sources", "starter", "solution", "target", "solution_rules", "starter_rules", "expected")} for ch in ok],
    }
    if args.emit_to:
        Path(args.emit_to).parent.mkdir(parents=True, exist_ok=True)
        Path(args.emit_to).write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        log(f"\nwrote {args.emit_to} ({len(ok)} challenges)")
        return 0
    DOCS_DATA.mkdir(parents=True, exist_ok=True)
    (DOCS_DATA / "challenges.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    update_notices(ok)
    log(f"\nwrote docs/data/challenges.json ({len(ok)} challenges) and updated THIRD_PARTY_NOTICES.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
