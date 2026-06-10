"use client";

import { useState } from "react";
import { Task, TaskUpdate, updateTask, Status } from "@/lib/api";
import TaskForm from "./TaskForm";

// ポモドーロの時間プリセット（分）。
// カードのボタンから選択できる。25分以外も選べることで短いタスクにも対応できる。
const DURATION_PRESETS = [5, 15, 25, 50];

interface Props {
  task: Task;
  onUpdated: (task: Task) => void;
  onDeleted: (task: Task) => void;
  onStartPomodoro?: (task: Task, minutes: number) => void;
  isPomodoro?: boolean;
}

const statusLabel: Record<string, string> = {
  todo: "未着手",
  "in-progress": "進行中",
  done: "完了",
  waiting: "回答待ち",
};

const statusStyle: Record<string, string> = {
  todo:          "text-slate-400  bg-slate-800/80  border-slate-700/50",
  "in-progress": "text-violet-300 bg-violet-900/30 border-violet-700/40",
  done:          "text-emerald-300 bg-emerald-900/30 border-emerald-700/40",
  waiting:       "text-amber-300  bg-amber-900/30  border-amber-700/40",
};

// bar: カード左端の優先度ライン、badge: バッジの色、label: 表示テキスト。
// オブジェクトにまとめることで優先度ごとのスタイルを一箇所で管理できる。
const priorityStyle: Record<string, { bar: string; badge: string; label: string }> = {
  high:   { bar: "bg-red-500",    badge: "text-red-300   bg-red-900/30   border-red-700/40",    label: "高" },
  medium: { bar: "bg-amber-400",  badge: "text-amber-300 bg-amber-900/30 border-amber-700/40",  label: "中" },
  low:    { bar: "bg-slate-600",  badge: "text-slate-400 bg-slate-800/60 border-slate-700/40",  label: "低" },
};

