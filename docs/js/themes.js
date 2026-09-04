// Editor colour themes: CodeMirror's default palette in light mode, One Dark in dark mode.
import { EditorView, HighlightStyle, syntaxHighlighting, tags as t } from '../vendor/editor.bundle.js';

// One Dark (Atom), reduced to the token colours the YAML rule and the C# target use.
const ONE_DARK = { bg: '#282c34', gutter: '#21252b', fg: '#abb2bf', muted: '#7d8799', cursor: '#528bff', sel: '#3e4451', line: '#2c313a',
  keyword: '#c678dd', string: '#98c379', number: '#d19a66', prop: '#e06c75', fn: '#61afef', type: '#e5c07b', comment: '#7d8799', meta: '#56b6c2' };

function darkExtension(p) {
  const chrome = EditorView.theme({
    '&': { color: p.fg, backgroundColor: p.bg },
    '.cm-content': { caretColor: p.cursor },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.cursor },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: p.sel },
    '.cm-activeLine': { backgroundColor: p.line },
    '.cm-gutters': { backgroundColor: p.gutter, color: p.muted, borderRight: '1px solid ' + p.line },
    '.cm-activeLineGutter': { backgroundColor: p.line },
    '.cm-foldPlaceholder': { backgroundColor: 'transparent', border: 'none', color: p.muted },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: p.sel, outline: 'none' },
    '.cm-tooltip': { backgroundColor: p.gutter, color: p.fg, border: '1px solid ' + p.line },
  }, { dark: true });
  const highlight = HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.modifier, t.definitionKeyword, t.moduleKeyword], color: p.keyword },
    { tag: [t.string, t.special(t.string), t.character, t.regexp], color: p.string },
    { tag: [t.number, t.integer, t.float, t.bool, t.atom, t.null, t.self], color: p.number },
    { tag: [t.propertyName, t.definition(t.propertyName), t.attributeName, t.labelName], color: p.prop },
    { tag: [t.function(t.variableName), t.function(t.definition(t.variableName)), t.macroName], color: p.fn },
    { tag: [t.typeName, t.className, t.namespace, t.definition(t.typeName), t.definition(t.className), t.annotation], color: p.type },
    { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: p.comment, fontStyle: 'italic' },
    { tag: [t.meta, t.processingInstruction, t.documentMeta, t.escape], color: p.meta },
    { tag: [t.variableName, t.definition(t.variableName), t.operator, t.punctuation, t.bracket, t.separator], color: p.fg },
    { tag: t.invalid, color: p.keyword, textDecoration: 'underline wavy' },
  ]);
  return [chrome, syntaxHighlighting(highlight)];
}

const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
const light = EditorView.theme({}, { dark: false });   // basicSetup's default light palette
const dark = darkExtension(ONE_DARK);

/** The extension for the current system colour scheme. */
export function themeExtension() { return systemDark() ? dark : light; }
