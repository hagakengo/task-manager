"use client";

import { Task } from "@/lib/api";

interface Props {
  state: "idle" | "working" | "break";
  secondsLeft: number;
  workSeconds: number;
  task: Task | null;
  cyclesDone: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSkip: () => void;
}

export default function PomodoroTimer({
  state, secondsLeft, workSeconds, task, cyclesDone,
  onStart, onPause, onReset, onSkip,
}: Props) {
  if (state === "idle") return null;

  const total = state === "break" ? 5 * 60 : workSeconds;
  const progress = 1 - secondsLeft / total;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  const isWorking = state === "working";
  const accent = isWorking ? "bg-violet-500" : "bg-emerald-500";
  const trackColor = isWorking ? "rgba(139,92,246,0.15)" : "rgba(16,185,129,0.15)";
  const labelCls = isWorking
    ? "text-violet-300 bg-violet-500/15 border-violet-500/30"
    : "text-emerald-300 bg-emerald-500/15 border-emerald-500/30";

  return (
    <div className="border-t border-white/5 relative overflow-hidden"
      style={{ background: trackColor }}>
      {/* Thin progress bar at very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div
          className={`h-full ${accent} transition-all duration-1000 ease-linear`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-4">
        {/* Phase badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border flex-shrink-0 ${labelCls}`}>
          {isWorking ? "作業中" : "休憩中"}
        </span>

        {/* Task name */}
        {task && (
          <span className="text-xs text-slate-400 truncate flex-1 min-w-0">
            {task.title}
          </span>
        )}
        {!task && <span className="flex-1" />}

        {/* Timer */}
        <span className="text-sm font-mono font-bold text-white tracking-wider flex-shrink-0">
          {mins}:{secs}
        </span>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onReset}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition"
            title="リセット"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={isWorking ? onPause : onStart}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-white transition hover:opacity-90 active:scale-95 ${
              isWorking
                ? "bg-violet-600 hover:bg-violet-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {isWorking ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={onSkip}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/8 transition"
            title="スキップ"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Cycles */}
        {cyclesDone > 0 && (
          <span className="text-xs text-slate-500 flex-shrink-0">
            ⏱️ <span className="text-slate-300 font-medium">{cyclesDone}</span>
          </span>
        )}
      </div>
    </div>
  );
}
