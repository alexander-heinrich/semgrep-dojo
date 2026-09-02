// CodeMirror 6 editors: YAML rule editor and read-only C# target with expectation/result highlighting.
import { EditorView, basicSetup, EditorState, StateField, StateEffect, Decoration, RangeSetBuilder, keymap, yaml, csharp, Compartment,
  gutter, GutterMarker } from '../vendor/editor.bundle.js';

const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const themeExt = EditorView.theme({
  '&': { fontSize: '13px', height: '100%' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.45' },
  '.cm-content': { padding: '6px 0' },
  '&.cm-focused': { outline: 'none' },
}, { dark });

// ---- rule editor ---------------------------------------------------------------------------------
export function createRuleEditor(parent, text, { onRun, onChange } = {}) {
  const runKey = keymap.of([{ key: 'Mod-Enter', run: () => { onRun && onRun(); return true; } }]);
  const errorLine = new Compartment();
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [runKey, basicSetup, yaml(), themeExt, errorLine.of([]),
        EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); })],
    }),
  });
  return {
    view,
    get: () => view.state.doc.toString(),
    set: (t) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t } }),
    markError(line) {
      view.dispatch({ effects: errorLine.reconfigure(line ? lineHighlight(view, line, 'cm-line-error') : []) });
      if (line) {
        const l = view.state.doc.line(Math.min(line, view.state.doc.lines));
        view.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
      }
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
      extensions: [basicSetup, csharp(), themeExt, EditorState.readOnly.of(true), EditorView.editable.of(false), lineClassField, markersField, dojoGutter],
    }),
  });
  return {
    view,
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
      if (first) view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(Math.min(first, view.state.doc.lines)).from, { y: 'center' }) });
    },
    clearResult() { if (this._base) view.dispatch({ effects: [setLineClasses.of(this._base.classes), setMarkers.of(this._base.markers)] }); },
    scrollToLine(n) {
      const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
      // wait for layout so the editor has its final height before scrolling
      requestAnimationFrame(() => view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'center' }) }));
    },
  };
}