export default function TaskCard({ task, onUpdated, onDeleted, onStartPomodoro, isPomodoro }: Props) {
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  // showDurationPicker: ポモドーロの時間選択ピッカーの表示状態。
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  function handleDragStart(e: React.DragEvent) {
    // dataTransfer でドラッグ中のタスクIDを運ぶ。
    // ドロップ先（カンバン列）が onDrop で取り出してステータス更新に使う。
    e.dataTransfer.setData("taskId", String(task.id));
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }

  async function handleUpdate(data: TaskUpdate) {
    const updated = await updateTask(task.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleStatusChange(status: Status) {
    const updated = await updateTask(task.id, { status });
    onUpdated(updated);
  }

  function handleDelete() {
    // 実際の削除は親（page.tsx）の handleDeleteRequested で行う。
    // 5秒間 Undo できる仕組みも親が管理している。
    onDeleted(task);
  }

  const { bar, badge, label: priorityLabel } = priorityStyle[task.priority];

  // 期限バッジの計算。完了タスクには表示しない。
  // IIFE（即時実行関数）で計算を閉じ込め、変数を外に漏らさない。
  const dueDateInfo = (() => {
    if (!task.due_date || task.status === "done") return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date); due.setHours(0, 0, 0, 0);
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diff < 0)  return { text: `${Math.abs(diff)} 日超過`, cls: "text-red-400 bg-red-500/10 border-red-500/30", icon: "🔴" };
    if (diff === 0) return { text: "今日期限",  cls: "text-orange-300 bg-orange-500/10 border-orange-500/30", icon: "🟠" };
    if (diff <= 3)  return { text: `あと ${diff} 日`, cls: "text-amber-300 bg-amber-500/10 border-amber-500/30", icon: "⚠️" };
    return { text: `あと ${diff} 日`, cls: "text-slate-500 bg-transparent border-slate-700/40", icon: null };
  })();

  // 編集モード時はカード全体をフォームに差し替える。
  // 別モーダルを開かず in-place で編集できるのでUIが自然。
  if (editing) {
    return (
      <div className="rounded-xl border border-white/10 p-4" style={{ background: "rgba(15,20,35,0.9)" }}>
        <TaskForm initial={task} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      className={`group relative rounded-xl border border-white/8 p-4 cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden ${
        dragging
          ? "opacity-40 scale-95"
          : task.status === "done"
          ? "opacity-50"      // 完了タスクは薄く表示して視覚的に区別する
          : "hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg"
      }`}
      style={{
        background: dragging
          ? "rgba(15,20,35,0.6)"
          : "linear-gradient(135deg, rgba(20,27,45,0.95) 0%, rgba(15,20,35,0.95) 100%)",
        boxShadow: dragging ? "none" : "0 2px 16px rgba(0,0,0,0.3)",
      }}
    >
      {/* 優先度を示す左端の縦ライン。absolute で配置してカードのパディングに影響しない */}
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${bar}`} />

      <div className="pl-2">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {/* チェックボックス: クリックで done ↔ todo をトグルする */}
            <button
              onClick={() => handleStatusChange(task.status === "done" ? "todo" : "done")}
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border transition-all ${
                task.status === "done"
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-slate-600 hover:border-violet-400"
              }`}
            >
              {task.status === "done" && (
                <svg className="w-full h-full p-0.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="min-w-0">
              <p className={`text-sm font-medium break-words leading-snug ${
                task.status === "done" ? "line-through text-slate-500" : "text-slate-100"
              }`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-xs text-slate-500 mt-1 break-words leading-relaxed">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          {/* アクションボタン群: group-hover で親にホバーしたときだけ表示する */}
          <div className="relative flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onStartPomodoro && (
              <div className="relative">
                <button
                  onClick={() => setShowDurationPicker(v => !v)}
                  className={`p-1.5 rounded-lg transition text-sm ${
                    isPomodoro
                      ? "text-violet-300 bg-violet-500/20"
                      : "text-slate-500 hover:text-violet-300 hover:bg-violet-500/10"
                  }`}
                  title="ポモドーロ開始"
                >
                  ⏱️
                </button>
                {/* 時間プリセットのドロップダウン */}
                {showDurationPicker && (
                  <div className="absolute right-0 top-8 z-20 rounded-xl border border-white/10 p-2 shadow-xl flex flex-col gap-1 w-24"
                    style={{ background: "rgba(15,20,35,0.98)" }}>
                    {DURATION_PRESETS.map(min => (
                      <button
                        key={min}
                        onClick={() => { onStartPomodoro(task, min); setShowDurationPicker(false); }}
                        className="w-full text-xs px-2 py-1.5 rounded-lg text-slate-300 hover:bg-violet-500/20 hover:text-violet-200 transition text-left"
                      >
                        {min} 分
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          {isPomodoro && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border text-violet-300 bg-violet-500/15 border-violet-500/30 animate-pulse">
              ⏱️ 実行中
            </span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${statusStyle[task.status]}`}>
            {statusLabel[task.status]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${badge}`}>
            {priorityLabel}
          </span>
          {dueDateInfo && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${dueDateInfo.cls}`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {dueDateInfo.text}
            </span>
          )}
          {/* 完了日は done かつ completed_at がある場合のみ表示する */}
          {task.status === "done" && task.completed_at && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border text-slate-500 bg-transparent border-slate-700/40">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {task.completed_at.slice(0, 10)}
            </span>
          )}
        </div>

        {/* クイックステータスボタン: 完了タスクには表示しない。
            todo → in-progress と in-progress → done の1ステップだけ提供する。
            ドラッグより素早く状態を進めるための補助機能。 */}
        {task.status !== "done" && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
            {task.status === "todo" && (
              <button
                onClick={() => handleStatusChange("in-progress")}
                className="text-xs px-2.5 py-1 rounded-md text-violet-300 bg-violet-900/30 border border-violet-700/40 hover:bg-violet-800/40 transition"
              >
                着手する →
              </button>
            )}
            {task.status === "in-progress" && (
              <button
                onClick={() => handleStatusChange("done")}
                className="text-xs px-2.5 py-1 rounded-md text-emerald-300 bg-emerald-900/30 border border-emerald-700/40 hover:bg-emerald-800/40 transition"
              >
                完了にする ✓
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
