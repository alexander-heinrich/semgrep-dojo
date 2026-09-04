// CodeMirror 6 editors: YAML rule editor and read-only C# target with expectation/result highlighting.
import { EditorView, basicSetup, EditorState, StateField, StateEffect, Decoration, RangeSetBuilder, keymap, yaml, csharp, Compartment,
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

export function createTargetEditor(parent, text) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [basicSetup, csharp(), layoutExt, colourExt(), EditorState.readOnly.of(true), EditorView.editable.of(false), lineClassField, markersField, dojoGutter],
    }),
  });
  liveViews.add(view);
  return {
    view,
    destroy() { liveViews.delete(view); view.destroy(); },
    /** expectations: {expected:number[], ok:number[], todo:number[], annotations:number[]} */
    showExpectations({ expected = [], ok = [], todo = [], annotations = [] }) {
      const classes = {}, markers = {};
      for (const l of annotations) classes[l] = 'cm-line-annotation';
      for (const l of ok) { classes[l] = 'cm-line-ok'; markers[l] = { symbol: '○', cls: 'ok', title: 'must NOT match' }; }
      for (const l of todo) { classes[l] = 'cm-line-todo'; markers[l] = { symbol: '◌', cls: 'todo', title: 'expected in current Semgrep, known gap in the browser engine' }; }
      for (const l of expected) { classes[l] = 'cm-line-expected'; markers[l] = { symbol: '▶', cls: 'expected', title: 'must match' }; }
      view.dispatch({ effects: [setLineClasses.of(classes), setMarkers.of(markers)] });
      this._base = { classes, markers };
    },
    /** result: {matchedLines, missed, unexpected, unexpectedOk} */
    showResult(result) {
      const classes = { ...(this._base ? this._base.classes : {}) };
      const markers = { ...(this._base ? this._base.markers : {}) };
      for (const l of result.matchedLines) {
        const bad = result.unexpected.includes(l);
        classes[l] = bad ? 'cm-line-unexpected' : 'cm-line-matched';
        markers[l] = bad ? { symbol: '✖', cls: 'unexpected', title: result.unexpectedOk.includes(l) ? 'matched a line marked ok' : 'unexpected match' }
                         : { symbol: '✔', cls: 'matched', title: 'matched as expected' };
      }
      for (const l of result.missed) { classes[l] = 'cm-line-missed'; markers[l] = { symbol: '▷', cls: 'missed', title: 'expected but not matched' }; }
      view.dispatch({ effects: [setLineClasses.of(classes), setMarkers.of(markers)] });
      const first = result.missed[0] || result.unexpected[0] || result.matchedLines[0];
      if (first) centerLine(view, first);
    },
    clearResult() { if (this._base) view.dispatch({ effects: [setLineClasses.of(this._base.classes), setMarkers.of(this._base.markers)] }); },
    scrollToLine(n) { centerLine(view, n); },
  };
}
