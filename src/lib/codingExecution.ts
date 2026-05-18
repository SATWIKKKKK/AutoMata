import type { CodingLanguage } from './codingRound';

export type CodingExecutionResult = {
  stdout: string[];
  stderr: string[];
  notices: string[];
};

type StatusHandler = (message: string) => void;

type PyodideRuntime = {
  globals: {
    set: (name: string, value: unknown) => void;
    delete?: (name: string) => void;
  };
  runPythonAsync: (code: string) => Promise<unknown>;
};

declare global {
  interface Window {
    loadPyodide?: (options: { indexURL: string }) => Promise<PyodideRuntime>;
  }
}

const EXECUTION_IFRAME_ID = 'automata-coding-execution-frame';
const EXECUTION_MESSAGE_SOURCE = 'automata-coding-execution';
const PYODIDE_SCRIPT_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';
const EXECUTION_TIMEOUT_MS = 8_000;

let pyodidePromise: Promise<PyodideRuntime> | null = null;

function formatExecutionValue(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function escapeForInlineScript(value: string) {
  return JSON.stringify(value).replace(/<\//g, '<\\/');
}

function stripImportsAndExports(code: string) {
  return code
    .replace(/^\s*import\s.+?;\s*$/gm, '')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s+/gm, '');
}

async function transformBrowserRunnableCode(code: string, language: CodingLanguage, status?: StatusHandler) {
  status?.('Preparing runtime...');
  const { transform } = await import('sucrase');
  const rawCode = stripImportsAndExports(code);
  const result = transform(rawCode, {
    transforms: language === 'typescript' ? ['typescript', 'jsx'] : ['jsx'],
    jsxRuntime: 'classic',
    production: false,
  });
  return {
    transformedCode: result.code.trim(),
    notices: language === 'typescript' ? ['Type errors are not checked - logic execution only.'] : [],
  };
}

function ensureExecutionIframe() {
  let iframe = document.getElementById(EXECUTION_IFRAME_ID) as HTMLIFrameElement | null;
  if (iframe) return iframe;
  iframe = document.createElement('iframe');
  iframe.id = EXECUTION_IFRAME_ID;
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.position = 'fixed';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  iframe.style.bottom = '0';
  iframe.style.right = '0';
  document.body.appendChild(iframe);
  return iframe;
}

async function executeBrowserCode(code: string, language: 'javascript' | 'typescript', status?: StatusHandler) {
  let transformedCode = '';
  let notices: string[] = [];
  try {
    const transformed = await transformBrowserRunnableCode(code, language, status);
    transformedCode = transformed.transformedCode;
    notices = transformed.notices;
  } catch (error) {
    return {
      stdout: [],
      stderr: [`Syntax Error: ${error instanceof Error ? error.message : String(error)}`],
      notices: [],
    };
  }
  const iframe = ensureExecutionIframe();
  const runId = crypto.randomUUID();

  return new Promise<CodingExecutionResult>((resolve) => {
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeoutId);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const payload = event.data as { source?: string; runId?: string; stdout?: unknown; stderr?: unknown; notices?: unknown };
      if (payload.source !== EXECUTION_MESSAGE_SOURCE || payload.runId !== runId) return;
      cleanup();
      resolve({
        stdout: Array.isArray(payload.stdout) ? payload.stdout.map(formatExecutionValue) : [],
        stderr: Array.isArray(payload.stderr) ? payload.stderr.map(formatExecutionValue) : [],
        notices: Array.isArray(payload.notices) ? payload.notices.map(formatExecutionValue) : notices,
      });
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({
        stdout: [],
        stderr: ['Execution timed out after 8 seconds.'],
        notices,
      });
    }, EXECUTION_TIMEOUT_MS);

    window.addEventListener('message', handleMessage);

    iframe.srcdoc = `<!doctype html>
<html>
  <head>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  </head>
  <body>
    <div id="root"></div>
    <script>
      const runId = ${escapeForInlineScript(runId)};
      const userCode = ${escapeForInlineScript(transformedCode)};
      const notices = ${escapeForInlineScript(JSON.stringify(notices))};
      const stdout = [];
      const stderr = [];
      const safeNotices = (() => {
        try {
          return JSON.parse(notices);
        } catch {
          return [];
        }
      })();
      const format = (value) => {
        if (typeof value === 'string') return value;
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };
      const send = () => {
        window.parent.postMessage({ source: ${escapeForInlineScript(EXECUTION_MESSAGE_SOURCE)}, runId, stdout, stderr, notices: safeNotices }, '*');
      };
      console.log = (...args) => stdout.push(args.map(format).join(' '));
      console.error = (...args) => stderr.push('ERROR: ' + args.map(format).join(' '));
      window.onerror = (message, source, line, column, error) => {
        stderr.push(error && error.stack ? error.stack : String(message));
        send();
        return true;
      };
      (async () => {
        try {
          const execute = new Function('console', 'return (async () => {\\n' + userCode + '\\n})();');
          await execute(console);
        } catch (error) {
          stderr.push(error && error.stack ? error.stack : String(error));
        } finally {
          send();
        }
      })();
    <\/script>
  </body>
</html>`;
  });
}

