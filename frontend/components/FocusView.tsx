"use client";

import { Task, updateTask, Status } from "@/lib/api";

interface Props {
  tasks: Task[];
  onUpdated: (task: Task) => void;
  onDeleted: (task: Task) => void;
  onStartPomodoro: (task: Task) => void;
  pomodoroTaskId: number | null;
}

const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
const priorityLabel: Record<string, string> = { high: "高", medium: "中", low: "低" };
const priorityBar: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-400",
  low:    "bg-slate-600",
};

// 今日との差分を日数で返す関数（負の値 = 期限超過）。
// setHours(0,0,0,0) で時刻を0にそろえることで「日付のみ」で比較できる。
// ミリ秒の差を 86400000（1日のms）で割ることで日数を求める。
function getDueDiff(dueDate: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function FocusView({ tasks, onUpdated, onDeleted, onStartPomodoro, pomodoroTaskId }: Props) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const focusTasks = tasks
    .filter((t) => t.status !== "done")
    // フォーカスビューに表示するタスクの条件：
    // - due_date がある場合: 今日以前（diff <= 0）のもの
    // - due_date がない場合: 優先度が high のもの（期限なしでも緊急なタスクを拾うため）
    .filter((t) => {
      if (!t.due_date) return t.priority === "high";
      const diff = getDueDiff(t.due_date);
      return diff <= 0;
    })
    .sort((a, b) => {
      const diffA = a.due_date ? getDueDiff(a.due_date) : 999;
      const diffB = b.due_date ? getDueDiff(b.due_date) : 999;
      // urgency スコアの計算：
      // - 超過タスク（diff < 0）は -1000 に diff を加算して最上位に来るようにする。
      //   例：3日超過なら -1003、1日超過なら -1001（より超過しているほど上）
      // - 今日期限（diff === 0）は 0
      // - 期限なし（999）は最後
      const urgencyA = diffA < 0 ? -1000 + diffA : diffA <= 0 ? 0 : diffA;
      const urgencyB = diffB < 0 ? -1000 + diffB : diffB <= 0 ? 0 : diffB;
      if (urgencyA !== urgencyB) return urgencyA - urgencyB;
      // 緊急度が同じ場合は優先度で並べる
      return priorityRank[a.priority] - priorityRank[b.priority];
    });

  // 推定時間はポモドーロ1セット（25分）× タスク数で計算する。
  // 60分以上の場合は時間と分で表示する。
  const estimatedMins = focusTasks.length * 25;

  async function handleDone(task: Task) {
    const updated = await updateTask(task.id, { status: "done" as Status });
    onUpdated(updated);
  }

  if (focusTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">🎉</div>
        <p className="text-slate-300 font-medium">今日のフォーカスタスクはありません</p>
        <p className="text-slate-500 text-sm">すべて完了しているか、期限が先のタスクのみです</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">今日のフォーカス</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {focusTasks.length} タスク · 約 {estimatedMins >= 60
              ? `${Math.floor(estimatedMins / 60)} 時間 ${estimatedMins % 60 > 0 ? `${estimatedMins % 60} 分` : ""}`
              : `${estimatedMins} 分`}
          </p>
        </div>
        <div className="text-xs text-slate-500 bg-slate-800/60 border border-white/8 px-3 py-1.5 rounded-lg">
          今日期限・期限超過のみ
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {focusTasks.map((task) => {
          const diff = task.due_date ? getDueDiff(task.due_date) : null;
          const isActive = pomodoroTaskId === task.id;
          // 期限ラベルの計算。null なら表示しない。
          const dueLabel = diff === null ? null
            : diff < 0  ? { text: `${Math.abs(diff)} 日超過`, cls: "text-red-400" }
            : diff === 0 ? { text: "今日期限",           cls: "text-orange-300" }
            : diff <= 3  ? { text: `あと ${diff} 日`,    cls: "text-amber-300" }
            : null;

          return (
            <div
              key={task.id}
              className={`relative rounded-xl border p-4 transition-all ${
                isActive
                  ? "border-violet-500/50 bg-violet-500/5 shadow-lg shadow-violet-500/10"
                  : "border-white/8 hover:border-white/15"
              }`}
              style={{ background: isActive ? undefined : "rgba(20,27,45,0.9)" }}
            >
              {/* Priority bar */}
              <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full ${priorityBar[task.priority]}`} />

              <div className="pl-3 flex items-start gap-3">
                {/* チェックボックスをクリックすると即座に done に更新する。
                    カンバンのドラッグより素早く完了できる。 */}
                <button
                  onClick={() => handleDone(task)}
                  className="mt-0.5 flex-shrink-0 w-5 h-5 rounded border border-slate-600 hover:border-emerald-400 transition flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 break-words">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-0.5 break-words">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-slate-500 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded-md">
                      優先度 {priorityLabel[task.priority]}
                    </span>
                    {dueLabel && (
                      <span className={`text-xs ${dueLabel.cls}`}>{dueLabel.text}</span>
                    )}
                    {isActive && (
                      <span className="text-xs text-violet-300 animate-pulse">⏱️ ポモドーロ実行中</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => onStartPomodoro(task)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "text-violet-200 bg-violet-500/20 border border-violet-500/40"
                        : "text-slate-400 hover:text-violet-300 border border-slate-700/50 hover:border-violet-500/40 hover:bg-violet-500/10"
                    }`}
                  >
                    {isActive ? (
                      <>⏱️ 実行中</>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        開始
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleted(task)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
