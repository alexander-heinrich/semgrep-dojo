// CodeMirror 6 editors: YAML rule editor and a target editor (C# or Python, read-only by default) with
// expectation/result highlighting.
import { EditorView, basicSetup, EditorState, StateField, StateEffect, Decoration, RangeSetBuilder, keymap, yaml, csharp, python, cpp, Compartment,
  gutter, GutterMarker } from '../vendor/editor.bundle.js';

import { themeExtension } from './themes.js';
export const smallScreen = () => !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);

// Scroll a line to the middle of the editor. CodeMirror's scrollIntoView effect also scrolls every
// ancestor — on a phone, where the page itself scrolls, that yanks the page around — so run the
// measure synchronously and put the window back where it was. (Setting scrollDOM.scrollTop directly
// is not an option: an editor that is outside the window's viewport ignores it until it scrolls into view.)
function centerLine(view, lineNumber) {
  const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines));
  requestAnimationFrame(() => {   // wait for layout so the editor has its final height
    const x = window.scrollX, y = window.scrollY;
    view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.measure();
    window.scrollTo(x, y);
  });
}
const layoutExt = EditorView.theme({
  '&': { fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.45' },
  '.cm-content': { padding: '6px 0' },
  '&.cm-focused': { outline: 'none' },
});

// ---- colour theme (follows the system colour scheme, re-applied to open editors when it changes) --
const colourComp = new Compartment();
const liveViews = new Set();
const colourExt = () => colourComp.of(themeExtension());
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  for (const v of liveViews) v.dispatch({ effects: colourComp.reconfigure(themeExtension()) });
});

// ---- rule editor ---------------------------------------------------------------------------------
export function createRuleEditor(parent, text, { onRun, onChange } = {}) {
  const runKey = keymap.of([{ key: 'Mod-Enter', run: () => { onRun && onRun(); return true; } }]);
  const errorLine = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [runKey, basicSetup, yaml(), layoutExt, colourExt(), errorLine.of([]), smallScreen() ? EditorView.lineWrapping : [],
        EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); })],
    }),
  });
  liveViews.add(view);
  return {
    view,
    get: () => view.state.doc.toString(),
    set: (t) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t } }),
    markError(line) {
      view.dispatch({ effects: errorLine.reconfigure(line ? lineHighlight(view, line, 'cm-line-error') : []) });
      if (line) centerLine(view, line);
    },
    focus: () => view.focus(),
  };
}

function lineHighlight(view, line, cls) {
  const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
  return EditorView.decorations.of(Decoration.set([Decoration.line({ class: cls }).range(l.from)]));
}

// ---- target editor -------------------------------------------------------------------------------
const setLineClasses = StateEffect.define();
const lineClassField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setLineClasses)) return buildLineDecorations(tr.state, e.value);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});
function buildLineDecorations(state, classesByLine) {
  const b = new RangeSetBuilder();
  const entries = Object.entries(classesByLine).map(([l, c]) => [Number(l), c]).sort((a, b2) => a[0] - b2[0]);
  for (const [line, cls] of entries) {
    if (line < 1 || line > state.doc.lines) continue;
    const l = state.doc.line(line);
    b.add(l.from, l.from, Decoration.line({ class: cls }));
  }
  return b.finish();
}

class SymbolMarker extends GutterMarker {
  constructor(symbol, cls, title) { super(); this.symbol = symbol; this.cls = cls; this.title = title; }
  toDOM() { const s = document.createElement('span'); s.className = 'dojo-marker ' + this.cls; s.textContent = this.symbol; s.title = this.title; return s; }
}
const setMarkers = StateEffect.define();
const markersField = StateField.define({
  create: () => ({}),
  update(value, tr) { for (const e of tr.effects) if (e.is(setMarkers)) return e.value; return value; },
});
const dojoGutter = gutter({
  class: 'dojo-gutter',
  lineMarker(view, line) {
    const map = view.state.field(markersField);
    const info = map[view.state.doc.lineAt(line.from).number];
    return info ? new SymbolMarker(info.symbol, info.cls, info.title) : null;
  },
  lineMarkerChange: (u) => u.transactions.some((t) => t.effects.some((e) => e.is(setMarkers))),
});

const TARGET_MODES = { csharp, python, cpp };
const EMPTY = { classes: {}, markers: {} };

/**
 * @param {{language?: 'csharp'|'python'|'cpp', editable?: boolean, onChange?: () => void, onRun?: () => void}} [opts]
 *   an editable target (the playground) gets its own Mod-Enter binding, placed before basicSetup whose default
 *   keymap would otherwise insert a blank line; onChange fires after every edit (read the text with get()).
 */
