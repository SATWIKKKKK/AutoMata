import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Save, User, Cpu, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../App';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  timestamp: number;
}

interface TerminalPageProps {
  onViewChange: (view: View) => void;
}

const STORAGE_KEY = 'automata-terminal-session';
const MAX_CHARS = 2000;
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Message Bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="text-xs text-blueprint-muted italic font-mono">{msg.content}</span>
      </div>
    );
  }

  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 max-w-full', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-surface-container' : 'bg-blue-100',
      )}>
        {isUser
          ? <User size={13} className="text-blueprint-muted" />
          : <Cpu size={13} className="text-blue-600" />}
      </div>

      <div className={cn('flex flex-col gap-1 min-w-0', isUser ? 'items-end' : 'items-start')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-technical-mono text-technical-mono text-blueprint-muted">{isUser ? 'You' : 'Automata AI'}</span>
          <span className="font-technical-mono text-technical-mono text-blueprint-muted/60">{formatTime(msg.timestamp)}</span>
        </div>
        <div className={cn(
          'rounded-2xl px-4 py-3 font-body-md text-body-md leading-relaxed max-w-[80%] md:max-w-[70%] whitespace-pre-wrap wrap-break-word',
          isUser
            ? 'bg-surface-container text-on-surface'
            : 'bg-surface-container-lowest text-on-surface border border-outline-variant',
        )}>
          {msg.content}
          {msg.streaming && (
            <span className="inline-block w-1.5 h-3.5 bg-blue-500 ml-1 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TerminalPage({ onViewChange }: TerminalPageProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored) as Message[];
    } catch { /* ignore */ }
    return [
      { id: uid(), role: 'system', content: 'Session started', timestamp: Date.now() },
    ];
  });

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save to localStorage whenever messages change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 5 * 24; // ~5 lines
    ta.style.height = Math.min(ta.scrollHeight, maxH) + 'px';
    ta.style.overflowY = ta.scrollHeight > maxH ? 'auto' : 'hidden';
  }, [input]);

  const hasResponse = useMemo(
    () => messages.some(m => m.role === 'assistant' && m.content.length > 0),
    [messages],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (text.length > MAX_CHARS) {
      setError(`Message too long (max ${MAX_CHARS} characters)`);
      return;
    }

    setError(null);
    setInput('');

    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: Date.now() };
    const assistantId = uid();
    const assistantMsg: Message = {
      id: assistantId, role: 'assistant', content: '', streaming: true, timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsSending(true);

    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Handle SSE format: "data: ...\n\n"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.delta) accumulated += parsed.delta;
              else if (typeof parsed === 'string') accumulated += parsed;
            } catch {
              // plain text chunk
              accumulated += payload;
            }
          }
        }
        const snapshot = accumulated;
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: snapshot } : m),
        );
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, streaming: false }
            : m,
        ),
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: err.message ?? 'Request failed.', streaming: false }
            : m,
        ),
      );
      setError(err.message ?? 'Request failed.');
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [input, isSending, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const clearSession = () => {
    setMessages([{ id: uid(), role: 'system', content: 'Session cleared', timestamp: Date.now() }]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const saveAsWorkflow = async () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (!lastAssistant) return;
    try {
      const res = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: lastAssistant.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); onViewChange('editor'); }, 1200);
    } catch (err: any) {
      setError(err.message ?? 'Could not save as workflow');
    }
  };

  return (
    <div className="flex flex-col h-full bg-blueprint-bg" style={{ minHeight: 0 }}>

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-4 sm:px-6 py-4 border-b border-blueprint-line shrink-0 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="font-technical-mono text-technical-mono text-blueprint-muted uppercase tracking-widest block mb-0.5">AI Terminal</span>
          <h1 className="font-headline-md text-headline-md text-primary not-italic">Terminal</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Direct AI interaction — test prompts before adding to workflows</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={clearSession}
            className="flex items-center gap-1.5 font-ui-label text-ui-label text-blueprint-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-container"
          >
            <Trash2 size={13} /> Clear
          </button>
          <button
            onClick={saveAsWorkflow}
            disabled={!hasResponse}
            className={cn(
              'flex items-center gap-1.5 font-ui-label text-ui-label px-4 py-1.5 rounded-full font-medium transition-all',
              hasResponse
                ? saveSuccess
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-on-primary hover:bg-inverse-surface'
                : 'bg-surface-container text-blueprint-muted cursor-not-allowed',
            )}
          >
            <Save size={13} />
            {saveSuccess ? 'Saved!' : 'Save as Workflow'}
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5" style={{ minHeight: 0 }}>
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* ── Error bar ───────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-6 py-3 bg-red-50 border-t border-red-200 text-red-600 text-xs font-mono shrink-0">
          <AlertCircle size={13} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Input Area ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-blueprint-line bg-surface-container-lowest px-4 sm:px-6 py-4">
        <div className="flex items-end gap-3 bg-surface-container border border-outline-variant rounded-2xl px-3 sm:px-4 py-3 focus-within:border-primary transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything or describe a workflow…"
            disabled={isSending}
            rows={1}
            className="flex-1 bg-transparent text-on-surface text-sm placeholder:text-blueprint-muted resize-none border-none focus:ring-0 outline-none leading-6 min-h-6"
          />
          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <span className={cn('text-[10px] font-mono', input.length > MAX_CHARS * 0.9 ? 'text-yellow-700' : 'text-blueprint-muted')}>
              {input.length}/{MAX_CHARS}
            </span>
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="w-7 h-7 flex items-center justify-center bg-primary hover:bg-inverse-surface rounded-full transition-colors disabled:opacity-30"
            >
              {isSending
                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={12} className="text-white" />}
            </button>
          </div>
        </div>
        <p className="font-technical-mono text-technical-mono text-blueprint-muted mt-2 text-center">
          Enter to send · Shift+Enter for new line · session auto-saved
        </p>
      </div>
    </div>
  );
}
