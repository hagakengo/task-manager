"use client";

import { useState } from "react";
import { Task, TaskUpdate, updateTask, deleteTask, Status } from "@/lib/api";
import TaskForm from "./TaskForm";

interface Props {
  task: Task;
  onUpdated: (task: Task) => void;
  onDeleted: (id: number) => void;
}

const statusLabel: Record<string, string> = {
  todo: "未着手",
  "in-progress": "進行中",
  done: "完了",
};

const statusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  "in-progress": "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

const priorityLabel: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-500",
};

export default function TaskCard({ task, onUpdated, onDeleted }: Props) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(data: TaskUpdate) {
    const updated = await updateTask(task.id, data);
    onUpdated(updated);
    setEditing(false);
  }

  async function handleStatusChange(status: Status) {
    const updated = await updateTask(task.id, { status });
    onUpdated(updated);
  }

  async function handleDelete() {
    if (!confirm(`「${task.title}」を削除しますか？`)) return;
    setDeleting(true);
    await deleteTask(task.id);
    onDeleted(task.id);
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <TaskForm initial={task} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  const isOverdue =
    task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 space-y-3 transition ${task.status === "done" ? "opacity-60" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0"
            checked={task.status === "done"}
            onChange={(e) => handleStatusChange(e.target.checked ? "done" : "todo")}
          />
          <div className="min-w-0">
            <p className={`font-medium text-sm break-words ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 break-words">{task.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-blue-600 transition p-1 rounded"
            title="編集"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-400 hover:text-red-600 transition p-1 rounded"
            title="削除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[task.status]}`}>
          {statusLabel[task.status]}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
          優先度: {priorityLabel[task.priority]}
        </span>
        {task.due_date && (
          <span className={`inline-flex items-center text-xs ${isOverdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isOverdue ? "期限切れ: " : ""}{task.due_date}
          </span>
        )}
      </div>

      {task.status !== "done" && (
        <div className="flex gap-2 pt-1">
          {task.status === "todo" && (
            <button
              onClick={() => handleStatusChange("in-progress")}
              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
            >
              着手する
            </button>
          )}
          {task.status === "in-progress" && (
            <button
              onClick={() => handleStatusChange("done")}
              className="text-xs px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 transition"
            >
              完了にする
            </button>
          )}
        </div>
      )}
    </div>
  );
}
