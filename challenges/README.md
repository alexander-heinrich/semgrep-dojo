# Challenge format

One directory per challenge: `challenges/<language>/<level-dir>/<NN-slug>/` with exactly four files.

| file | content |
|---|---|
| `challenge.yaml` | metadata, instructions, hints, follow-up, source attribution (schema below) |
| `starter.yaml` | the rule file the learner starts from (complete `rules:` file, may be intentionally incomplete or wrong) |
| `solution.yaml` | a reference solution (complete `rules:` file); its rule `id` must equal `rule_id` |
| `target.cs` | the real-world code snippet with `// ruleid:` / `// ok:` annotations |

Level directories: `1-basics`, `2-composition`, `3-advanced`. `NN` orders challenges within a level.

## `challenge.yaml`

```yaml
title: pattern-not-inside — ignore redirects guarded by IsLocalUrl
level: 2                 # 1 basics | 2 composition | 3 advanced (must match the level directory)
difficulty: 3            # 1-5
intro: false             # true → the starter is allowed to already pass ("just run it" steps)
rule_id: open-redirect   # == id in solution.yaml == annotation id in target.cs
target_path: Controllers/AccountController.cs   # path the engine sees (only matters for `paths:` rules); default target.cs
tags: [pattern-not-inside, pattern-not, metavariable-binding]      # free-form, lower-kebab-case
covers:                  # coverage bookkeeping; values must come from scripts/coverage.py
  cheatsheet: [nested-statements]
  rule_keys: [patterns, pattern, pattern-not, pattern-not-inside]
grade: lines             # lines (default) | ranges (exact start/end col, e.g. focus-metavariable) | fixes (lines + rendered fix text)
wasm: expected           # expected | todo | cli-only  (see below)
starter_expects_error: false   # true when the starter deliberately does not even parse (pitfall steps)
instructions: |          # markdown, shown in the left pane
  ...
hints:                   # revealed one at a time
  - "..."
followup_title: Exactly!
followup: |              # markdown shown after a correct answer; end with a "try this" experiment
  ...
sources:                 # one entry per contiguous window of real-world code in target.cs
  - repo: dotnet/aspnetcore
    path: src/Security/samples/Cookies/Controllers/AccountController.cs
    commit: 6fd0a4c337358d2f0bcfb5a0d1c7d5a0d3e0e9c1   # full SHA
    license: MIT
    copyright: ".NET Foundation and Contributors"
    url: https://github.com/dotnet/aspnetcore/blob/<sha>/<path>
    lines: [8, 41]       # lines of target.cs that come from this source
    modified: false      # true when anything beyond trimming + annotation comments changed
    modification_note: ""
```

### `wasm` flag

The browser runs a build of the Semgrep engine from tag v1.81.0 (see the Semgrep-WASM repository); as of that build every challenge is `expected`.

- `expected` — the solution grades correctly in the browser; `scripts/wasm_parity.mjs` fails the build if it doesn't.
- `todo` — known engine gap; parity mismatches are reported as warnings; `// todoruleid:` lines are excluded from browser grading.
- `cli-only` — the feature cannot run in the browser; the page shows the CLI command instead of Run (currently unused).

## Annotations in `target.cs`

```csharp
// ruleid: open-redirect          ← the next non-annotation line must be matched (start line)
return Redirect(returnUrl);
// ok: open-redirect              ← documents a line that must NOT match (used for messages)
return Redirect("/");
// todoruleid: open-redirect      ← expected in current Semgrep, known gap in the browser engine
```

Rules: the annotation applies to the next line that is not itself an annotation comment (annotations
can stack). Only annotations whose id equals `rule_id` count, so one target can serve two challenges.
Grading is strict set equality of matched start lines vs `ruleid` lines (like `semgrep test`).

The first three lines of `target.cs` are an attribution header:

```csharp
// Source: https://github.com/<owner>/<repo>/blob/<sha>/<path>  (lines a-b)
// Copyright (c) <holder>. Licensed under <SPDX>. See THIRD_PARTY_NOTICES.md.
// Modified for this tutorial: no | yes — <note>
```

## Authoring rules

- Permissive licenses only (MIT, Apache-2.0, BSD-2/3, MS-PL). Pin a full commit SHA. For code
  taken from a vulnerability-fix commit, cite the **parent** SHA and link the advisory.
- Keep snippets ≤ ~80 lines, whole methods/classes, with the `using` lines a rule may need.
  Replace removed members with `// ... (omitted)`. Never edit a line that carries an annotation.
- The C# grammar matches Semgrep 1.172's: C# 12 primary constructors, `using X = (int, int)` aliases,
  `ref readonly` parameters, C# 14 extension members and `a?.b = c` produce partial-parse errors; avoid
  them on expected lines. `"..."` does not match interpolated strings (same as the CLI).
- Use `languages: [csharp]`; any Semgrep severity is accepted.
- The starter must not already pass (unless `intro: true`). Give the learner a real starting point:
  the official tutorial's starters are "almost right".
- Instructions: 2-4 short paragraphs, one explicit task sentence starting with "Try", "Write" or
  "Change". Follow-up: explain *why* it worked and add one experiment to try.
- Validate: `python3 scripts/build.py --only <slug>` then `node scripts/wasm_parity.mjs --only <slug>`.
