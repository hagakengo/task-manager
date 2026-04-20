"use client";

import { useEffect, useState } from "react";
import { Task, fetchTasks, createTask, Status } from "@/lib/api";
import TaskCard from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";

const columns: { status: Status; label: string; color: string }[] = [
  { status: "todo", label: "未着手", color: "border-gray-300" },
  { status: "in-progress", label: "進行中", color: "border-blue-400" },
  { status: "done", label: "完了", color: "border-green-400" },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    try {
      const data = await fetchTasks();
      setTasks(data);
    } catch {
      setError("バックエンドに接続できません。サーバーが起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(data: import("@/lib/api").TaskCreate | import("@/lib/api").TaskUpdate) {
    const newTask = await createTask(data as import("@/lib/api").TaskCreate);
    setTasks((prev) => [newTask, ...prev]);
    setShowForm(false);
  }

  function handleUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  function handleDeleted(id: number) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const tasksByStatus = (status: Status) => tasks.filter((t) => t.status === status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">タスク管理</h1>
            <p className="text-xs text-gray-500 mt-0.5">{tasks.length} 件のタスク</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規タスク
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* New task modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">新規タスクを作成</h2>
              <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : (
          /* Kanban columns */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {columns.map(({ status, label, color }) => {
              const col = tasksByStatus(status);
              return (
                <div key={status} className="flex flex-col">
                  <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${color}`}>
                    <span className="font-semibold text-sm text-gray-700">{label}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {col.length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1">
                    {col.length === 0 ? (
                      <div className="text-xs text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        タスクなし
                      </div>
                    ) : (
                      col.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onUpdated={handleUpdated}
                          onDeleted={handleDeleted}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
