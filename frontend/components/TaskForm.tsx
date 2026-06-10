"use client";

import { useState } from "react";
import { TaskCreate, TaskUpdate, Task, Status, Priority } from "@/lib/api";

interface Props {
  // initial が渡されると「編集モード」、なければ「新規作成モード」として動く。
  // 同じコンポーネントで両方の用途に対応することで、フォームの実装を一箇所に集約している。
  initial?: Task;
  onSubmit: (data: TaskCreate | TaskUpdate) => Promise<void>;
  onCancel: () => void;
}

// Tailwind のクラス文字列を変数に切り出して全インプットで共通化する。
// 同じ長いクラス文字列を何度も書かずに済み、見た目の統一も保証される。
const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm text-slate-100 bg-slate-800/60 border border-white/10 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition";

export default function TaskForm({ initial, onSubmit, onCancel }: Props) {
  // initial が存在すれば編集モードとして初期値をセット、なければデフォルト値を使う。
  // ?? 演算子は null/undefined のときだけフォールバックする（'' や 0 はそのまま使う）。
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    // デフォルトのフォーム送信（ページリロード）を防ぐ。
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onSubmit({
      title: title.trim(),
      // 空文字列は undefined に変換することで、バックエンドに「未入力」として伝える。
      // バックエンドは undefined フィールドを無視するため、既存の値を上書きしない。
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate || undefined,
    });
    setLoading(false);
  }

  const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>
          タイトル <span className="text-violet-400">*</span>
        </label>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タスクのタイトル"
          required
          // autoFocus でモーダルを開いた瞬間にフォーカスを当てる。
          // キーボードユーザーが即座に入力を始められる。
          autoFocus
        />
      </div>

      <div>
        <label className={labelClass}>説明</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="詳細（任意）"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>ステータス</label>
          <select
            className={inputClass}
            value={status}
            // e.target.value は string 型なので、as Status でキャストする。
            // Status 型の値しか選択肢にないので安全。
            onChange={(e) => setStatus(e.target.value as Status)}
          >
            <option value="todo">未着手</option>
            <option value="in-progress">進行中</option>
            <option value="done">完了</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>優先度</label>
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>期限</label>
        {/* type="date" はブラウザネイティブのカレンダーUIを使える。
            自前でカレンダーを実装するより軽量で、モバイルでも使いやすい。 */}
        <input
          type="date"
          className={inputClass}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg text-slate-400 border border-white/10 hover:bg-white/5 hover:text-slate-200 transition"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="px-4 py-2 text-sm rounded-lg font-medium text-white disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          {/* initial の有無で「作成」と「更新」を切り替える。
              loading 中は「保存中...」を表示して二重送信を防ぐ。 */}
          {loading ? "保存中..." : initial ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