async function ensurePyodide(status?: StatusHandler) {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = new Promise<PyodideRuntime>((resolve, reject) => {
    const finish = async () => {
      if (typeof window.loadPyodide !== 'function') {
        reject(new Error('Pyodide runtime failed to load.'));
        pyodidePromise = null;
        return;
      }
      try {
        const runtime = await window.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
        resolve(runtime);
      } catch (error) {
        pyodidePromise = null;
        reject(error instanceof Error ? error : new Error('Pyodide runtime failed to initialize.'));
      }
    };

    if (typeof window.loadPyodide === 'function') {
      void finish();
      return;
    }

    status?.('Loading Python runtime...');
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PYODIDE_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => { void finish(); }, { once: true });
      existing.addEventListener('error', () => {
        pyodidePromise = null;
        reject(new Error('Pyodide script failed to load.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PYODIDE_SCRIPT_URL;
    script.async = true;
    script.onload = () => { void finish(); };
    script.onerror = () => {
      pyodidePromise = null;
      reject(new Error('Pyodide script failed to load.'));
    };
    document.body.appendChild(script);
  });

  return pyodidePromise;
}

async function executePython(code: string, status?: StatusHandler): Promise<CodingExecutionResult> {
  status?.('Loading Python runtime...');
  const pyodide = await ensurePyodide(status);
  status?.('Running Python...');
  pyodide.globals.set('__automata_code__', code);
  try {
    const result = await pyodide.runPythonAsync(`
import io
import json
import sys
import traceback

buffer_out = io.StringIO()
buffer_err = io.StringIO()
stdout_original = sys.stdout
stderr_original = sys.stderr
sys.stdout = buffer_out
sys.stderr = buffer_err

try:
    exec(__automata_code__, {})
except Exception:
    traceback.print_exc()
finally:
    sys.stdout = stdout_original
    sys.stderr = stderr_original

json.dumps({
    "stdout": buffer_out.getvalue().splitlines(),
    "stderr": buffer_err.getvalue().splitlines(),
    "notices": []
})
    `);
    const parsed = JSON.parse(String(result ?? '{}')) as CodingExecutionResult;
    return {
      stdout: Array.isArray(parsed.stdout) ? parsed.stdout.map(formatExecutionValue) : [],
      stderr: Array.isArray(parsed.stderr) ? parsed.stderr.map(formatExecutionValue) : [],
      notices: Array.isArray(parsed.notices) ? parsed.notices.map(formatExecutionValue) : [],
    };
  } finally {
    pyodide.globals.delete?.('__automata_code__');
  }
}

export async function executeCodingSnippet(code: string, language: CodingLanguage, status?: StatusHandler): Promise<CodingExecutionResult> {
  if (language === 'typescript' || language === 'javascript') {
    return executeBrowserCode(code, language, status);
  }
  if (language === 'python') {
    return executePython(code, status);
  }
  if (language === 'sql') {
    return {
      stdout: [],
      stderr: [],
      notices: ['SQL execution requires a database connection. Describe your expected query results in the Notes field.'],
    };
  }
  return {
    stdout: [],
    stderr: [],
    notices: ['Bash execution is not supported in the browser sandbox. Describe the expected command output in the Notes field.'],
  };
}
