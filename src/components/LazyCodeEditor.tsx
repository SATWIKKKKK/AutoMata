import React, { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { RangeSetBuilder, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, scrollPastEnd, type DecorationSet, type ViewUpdate } from '@codemirror/view';

type EditorLanguage = 'typescript' | 'javascript' | 'python' | 'sql' | 'bash';

const editorLayout = EditorView.theme({
  '&': {
    height: '100%',
    maxHeight: 'none',
  },
  '.cm-editor': {
    height: '100%',
    maxHeight: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    minHeight: '100%',
  },
  '.cm-content, .cm-gutter': {
    minHeight: '100%',
  },
});

export default function LazyCodeEditor({
  value,
  language,
  editable,
  height = '360px',
  onChange,
  onEditorReady,
  onUpdate,
  lineClasses,
}: {
  value: string;
  language: EditorLanguage;
  editable: boolean;
  height?: string;
  onChange: (value: string) => void;
  onEditorReady?: (view: EditorView) => void;
  onUpdate?: (update: ViewUpdate) => void;
  lineClasses?: Record<number, string>;
}) {
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadLanguage() {
      const lineClassExtension = StateField.define<DecorationSet>({
        create(state) {
          const builder = new RangeSetBuilder<Decoration>();
          for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
            const className = lineClasses?.[lineNumber];
            if (!className) continue;
            const line = state.doc.line(lineNumber);
            builder.add(line.from, line.from, Decoration.line({ class: className }));
          }
          return builder.finish();
        },
        update(value, transaction) {
          if (!transaction.docChanged) return value.map(transaction.changes);
          const builder = new RangeSetBuilder<Decoration>();
          for (let lineNumber = 1; lineNumber <= transaction.state.doc.lines; lineNumber += 1) {
            const className = lineClasses?.[lineNumber];
            if (!className) continue;
            const line = transaction.state.doc.line(lineNumber);
            builder.add(line.from, line.from, Decoration.line({ class: className }));
          }
          return builder.finish();
        },
        provide(field) {
          return EditorView.decorations.from(field);
        },
      });
      const highlightTheme = EditorView.theme({
        '.cm-line.automata-line-match': { borderLeft: '3px solid #16a34a', backgroundColor: 'rgba(22, 163, 74, 0.10)' },
        '.cm-line.automata-line-different': { borderLeft: '3px solid #dc2626', backgroundColor: 'rgba(220, 38, 38, 0.10)' },
        '.cm-line.automata-line-unique': { borderLeft: '3px solid #d97706', backgroundColor: 'rgba(217, 119, 6, 0.12)' },
        '.cm-line.automata-line-missing': { borderLeft: '3px solid #dc2626', backgroundColor: 'rgba(220, 38, 38, 0.10)' },
      });
      const baseExtensions: Extension[] = [editorLayout, scrollPastEnd(), highlightTheme, lineClassExtension];
      if (language === 'python') {
        const mod = await import('@codemirror/lang-python');
        if (!cancelled) setExtensions([...baseExtensions, mod.python()]);
        return;
      }
      if (language === 'sql') {
        const mod = await import('@codemirror/lang-sql');
        if (!cancelled) setExtensions([...baseExtensions, mod.sql()]);
        return;
      }
      if (language === 'bash') {
        const [languageMod, shellMod] = await Promise.all([
          import('@codemirror/language'),
          import('@codemirror/legacy-modes/mode/shell'),
        ]);
        if (!cancelled) setExtensions([...baseExtensions, languageMod.StreamLanguage.define(shellMod.shell)]);
        return;
      }
      const mod = await import('@codemirror/lang-javascript');
      if (!cancelled) {
        setExtensions([
          ...baseExtensions,
          mod.javascript({ jsx: language === 'javascript', typescript: language === 'typescript' }),
        ]);
      }
    }
    void loadLanguage();
    return () => {
      cancelled = true;
    };
  }, [language, lineClasses]);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme="dark"
      extensions={extensions}
      editable={editable}
      style={{ height: '100%' }}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
      onCreateEditor={(view) => onEditorReady?.(view)}
      onUpdate={onUpdate}
    />
  );
}
