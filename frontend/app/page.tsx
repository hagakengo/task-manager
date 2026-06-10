"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Task, fetchTasks, createTask, updateTask, deleteTask, Status, Priority } from "@/lib/api";
import TaskCard from "@/components/TaskCard";
import TaskForm from "@/components/TaskForm";
import FocusView from "@/components/FocusView";
import CalendarView from "@/components/CalendarView";
import PomodoroTimer from "@/components/PomodoroTimer";
import ChatView from "@/components/ChatView";

// ─── Kanban ───────────────────────────────────────────────────────────────────

// カンバン列の定義。status は API の値と一致させる必要がある。
// dot は列ヘッダーの色ドット。
const columns: { status: Status; label: string; dot: string }[] = [
  { status: "todo",        label: "未着手",   dot: "bg-slate-400"  },
  { status: "in-progress", label: "進行中",   dot: "bg-violet-400" },
  { status: "waiting",     label: "回答待ち", dot: "bg-amber-400"  },
  { status: "done",        label: "完了",     dot: "bg-emerald-400"},
];

// ドロップ時のハイライトスタイルを列ごとに定義する。
// Record<Status, string> にすることで全ステータスの定義漏れを型で検出できる。
const dropHighlight: Record<Status, string> = {
  "todo":        "ring-slate-500/50  bg-slate-500/5",
  "in-progress": "ring-violet-500/50 bg-violet-500/5",
  "done":        "ring-emerald-500/50 bg-emerald-500/5",
  "waiting":     "ring-amber-500/50  bg-amber-500/5",
};
const colAccent: Record<Status, string> = {
  "todo":        "bg-slate-400",
  "in-progress": "bg-violet-400",
  "done":        "bg-emerald-400",
  "waiting":     "bg-amber-400",
};

// ─── Sort ─────────────────────────────────────────────────────────────────────
type SortKey = "created_at" | "due_date" | "priority" | "title";
const sortOptions: { key: SortKey; label: string }[] = [
  { key: "created_at", label: "作成日"   },
  { key: "due_date",   label: "期限"     },
  { key: "priority",   label: "優先度"   },
  { key: "title",      label: "タイトル" },
];
// 優先度を数値にマッピングして sort の比較に使う。
const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ─── Pomodoro ─────────────────────────────────────────────────────────────────
const WORK_SECS  = 25 * 60;
const BREAK_SECS =  5 * 60;

function isOverdue(task: Task) {
  if (!task.due_date || task.status === "done") return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today;
}

