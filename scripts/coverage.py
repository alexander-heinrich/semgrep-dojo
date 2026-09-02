"""Controlled vocabularies for `covers:` in challenge.yaml.

CHEATSHEET keys follow https://semgrep.dev/embed/cheatsheet (section → entry). Entries that have no
C# example on the cheatsheet are optional for coverage (they are deprecated or unsupported for C#).
"""

CHEATSHEET = {
    # Deep (recursive) matching
    "deep-expression-operator": "Deep expression operator `<... e ...>`",
    "expression-and-statement": "Expression and statement matching (`foo();` matches the call inside a bigger statement)",
    # Exact matches
    "single-statements": "Exact single statements",
    # Helpful features
    "constant-propagation": "Constant propagation / literal folding",
    "import-renaming-aliasing": "Import renaming / aliasing (no C# example)",
    # Named placeholders
    "annotations": "Attributes / annotations `[$A] class $C { ... }`",
    "argument": "Argument placeholder `Foo($X, 2)`",
    "class-definitions": "Class definitions `class $C { ... }`",
    "conditionals": "Conditionals `if ($C) { ... }`",
    "function-call": "Function call `$F(1, 2)`",
    "function-definitions": "Function definitions `$RET $FUNC(...) { ... }`",
    "imports": "Imports `using $X;`",
    "key-value-pairs-named-arguments": "Key/value pairs → named arguments `Foo(..., bar: 42, ...)`",
    "statement": "Statement placeholder `if ($E) { $S; }`",
    "typed-metavariable-field-access": "Typed metavariable field access (no C# example)",
    "typed-metavariables": "Typed metavariables `(string $X)`",
    # Regular expressions (deprecated `=~/re/` syntax)
    "regex-field-names": "Regex on field names (deprecated, no C# example)",
    "regex-strings": "Regex on strings (deprecated, no C# example)",
    # Reoccurring expressions
    "reoccurring-expressions": "Reoccurring expressions `$X == $X`",
    "reoccurring-statement": "Reoccurring statements `if ($E) { $S; } else { $S; }`",
    "reoccurring-variables": "Reoccurring variables `$V = Open(); Close($V);`",
    # Wildcard matches
    "wildcard-arguments": "Wildcard arguments `Foo(..., 5)`",
    "method-chaining": "Method chaining `$O.foo(). ... .bar()`",
    "nested-statements": "Nested statements `if (...) { ... }`",
    "wildcard-statements": "Wildcard statements `$X = Get(); ... Eval($X)`",
    "wildcard-strings": "Wildcard strings `Foo(\"...\")`",
}

OPTIONAL_CHEATSHEET = {
    "import-renaming-aliasing",
    "typed-metavariable-field-access",
    "regex-field-names",
    "regex-strings",
}

RULE_KEYS = {
    "pattern": "pattern",
    "patterns": "patterns (logical AND)",
    "pattern-either": "pattern-either (logical OR)",
    "pattern-not": "pattern-not",
    "pattern-inside": "pattern-inside",
    "pattern-not-inside": "pattern-not-inside",
    "pattern-regex": "pattern-regex",
    "pattern-not-regex": "pattern-not-regex",
    "metavariable-regex": "metavariable-regex",
    "metavariable-pattern": "metavariable-pattern",
    "metavariable-pattern-language": "metavariable-pattern with nested `language:`",
    "metavariable-comparison": "metavariable-comparison",
    "metavariable-analysis": "metavariable-analysis (entropy / redos)",
    "focus-metavariable": "focus-metavariable",
    "fix": "fix",
    "fix-regex": "fix-regex",
    "options": "options",
    "paths": "paths (include / exclude)",
    "min-version": "min-version",
    "severity": "severity levels",
    "metadata": "metadata",
    "mode-taint": "mode: taint",
    "pattern-sources": "pattern-sources",
    "pattern-sinks": "pattern-sinks",
    "pattern-sanitizers": "pattern-sanitizers",
    "pattern-propagators": "pattern-propagators",
    "by-side-effect": "by-side-effect",
    "exact": "exact (taint sinks)",
    "taint-unify-mvars": "options.taint_unify_mvars",
}

OPTIONAL_RULE_KEYS = set()

# Pattern-syntax features (free-form tags, listed here so the site can explain them).
PATTERN_FEATURES = {
    "ellipsis": "The ellipsis operator `...`",
    "ellipsis-metavariable": "Ellipsis metavariable `$...ARGS`",
    "anonymous-metavariable": "Anonymous metavariable `$_`",
    "metavariable": "Metavariables `$X`",
    "metavariable-equality": "Reusing a metavariable means equality",
    "typed-metavariable": "Typed metavariables `(string $X)`",
    "deep-expression": "Deep expression operator `<... e ...>`",
    "partial-statement": "Partial statements / headers as patterns",
    "block-scope": "Ellipsis never climbs out of a block",
    "any-depth": "Patterns match at any nesting depth",
    "string-literal": "String literal matching `\"...\"`",
    "constant-propagation": "Constant propagation",
    "named-arguments": "Named arguments match in any order",
    "attributes": "Attributes",
    "modifiers": "Modifiers are a required subset",
    "method-chain": "Method chain ellipsis",
}

LICENSES = {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "MS-PL", "0BSD", "ISC", "Unlicense", "CC0-1.0"}
