"use client";

import { useState, useRef, useEffect } from "react";
import { sendChatMessage, ChatResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: ChatResponse["actions_result"];
}

const actionLabel: Record<string, string> = {
  created: "作成",
  completed: "完了",
  updated: "更新",
  error: "エラー",
};

const actionStyle: Record<string, string> = {
  created:   "text-violet-300 bg-violet-500/15 border-violet-500/30",
  completed: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  updated:   "text-amber-300 bg-amber-500/15 border-amber-500/30",
  error:     "text-red-300 bg-red-500/15 border-red-500/30",
};

const statusLabel: Record<string, string> = {
  todo: "未着手", "in-progress": "進行中", done: "完了", waiting: "回答待ち",
};

export default function ChatView({ onTasksChanged }: { onTasksChanged: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "こんにちは！タスクについて話しかけてください。\n例：「明日A倉庫でIND930交換」「見積提出完了」「今週のタスクは？」",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await sendChatMessage(text);
      setMessages(prev => [...prev, {
        role: "assistant",
        text: res.reply,
        actions: res.actions_result,
      }]);
      if (res.actions_result.some(a => ["created", "completed", "updated"].includes(a.action))) {
        onTasksChanged();
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "通信エラーが発生しました。" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "text-white rounded-tr-sm"
                  : "text-slate-200 border border-white/8 rounded-tl-sm"
              }`}
                style={msg.role === "user"
                  ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }
                  : { background: "rgba(20,27,45,0.9)" }
                }>
                {msg.text}
              </div>

              {/* Action chips */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.actions.map((a, j) => (
                    <span key={j}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border ${actionStyle[a.action] ?? actionStyle.error}`}>
                      {actionLabel[a.action] ?? a.action}
                      {a.title && <span className="opacity-70">· {a.title}</span>}
                      {a.status && <span className="opacity-50">({statusLabel[a.status] ?? a.status})</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mr-2"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm border border-white/8 flex items-center gap-1"
              style={{ background: "rgba(20,27,45,0.9)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力... (Enterで送信、Shift+Enterで改行)"
            rows={1}
            className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 bg-slate-800/60 border border-white/10 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition resize-none"
            style={{ minHeight: "48px", maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      <p className="text-center text-xs text-slate-600 mt-2">
        Powered by Gemini 1.5 Flash
      </p>
    </div>
  );
}
