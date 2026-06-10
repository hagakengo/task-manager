"use client";

import { useState } from "react";
import { Task } from "@/lib/api";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// 優先度・ステータスを色ドットで表現する。
// Record<string, string> 型で exhaustive なマッピングを定義する。
const priorityDot: Record<string, string> = {
  high:   "bg-red-400",
  medium: "bg-amber-400",
  low:    "bg-slate-500",
};

const statusDot: Record<string, string> = {
  todo:          "bg-slate-400",
  "in-progress": "bg-violet-400",
  done:          "bg-emerald-400",
};

interface Props {
  tasks: Task[];
}

// 数値を2桁の文字列にゼロ埋めするユーティリティ。
// "2024-01-05" のような ISO 形式の日付文字列を作るために使う。
function pad(n: number) { return String(n).padStart(2, "0"); }

export default function CalendarView({ tasks }: Props) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  // 選択中の日付を "YYYY-MM-DD" 文字列で管理する。
  // Date オブジェクトではなく文字列にすることで、タスクの due_date との比較が単純になる。
  const [selected, setSelected] = useState<string | null>(null);

  // カレンダーのセルを計算する。
  // new Date(year, month, 1).getDay() で月の初日の曜日（0=日〜6=土）を取得。
  // new Date(year, month + 1, 0).getDate() で月の末日を取得（0日 = 前月の末日の応用）。
  const firstDow = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();

  // 先頭に null を詰めて曜日がずれないようにし、日付の配列と結合する。
  // 7の倍数になるよう末尾にも null を追加することで最終週の空白セルを作る。
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // タスクを due_date をキーにしたオブジェクトにグループ化する。
  // ??= は「プロパティが存在しなければ空配列を代入してから push する」短縮記法。
  const tasksByDate: Record<string, Task[]> = {};
  for (const t of tasks) {
    if (t.due_date) {
      (tasksByDate[t.due_date] ??= []).push(t);
    }
  }

  // 月の切り替えは1月 → 12月・12月 → 1月のとき年もまたぐ。
  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const selectedTasks = selected ? (tasksByDate[selected] ?? []) : [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Calendar */}
        <div className="lg:col-span-2">
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-base font-semibold text-white">{year}年 {month + 1}月</p>
            </div>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* DOW header — 日曜を赤、土曜を青で表示する慣習に従う */}
          <div className="grid grid-cols-7 mb-2">
            {DOW.map((d, i) => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-500"}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;

              const dateStr = `${year}-${pad(month + 1)}-${pad(date)}`;
              const dayTasks = tasksByDate[dateStr] ?? [];

              // 今日かどうか・過去かどうかを判定してスタイルを変える。
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === date;
              const isPast  = new Date(year, month, date) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const isSelected = selected === dateStr;

              // cells 配列内のインデックスと firstDow から曜日を求める。
              const dow = (firstDow + date - 1) % 7;

              return (
                <button
                  key={i}
                  // 同じ日を再クリックすると選択解除する。
                  onClick={() => setSelected(isSelected ? null : dateStr)}
                  className={`min-h-14 rounded-lg p-1 text-left transition-all border ${
                    isSelected
                      ? "border-violet-500/50 bg-violet-500/10"
                      : dayTasks.length > 0
                      ? "border-white/8 hover:border-white/15 hover:bg-white/3"
                      : "border-transparent hover:bg-white/3"
                  }`}
                >
                  {/* 今日は紫の丸バッジ、過去は薄く表示 */}
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 mx-auto ${
                    isToday
                      ? "bg-violet-500 text-white"
                      : isPast
                      ? dow === 0 ? "text-red-600" : dow === 6 ? "text-blue-700" : "text-slate-600"
                      : dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-slate-300"
                  }`}>
                    {date}
                  </div>

                  {/* タスクがある日はドットで表示する。
                      最大3件まで表示し、それ以上は "+N" で省略する。
                      完了タスクは緑ドット、未完了は優先度の色で表示する。 */}
                  {dayTasks.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className={`w-1.5 h-1.5 rounded-full ${
                          t.status === "done" ? statusDot.done : priorityDot[t.priority]
                        }`} />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[9px] text-slate-500 leading-none">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
            <span className="text-xs text-slate-600">優先度:</span>
            {[["bg-red-400","高"],["bg-amber-400","中"],["bg-slate-500","低"]].map(([cls, label]) => (
              <span key={label} className="flex items-center gap-1 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${cls}`} />{label}
              </span>
            ))}
            <span className={`flex items-center gap-1 text-xs text-slate-500`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />完了
            </span>
          </div>
        </div>

        {/* Side panel — 選択された日のタスク一覧と月次サマリーを表示する */}
        <div className="flex flex-col gap-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                {/* "YYYY-MM-DD" を "YYYY年MM月DD日" に変換する正規表現 */}
                <h3 className="text-sm font-medium text-slate-300">
                  {selected.replace(/^(\d+)-(\d+)-(\d+)$/, "$1年$2月$3日")}
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-600 hover:text-slate-400 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {selectedTasks.length === 0 ? (
                <p className="text-xs text-slate-600">この日のタスクはありません</p>
              ) : (
                <div className="space-y-2">
                  {selectedTasks.map((t) => (
                    <div key={t.id}
                      className="rounded-lg border border-white/8 p-3 relative overflow-hidden"
                      style={{ background: "rgba(20,27,45,0.9)" }}>
                      <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full ${priorityDot[t.priority]}`} />
                      <div className="pl-2">
                        <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-slate-500" : "text-slate-200"}`}>
                          {t.title}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded-md border ${
                            t.status === "done"          ? "text-emerald-300 bg-emerald-900/30 border-emerald-700/40" :
                            t.status === "in-progress"   ? "text-violet-300  bg-violet-900/30  border-violet-700/40"  :
                                                           "text-slate-400   bg-slate-800/60   border-slate-700/40"
                          }`}>
                            {t.status === "done" ? "完了" : t.status === "in-progress" ? "進行中" : "未着手"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600 text-sm">
              日付をクリックして<br />タスクを確認
            </div>
          )}

          {/* 月次サマリー。mt-auto で常にパネル下部に固定される。
              IIFE（即時実行関数）でフィルタリング結果を変数に閉じ込め、JSX 内で計算を行う。 */}
          <div className="mt-auto pt-4 border-t border-white/5 space-y-1">
            <p className="text-xs text-slate-500 mb-2">{month + 1}月のサマリー</p>
            {(() => {
              // due_date が "YYYY-MM" で始まるタスクを当月分として絞り込む。
              const monthTasks = tasks.filter(t => t.due_date?.startsWith(`${year}-${pad(month + 1)}`));
              const done = monthTasks.filter(t => t.status === "done").length;
              return (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">期限あるタスク</span>
                    <span className="text-slate-300">{monthTasks.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">完了</span>
                    <span className="text-emerald-400">{done}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">未完了</span>
                    <span className="text-slate-300">{monthTasks.length - done}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
