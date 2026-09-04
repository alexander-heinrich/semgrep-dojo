// Editor colour themes. The light theme is CodeMirror's default; the dark ones are the usual suspects,
// each reduced to the handful of token colours the YAML rule and the C# target actually use.
import { EditorView, HighlightStyle, syntaxHighlighting, tags as t } from '../vendor/editor.bundle.js';

// name → { label, bg, gutter, fg, muted, cursor, sel, line, ...token colours }
const PALETTES = {
  'one-dark':  { label: 'One Dark',       bg: '#282c34', gutter: '#21252b', fg: '#abb2bf', muted: '#7d8799', cursor: '#528bff', sel: '#3e4451', line: '#2c313a',
                 keyword: '#c678dd', string: '#98c379', number: '#d19a66', prop: '#e06c75', fn: '#61afef', type: '#e5c07b', comment: '#7d8799', meta: '#56b6c2' },
  'github-dark': { label: 'GitHub Dark', bg: '#0d1117', gutter: '#0d1117', fg: '#c9d1d9', muted: '#8b949e', cursor: '#c9d1d9', sel: '#264f78', line: '#161b22',
                 keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff', prop: '#7ee787', fn: '#d2a8ff', type: '#ffa657', comment: '#8b949e', meta: '#79c0ff' },
  'solarized-dark': { label: 'Solarized Dark', bg: '#002b36', gutter: '#073642', fg: '#93a1a1', muted: '#586e75', cursor: '#d30102', sel: '#073642', line: '#073642',
                 keyword: '#859900', string: '#2aa198', number: '#d33682', prop: '#268bd2', fn: '#268bd2', type: '#b58900', comment: '#586e75', meta: '#cb4b16' },
  'dracula':   { label: 'Dracula',        bg: '#282a36', gutter: '#282a36', fg: '#f8f8f2', muted: '#6272a4', cursor: '#f8f8f0', sel: '#44475a', line: '#44475a75',
                 keyword: '#ff79c6', string: '#f1fa8c', number: '#bd93f9', prop: '#8be9fd', fn: '#50fa7b', type: '#8be9fd', comment: '#6272a4', meta: '#ffb86c' },
  'nord':      { label: 'Nord',           bg: '#2e3440', gutter: '#2e3440', fg: '#d8dee9', muted: '#616e88', cursor: '#d8dee9', sel: '#434c5e', line: '#3b4252',
                 keyword: '#81a1c1', string: '#a3be8c', number: '#b48ead', prop: '#8fbcbb', fn: '#88c0d0', type: '#8fbcbb', comment: '#616e88', meta: '#d08770' },
  'gruvbox-dark': { label: 'Gruvbox Dark', bg: '#282828', gutter: '#282828', fg: '#ebdbb2', muted: '#928374', cursor: '#ebdbb2', sel: '#504945', line: '#3c3836',
                 keyword: '#fb4934', string: '#b8bb26', number: '#d3869b', prop: '#83a598', fn: '#fabd2f', type: '#fabd2f', comment: '#928374', meta: '#fe8019' },
};

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

export const DEFAULT_DARK = 'one-dark';
const systemDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

/** Choices for a picker: [value, label]. */
export const THEME_CHOICES = [['auto', 'Auto (system)'], ['light', 'Light'], ...Object.entries(PALETTES).map(([k, p]) => [k, p.label])];

/** Resolve a setting value ('auto' | 'light' | palette name) to the extension to load. */
export function themeExtension(name) {
  const resolved = !name || name === 'auto' ? (systemDark() ? DEFAULT_DARK : 'light') : name;
  if (resolved === 'light' || !PALETTES[resolved]) return EditorView.theme({}, { dark: false });   // basicSetup's default light palette
  return darkExtension(PALETTES[resolved]);
}
