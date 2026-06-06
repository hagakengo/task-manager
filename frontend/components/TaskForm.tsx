"use client";

import { useState } from "react";
import { TaskCreate, TaskUpdate, Task, Status, Priority } from "@/lib/api";

interface Props {
  initial?: Task;
  onSubmit: (data: TaskCreate | TaskUpdate) => Promise<void>;
  onCancel: () => void;
}

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm text-slate-100 bg-slate-800/60 border border-white/10 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition";

export default function TaskForm({ initial, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "todo");
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onSubmit({
      title: title.trim(),
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
          {loading ? "保存中..." : initial ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
