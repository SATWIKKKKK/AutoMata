import React, { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { Extension } from '@codemirror/state';

type EditorLanguage = 'typescript' | 'javascript' | 'python' | 'sql';

export default function LazyCodeEditor({
  value,
  language,
  editable,
  onChange,
}: {
  value: string;
  language: EditorLanguage;
  editable: boolean;
  onChange: (value: string) => void;
}) {
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadLanguage() {
      if (language === 'python') {
        const mod = await import('@codemirror/lang-python');
        if (!cancelled) setExtensions([mod.python()]);
        return;
      }
      if (language === 'sql') {
        const mod = await import('@codemirror/lang-sql');
        if (!cancelled) setExtensions([mod.sql()]);
        return;
      }
      const mod = await import('@codemirror/lang-javascript');
      if (!cancelled) setExtensions([mod.javascript({ jsx: language === 'javascript', typescript: language === 'typescript' })]);
    }
    void loadLanguage();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <CodeMirror
      value={value}
      height="360px"
      theme="dark"
      extensions={extensions}
      editable={editable}
      onChange={onChange}
      basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
    />
  );
}