type View = "kanban" | "focus" | "calendar" | "chat";
const views: { key: View; label: string; icon: string }[] = [
  { key: "kanban",   label: "カンバン",     icon: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" },
  { key: "focus",    label: "フォーカス",   icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { key: "calendar", label: "カレンダー",   icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { key: "chat",     label: "AIチャット",   icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
];

export default function Home() {
  // ─── Tasks ──────────────────────────────────────────────────────────────────
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // ─── UI ─────────────────────────────────────────────────────────────────────
  const [view,            setView]           = useState<View>("kanban");
  const [showForm,        setShowForm]       = useState(false);
  const [showArchived,    setShowArchived]   = useState(false);
  const [archivedTasks,   setArchivedTasks]  = useState<Task[]>([]);

  const [dragOverStatus, setDragOverStatus] = useState<Status | null>(null);

  // ─── Search / Sort / Filter ─────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState("");
  const [sortKey,        setSortKey]        = useState<SortKey>("created_at");
  const [sortDir,        setSortDir]        = useState<"asc" | "desc">("desc");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");
  const [filterOverdue,  setFilterOverdue]  = useState(false);

  // ─── Undo delete ────────────────────────────────────────────────────────────
  // pendingDelete は「削除予約中」の状態。
  // タスクは UI からは即座に消えているが、実際の API 呼び出しは5秒後。
  // timerId を保持することで「元に戻す」時に clearTimeout でキャンセルできる。
  const [pendingDelete, setPendingDelete] = useState<{
    task: Task; timerId: ReturnType<typeof setTimeout>;
  } | null>(null);

  // ─── Pomodoro ───────────────────────────────────────────────────────────────
  const [pomTask,    setPomTask]    = useState<Task | null>(null);
  const [pomState,   setPomState]   = useState<"idle" | "working" | "break">("idle");
  const [pomSeconds, setPomSeconds] = useState(WORK_SECS);
  const [pomWorkSecs,setPomWorkSecs]= useState(WORK_SECS);
  const [pomCycles,  setPomCycles]  = useState(0);
  // useRef で通知の二重発火を防ぐフラグを管理する。
  // useState にすると state 更新が非同期になるため、同期的に参照できる ref を使う。
  const pomNotified = useRef(false);

  // ポモドーロのカウントダウン。
  // pomState が "idle" のときは interval を作らない（early return）。
  useEffect(() => {
    if (pomState === "idle") return;
    const id = setInterval(() => setPomSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    // クリーンアップ関数で interval をクリアする。
    // pomState が変わるたびに古い interval を止めて新しく作り直す。
    return () => clearInterval(id);
  }, [pomState]);

  // pomSeconds が 0 になったときのフェーズ遷移。
  // 別の useEffect に分けることで「カウントダウン」と「状態遷移」の責務を分離している。
  useEffect(() => {
    if (pomSeconds !== 0 || pomState === "idle") return;
    if (!pomNotified.current) {
      pomNotified.current = true;
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(pomState === "working" ? "🎉 休憩タイム！" : "💪 作業を再開しよう！");
      }
    }
    // 800ms 待ってからフェーズを切り替える。
    // 即座に切り替えると「00:00」が一瞬で消えてしまうため、ユーザーが認識できるよう待つ。
    const timer = setTimeout(() => {
      pomNotified.current = false;
      if (pomState === "working") {
        setPomCycles(c => c + 1);
        setPomState("break");
        setPomSeconds(BREAK_SECS);
      } else {
        setPomState("idle");
        setPomSeconds(WORK_SECS);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [pomSeconds, pomState]);

  function startPomodoro(task: Task, minutes = 25) {
    // 初回起動時にブラウザの通知許可を求める。
    // "default" 状態のときだけ表示し、すでに "granted" / "denied" なら何もしない。
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const secs = minutes * 60;
    setPomTask(task);
    setPomWorkSecs(secs);
    setPomState("working");
    setPomSeconds(secs);
    pomNotified.current = false;
  }

  // ─── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => { loadTasks(); }, []);

  async function loadTasks() {
    try {
      setTasks(await fetchTasks());
    } catch {
      setError("バックエンドに接続できません。サーバーが起動しているか確認してください。");
    } finally {
      setLoading(false);
    }
  }

  async function loadArchivedTasks() {
    try {
      // include_archived=true で全タスクを取得し、フロントで archived=true だけ絞り込む。
      const all = await fetchTasks(true);
      setArchivedTasks(all.filter(t => t.archived));
    } catch { /* ignore */ }
  }

  function handleToggleArchived() {
    // アーカイブを開くときだけ取得する（初回のみ）。
    // 既に開いている場合は再取得しない。
    if (!showArchived) loadArchivedTasks();
    setShowArchived(v => !v);
  }

  // ─── Handlers ────────────────────────────────────────────────────────────────
  async function handleCreate(data: import("@/lib/api").TaskCreate | import("@/lib/api").TaskUpdate) {
    const t = await createTask(data as import("@/lib/api").TaskCreate);
    // 作成後に全件再取得せず、先頭に追加するだけにすることで画面のちらつきを防ぐ。
    setTasks(prev => [t, ...prev]);
    setShowForm(false);
  }

  function handleUpdated(updated: Task) {
    // 更新されたタスクだけ差し替える。他のタスクはそのまま保持する。
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function handleDeleteRequested(task: Task) {
    // 前の削除予約が残っている場合は即座に確定させる。
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      deleteTask(pendingDelete.task.id);
    }
    // UI からは即座に除外する（楽観的UI更新）。
    setTasks(prev => prev.filter(t => t.id !== task.id));
    // 5秒後に実際に削除する。
    const timerId = setTimeout(() => { deleteTask(task.id); setPendingDelete(null); }, 5000);
    setPendingDelete({ task, timerId });
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    // 削除したタスクを先頭に戻す。
    setTasks(prev => [pendingDelete.task, ...prev]);
    setPendingDelete(null);
  }

  async function handleDrop(e: React.DragEvent, status: Status) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("taskId"));
    const task = tasks.find(t => t.id === id);
    // 同じ列へのドロップは無視する（不要なAPIコールを防ぐ）。
    if (!task || task.status === status) return;
    handleUpdated(await updateTask(id, { status }));
    setDragOverStatus(null);
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  // useMemo で stats を計算する。
  // tasks が変わらない限り再計算しないため、tasks の変化がないレンダリングでは無駄な計算をしない。
  const stats = useMemo(() => {
    const done   = tasks.filter(t => t.status === "done").length;
    const wip    = tasks.filter(t => t.status === "in-progress").length;
    const todo   = tasks.filter(t => t.status === "todo").length;
    const overdue = tasks.filter(isOverdue).length;
    const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return { done, wip, todo, overdue, progress };
  }, [tasks]);

  // processedTasks は検索・フィルター・ソートを適用したタスク配列。
  // useMemo を使う理由：tasks や各フィルター状態が変わったときだけ再計算し、
  // 無関係な state 変化（showForm など）によるレンダリングでは再計算しない。
  const processedTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let r = [...tasks];
    if (q) r = r.filter(t => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    if (filterPriority !== "all") r = r.filter(t => t.priority === filterPriority);
    if (filterOverdue) r = r.filter(isOverdue);
    r.sort((a, b) => {
      let cmp = 0;
      if      (sortKey === "created_at") cmp = a.created_at.localeCompare(b.created_at);
      // due_date が null のタスクは "9999" として末尾に並べる。
      else if (sortKey === "due_date")   cmp = (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
      else if (sortKey === "priority")   cmp = priorityRank[a.priority] - priorityRank[b.priority];
      // localeCompare に "ja" を指定することで日本語の文字コード順ではなく辞書順で並ぶ。
      else if (sortKey === "title")      cmp = a.title.localeCompare(b.title, "ja");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [tasks, searchQuery, filterPriority, filterOverdue, sortKey, sortDir]);

  // フィルターが何か適用されているかを表すフラグ。「クリア」ボタンの表示判定に使う。
  const isFiltered = searchQuery.trim() || filterPriority !== "all" || filterOverdue;
  const tasksByStatus = (s: Status) => processedTasks.filter(t => t.status === s);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg,#080c14 0%,#0d1220 50%,#080c14 100%)" }}>

      {/* sticky top-0 でスクロールしてもヘッダーが常に画面上部に固定される */}
      <header className="border-b border-white/5 backdrop-blur-sm sticky top-0 z-30"
        style={{ background: "rgba(8,12,20,0.9)" }}>
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-white">タスク管理</h1>
                <p className="text-xs text-slate-500">{tasks.length} タスク</p>
              </div>
            </div>

            {/* View tabs */}
            <div className="flex items-center gap-1 bg-slate-800/60 border border-white/8 rounded-lg p-1">
              {views.map(({ key, label, icon }) => (
                <button key={key} onClick={() => setView(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    view === key
                      ? "text-white bg-violet-600/80"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* New task */}
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">新規タスク</span>
            </button>
          </div>
        </div>
        {/* ポモドーロタイマーはヘッダー内に配置。idle のときは自身で null を返す */}
        <PomodoroTimer
          state={pomState}
          secondsLeft={pomSeconds}
          workSeconds={pomWorkSecs}
          task={pomTask}
          cyclesDone={pomCycles}
          onStart={() => setPomState("working")}
          onPause={() => { setPomState("idle"); setPomTask(null); }}
          onReset={() => { setPomState("idle"); setPomSeconds(pomWorkSecs); setPomTask(null); }}
          onSkip={() => {
            if (pomState === "working") { setPomCycles(c => c + 1); setPomState("break"); setPomSeconds(BREAK_SECS); }
            else { setPomState("idle"); setPomSeconds(pomWorkSecs); }
          }}
        />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {error && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* 統計バーはカンバンビューかつタスクがあるときだけ表示する */}
        {!loading && tasks.length > 0 && view === "kanban" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "未着手",   value: stats.todo,    color: "text-slate-300",   border: "border-slate-600/40" },
              { label: "進行中",   value: stats.wip,     color: "text-violet-300",  border: "border-violet-600/40" },
              { label: "完了",     value: stats.done,    color: "text-emerald-300", border: "border-emerald-600/40" },
              { label: "期限切れ", value: stats.overdue, color: stats.overdue > 0 ? "text-red-400" : "text-slate-500", border: stats.overdue > 0 ? "border-red-600/40" : "border-slate-700/40" },
            ].map(({ label, value, color, border }) => (
              <div key={label} className={`rounded-xl border ${border} bg-slate-900/40 px-4 py-3 flex items-center justify-between`}>
                <span className="text-xs text-slate-500">{label}</span>
                <span className={`text-xl font-bold ${color}`}>{value}</span>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-4 rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">完了率</span>
                <span className="text-xs font-medium text-slate-300">{stats.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${stats.progress}%`, background: "linear-gradient(90deg,#6366f1,#10b981)" }} />
              </div>
            </div>
          </div>
        )}

        {/* タスク作成モーダル。fixed + backdrop-filter でオーバーレイを実現する */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
            <div className="w-full max-w-md rounded-2xl border border-white/10 p-6 shadow-2xl"
              style={{ background: "rgba(15,20,35,0.95)" }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-white">新規タスクを作成</h2>
                <button onClick={() => setShowForm(false)}
                  className="text-slate-500 hover:text-slate-300 transition p-1 rounded-lg hover:bg-white/5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
            <p className="text-slate-500 text-sm">読み込み中...</p>
          </div>

        ) : view === "focus" ? (
          <FocusView
            tasks={tasks}
            onUpdated={handleUpdated}
            onDeleted={handleDeleteRequested}
            onStartPomodoro={startPomodoro}
            pomodoroTaskId={pomTask?.id ?? null}
          />

        ) : view === "calendar" ? (
          <CalendarView tasks={tasks} />

        ) : view === "chat" ? (
          <ChatView onTasksChanged={loadTasks} />

        ) : (
          /* Kanban */
          <>
            {/* Toolbar: 検索・ソート・フィルターをまとめたエリア */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-48">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="タスクを検索..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg text-sm text-slate-200 bg-slate-800/60 border border-white/10 placeholder-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* ソートキー切り替え。同じキーを押すと昇順/降順をトグルする */}
                <div className="flex items-center gap-1 bg-slate-800/60 border border-white/8 rounded-lg p-1">
                  {sortOptions.map(({ key, label }) => (
                    <button key={key}
                      onClick={() => { if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("desc"); } }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        sortKey === key ? "text-white bg-violet-600/80" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}>
                      {label}{sortKey === key && <span className="ml-1 text-violet-300">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-600">フィルター:</span>
                {(["all","high","medium","low"] as const).map(p => {
                  const labels = { all:"すべて", high:"優先度：高", medium:"優先度：中", low:"優先度：低" };
                  return (
                    <button key={p} onClick={() => setFilterPriority(p)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                        filterPriority === p
                          ? "text-white bg-violet-600/70 border-violet-500/60"
                          : "text-slate-400 border-slate-700/50 hover:border-slate-600 hover:text-slate-300"
                      }`}>{labels[p]}</button>
                  );
                })}
                <div className="w-px h-4 bg-slate-700/50" />
                <button onClick={() => setFilterOverdue(v => !v)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                    filterOverdue
                      ? "text-red-300 bg-red-500/15 border-red-500/40"
                      : "text-slate-400 border-slate-700/50 hover:border-slate-600 hover:text-slate-300"
                  }`}>期限切れのみ</button>
                {isFiltered && (
                  <button onClick={() => { setSearchQuery(""); setFilterPriority("all"); setFilterOverdue(false); }}
                    className="px-2.5 py-1 rounded-md text-xs text-slate-500 hover:text-slate-300 transition underline underline-offset-2">
                    クリア
                  </button>
                )}
              </div>
            </div>
            {isFiltered && (
              <p className="text-xs text-slate-500">{processedTasks.length} 件表示中</p>
            )}

            {/* Kanban board */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {columns.map(({ status, label, dot }) => {
                const col  = tasksByStatus(status);
                const isOver = dragOverStatus === status;
                return (
                  <div key={status} className="flex flex-col gap-3"
                    onDragOver={e => { e.preventDefault(); setDragOverStatus(status); }}
                    onDragLeave={() => setDragOverStatus(null)}
                    onDrop={e => handleDrop(e, status)}>
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-sm font-medium text-slate-300">{label}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full text-slate-500 bg-slate-800/80 border border-slate-700/50">
                        {col.length}
                      </span>
                    </div>
                    {/* ドロップ中は ring でハイライトする */}
                    <div className={`flex flex-col gap-3 flex-1 min-h-32 rounded-xl p-2 border-2 transition-all duration-150 ${
                      isOver ? `ring-2 ${dropHighlight[status]} border-transparent` : "border-transparent"
                    }`}>
                      <div className={`h-0.5 rounded-full w-full ${colAccent[status]} opacity-60`} />
                      {col.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-slate-800 text-slate-600 text-xs py-10">
                          {isFiltered ? "該当なし" : "ここにドロップ"}
                        </div>
                      ) : (
                        col.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onUpdated={handleUpdated}
                            onDeleted={handleDeleteRequested}
                            onStartPomodoro={startPomodoro}
                            isPomodoro={pomTask?.id === task.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </>
        )}

        {/* アーカイブトグルはチャット以外の全ビューで表示する */}
        {view !== "chat" && (
          <div className="mt-8 border-t border-white/5 pt-6">
            <button
              onClick={handleToggleArchived}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition"
            >
              <svg className={`w-4 h-4 transition-transform ${showArchived ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              アーカイブ済み（完了から7日以上）
              {showArchived && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">{archivedTasks.length}</span>}
            </button>

            {showArchived && (
              <div className="mt-4 space-y-2">
                {archivedTasks.length === 0 ? (
                  <p className="text-xs text-slate-600 pl-1">アーカイブされたタスクはありません</p>
                ) : (
                  archivedTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/5 text-sm opacity-50"
                      style={{ background: "rgba(15,20,35,0.7)" }}>
                      <span className="text-slate-400 line-through">{task.title}</span>
                      <span className="text-xs text-slate-600">{task.completed_at?.slice(0, 10)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Undo トースト。fixed で画面下部中央に固定。5秒プログレスバー付き */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 shadow-2xl text-sm"
          style={{ background: "rgba(20,27,45,0.97)", backdropFilter: "blur(12px)" }}>
          <span className="text-slate-300">
            「<span className="text-white font-medium">{pendingDelete.task.title}</span>」を削除しました
          </span>
          <button onClick={handleUndoDelete}
            className="px-3 py-1 rounded-lg font-medium text-violet-300 border border-violet-500/40 hover:bg-violet-500/15 transition">
            元に戻す
          </button>
          {/* 5秒で縮む進捗バー。CSS animation の shrink を globals.css で定義している */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
            <div className="h-full bg-violet-500 animate-[shrink_5s_linear_forwards]" />
          </div>
        </div>
      )}

    </div>
  );
}
