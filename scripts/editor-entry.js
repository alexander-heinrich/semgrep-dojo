// Entry point for the one-shot editor bundle (docs/vendor/editor.bundle.js). Re-exports everything the
// site needs from CodeMirror 6, js-yaml and marked so the runtime has a single copy of @codemirror/state.
export { EditorView, basicSetup } from 'codemirror';
export { EditorState, StateField, StateEffect, RangeSet, RangeSetBuilder, Compartment } from '@codemirror/state';
export { Decoration, gutter, GutterMarker, keymap, lineNumbers, ViewPlugin } from '@codemirror/view';
export { yaml } from '@codemirror/lang-yaml';
export { csharp } from '@replit/codemirror-lang-csharp';
export * as jsyaml from 'js-yaml';
export { marked } from 'marked';
