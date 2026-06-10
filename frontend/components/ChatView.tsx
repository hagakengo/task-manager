"use client";

import { useState, useRef, useEffect } from "react";
import { sendChatMessage, ChatResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  actions?: ChatResponse["actions_result"];
}

// アクション結果のラベルとスタイルを定数として定義する。
// JSX内に直接書くと可読性が下がるため外に切り出す。
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

const STORAGE_KEY = "chat-history";
// 初回表示メッセージを定数として定義する。
// 使用例を示すことでユーザーが何を入力すればいいか迷わないようにしている。
const INITIAL_MESSAGE: Message = {
  role: "assistant",
  text: "こんにちは！タスクについて話しかけてください。\n例：「明日A倉庫でIND930交換」「見積提出完了」「今週のタスクは？」",
};

export default function ChatView({ onTasksChanged }: { onTasksChanged: () => void }) {
  // localStorage から履歴を復元する初期化関数を useState に渡す。
  // 関数を渡すことで初回レンダリング時のみ実行され、毎レンダリングで localStorage を読まずに済む。
  // try/catch は localStorage が使えない環境（プライベートブラウジング等）への対策。
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [INITIAL_MESSAGE];
    } catch {
      return [INITIAL_MESSAGE];
    }
  });
  const [input, setInput] = useState("");
  // editingIndex: 編集中のメッセージのインデックス。null なら通常入力モード。
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // bottomRef はメッセージ一覧の末尾要素への参照。
  // 新しいメッセージが追加されたときに自動スクロールするために使う。
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // messages が更新されるたびに localStorage に保存する。
  // ページリロードしても会話履歴が維持される。
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);

  // メッセージが増えるたびに最下部にスクロールする。
  // behavior: "smooth" でなめらかにスクロールする。
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleClear() {
    const reset = [INITIAL_MESSAGE];
    setMessages(reset);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reset)); } catch {}
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
    setInput(messages[index].text);
    // setTimeout(..., 0) で次のイベントループサイクルにフォーカスを当てる。
    // state 更新後に DOM が再レンダリングされるのを待つための慣用パターン。
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleCancelEdit() {
    setEditingIndex(null);
    setInput("");
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    // 編集モードの場合、editingIndex より後のメッセージを削除して再送信する。
    // これにより「過去のメッセージを修正して会話をやり直す」UIを実現している。
    const baseMessages = editingIndex !== null
      ? messages.slice(0, editingIndex)
      : messages;

    setMessages([...baseMessages, { role: "user", text }]);
    setInput("");
    setEditingIndex(null);
    setLoading(true);

    try {
      const res = await sendChatMessage(text);
      setMessages(prev => [...prev, {
        role: "assistant",
        text: res.reply,
        actions: res.actions_result,
      }]);
      // create/complete/update が1件でも含まれていればタスク一覧を再取得する。
      // これによりチャット操作後にカンバンが即座に更新される。
      if (res.actions_result.some(a => ["created", "completed", "updated"].includes(a.action))) {
        onTasksChanged();
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "通信エラーが発生しました。" }]);
    } finally {
      setLoading(false);
      // 送信後に入力欄に自動フォーカスを戻す。
      // 連続してメッセージを送るときにクリックなしで続けて入力できる。
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter のみで送信、Shift+Enter で改行。
    // チャットUIの標準的なキー操作に合わせている。
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 180px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">{messages.length - 1} 件の履歴</span>
        <button
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-red-500/10"
        >
          履歴をクリア
        </button>
      </div>

      {/* Messages — flex-1 + overflow-y-auto でスクロール可能な領域を作る */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          // group クラスを親に付けることで、子要素の group-hover: スタイルが有効になる。
          // ホバー時にだけ編集ボタンを表示するために使っている。
          <div key={i} className={`flex group ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
              <div className="flex items-end gap-1.5">
                {/* ユーザーメッセージのみ編集ボタンを表示する。
                    opacity-0 → group-hover:opacity-100 でホバー時のみ表示される。 */}
                {msg.role === "user" && (
                  <button
                    onClick={() => handleEdit(i)}
                    className="opacity-0 group-hover:opacity-100 transition p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/8 flex-shrink-0 mb-0.5"
                    title="編集して再送"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {/* 編集中のメッセージは ring で強調表示する */}
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "text-white rounded-tr-sm"
                    : "text-slate-200 border border-white/8 rounded-tl-sm"
                } ${editingIndex === i ? "ring-2 ring-violet-500/60" : ""}`}
                  style={msg.role === "user"
                    ? { background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }
                    : { background: "rgba(20,27,45,0.9)" }
                  }>
                  {msg.text}
                </div>
              </div>

              {/* AIが実行したアクションをチップとして表示する。
                  タスクのタイトルや変更後のステータスも一緒に見せることで何が起きたかわかる。 */}
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

        {/* ローディング中はドットのバウンスアニメーションを表示する。
            animationDelay をずらすことで順番に跳ねるアニメーションになる。 */}
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
        {/* このダミー要素に scrollIntoView することで常に最下部を表示する */}
        <div ref={bottomRef} />
      </div>

      {/* 編集モード時はインジケーターを表示する */}
      {editingIndex !== null && (
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs text-violet-400">編集して再送信</span>
          <button onClick={handleCancelEdit} className="text-xs text-slate-500 hover:text-slate-300 transition">
            キャンセル
          </button>
        </div>
      )}

      {/* Input — textarea を使うことで Shift+Enter で改行できる */}
      <div className="mt-2 flex gap-2 items-end">
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
          // 入力が空または通信中は送信できないよう disabled にする。
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
        Powered by Groq / llama-3.1-8b-instant
      </p>
    </div>
  );
}