export function createTargetEditor(parent, text, { language = 'csharp', editable = false, onChange, onRun } = {}) {
  const mode = TARGET_MODES[language];
  const runKey = onRun ? keymap.of([{ key: 'Mod-Enter', run: () => { onRun(); return true; } }]) : [];
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [runKey, basicSetup, mode ? mode() : [], layoutExt, colourExt(),
        editable ? [] : [EditorState.readOnly.of(true), EditorView.editable.of(false)],
        onChange ? EditorView.updateListener.of((u) => { if (u.docChanged) onChange(); }) : [],
        lineClassField, markersField, dojoGutter],
    }),
  });
  liveViews.add(view);
  let base = EMPTY; // the expectation markers a challenge paints under every result
  const paint = (classes, markers) => view.dispatch({ effects: [setLineClasses.of(classes), setMarkers.of(markers)] });
  const range = (m) => (m.location ? [m.location.start, m.location.end] : [m.start, m.end]);
  return {
    view,
    destroy() { liveViews.delete(view); view.destroy(); },
    get: () => view.state.doc.toString(),
    /** Replace the whole text and drop every highlight (a full replace would otherwise keep decorations at offset 0). */
    set(t) {
      base = EMPTY;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t }, effects: [setLineClasses.of({}), setMarkers.of({})] });
    },
    /** expectations: {expected:number[], ok:number[], todo:number[], annotations:number[], ranges:{line,endLine}[]} */
    showExpectations({ expected = [], ok = [], todo = [], annotations = [], ranges = [] }) {
      const classes = {}, markers = {};
      // a match usually spans several lines (a method starts at its first attribute); shade the rest lightly
      for (const r of ranges) for (let l = r.line + 1; l <= (r.endLine || r.line); l++) classes[l] = 'cm-line-expected-body';
      for (const l of annotations) classes[l] = 'cm-line-annotation';
      for (const l of ok) { classes[l] = 'cm-line-ok'; markers[l] = { symbol: '○', cls: 'ok', title: 'must NOT match' }; }
      for (const l of todo) { classes[l] = 'cm-line-todo'; markers[l] = { symbol: '◌', cls: 'todo', title: 'expected in current Semgrep, known gap in the browser engine' }; }
      for (const l of expected) { classes[l] = 'cm-line-expected'; markers[l] = { symbol: '▶', cls: 'expected', title: 'must match' }; }
      paint(classes, markers);
      base = { classes, markers };
    },
    /** result: {matchedLines, missed, unexpected, unexpectedOk} — graded against the expectations */
    showResult(result) {
      const classes = { ...base.classes }, markers = { ...base.markers };
      for (const m of result.matches || []) {
        const [s, e] = range(m);
        const cls = result.unexpected.includes(s.line) ? 'cm-line-unexpected-body' : 'cm-line-matched-body';
        for (let l = s.line + 1; l <= e.line; l++) if (!classes[l] || /-body$/.test(classes[l]) || classes[l] === 'cm-line-expected-body') classes[l] = cls;
      }
      for (const l of result.matchedLines) {
        const bad = result.unexpected.includes(l);
        classes[l] = bad ? 'cm-line-unexpected' : 'cm-line-matched';
        markers[l] = bad ? { symbol: '✖', cls: 'unexpected', title: result.unexpectedOk.includes(l) ? 'matched a line marked ok' : 'unexpected match' }
                         : { symbol: '✔', cls: 'matched', title: 'matched as expected' };
      }
      for (const l of result.missed) { classes[l] = 'cm-line-missed'; markers[l] = { symbol: '▷', cls: 'missed', title: 'expected but not matched' }; }
      paint(classes, markers);
      const first = result.missed[0] || result.unexpected[0] || result.matchedLines[0];
      if (first) centerLine(view, first);
    },
    /** Neutral highlighting of engine matches (no expectations): ● on each start line, the rest of the range shaded. */
    showMatches(matches) {
      const classes = {}, markers = {};
      let first = 0;
      for (const m of matches || []) {
        const [s, e] = range(m);
        for (let l = s.line + 1; l <= e.line; l++) if (!classes[l]) classes[l] = 'cm-line-matched-body';
        classes[s.line] = 'cm-line-matched';
        markers[s.line] = { symbol: '●', cls: 'matched', title: 'match' };
        if (!first || s.line < first) first = s.line;
      }
      paint(classes, markers);
      if (first) centerLine(view, first);
    },
    clearResult() { paint(base.classes, base.markers); },
    scrollToLine(n) { centerLine(view, n); },
  };
}
