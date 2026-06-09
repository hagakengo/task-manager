# タスク管理アプリ コード解説

## 目次
1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [バックエンド](#バックエンド)
3. [フロントエンド](#フロントエンド)
4. [主要機能の仕組み](#主要機能の仕組み)
5. [デプロイ構成](#デプロイ構成)

---

## アーキテクチャ概要

```
ブラウザ
  ↓ HTTP
nginx（ポート80）
  ├─ /tasks, /api → FastAPI（ポート8000）
  └─ /           → Next.js（ポート3000）
```

| 層 | 技術 | 役割 |
|----|------|------|
| フロントエンド | Next.js 16 + Tailwind CSS | UI の表示・操作 |
| バックエンド | FastAPI + SQLAlchemy | API サーバー・DB操作 |
| データベース | SQLite | タスクデータの永続化 |
| AI | Groq API (llama-3.1-8b-instant) | 自然言語でのタスク操作 |
| Web サーバー | nginx | リバースプロキシ |

---

## バックエンド

### ディレクトリ構成

```
backend/
├── main.py          # アプリのエントリーポイント
├── database.py      # DB接続・テーブル定義
├── schemas.py       # リクエスト/レスポンスの型定義
├── services.py      # ビジネスロジック
├── routers/
│   ├── tasks.py     # タスクCRUD APIエンドポイント
│   └── chat.py      # AIチャット APIエンドポイント
└── .env             # APIキー（Gitには含めない）
```

---

### `main.py` - アプリの起動設定

```python
load_dotenv(dotenv_path=os.path.expanduser("~/task-manager-backend/.env"))
```
起動時に `~/task-manager-backend/.env` を読み込み `GROQ_API_KEY` をセットします。
パスはホームディレクトリ直下の別フォルダを指しているため、EC2上での手動管理が前提です。

```python
app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://18.181.247.4:3000"])
```
ローカル開発用とEC2の固定IPを明示的に許可しています。

```python
app.include_router(tasks.router)
app.include_router(chat.router, prefix="/api")
```
タスク用ルーター（`/tasks`）とチャット用ルーター（`/api/chat`）を登録します。

---

### `database.py` - DB定義

```python
DB_PATH = os.path.join(os.path.dirname(__file__), "tasks.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
```
`tasks.db` はスクリプトと同じディレクトリに生成されます。`check_same_thread=False` は FastAPI の非同期処理で複数スレッドからアクセスするために必要な設定です。

**Task テーブルのカラム:**

| カラム | 型 | 説明 |
|--------|-----|------|
| id | Integer | 主キー、自動採番 |
| title | String | タスク名 |
| description | String | 詳細説明（任意） |
| status | String | todo / in-progress / done / waiting |
| priority | String | high / medium / low |
| due_date | String | 期限日（YYYY-MM-DD） |
| created_at | String | 作成日時（SQLite の `datetime('now','localtime')` で自動セット） |
| completed_at | String | 完了日時（完了時に自動セット） |
| archived | Boolean | アーカイブ済みフラグ |

---

### `schemas.py` - 型定義

Pydantic を使ってリクエスト・レスポンスの型を定義します。

- **TaskCreate**: タスク作成時に受け取るデータ（title は必須、status は `"todo"`・priority は `"medium"` がデフォルト）
- **TaskUpdate**: タスク更新時に受け取るデータ（全て任意、変更したいものだけ送る）
- **TaskResponse**: APIが返すデータの形（`from_attributes=True` で SQLAlchemy モデルから自動変換）

---

### `services.py` - ビジネスロジック

APIエンドポイントから呼び出されるデータ操作の関数群です。

**自動アーカイブ:**
```python
def auto_archive(db: Session) -> None:
    threshold = (datetime.now() - timedelta(days=7)).strftime(...)
    db.query(Task).filter(
        Task.status == "done",
        Task.archived == False,
        Task.completed_at != None,
        Task.completed_at <= threshold,
    ).update({"archived": True})
```
タスク一覧を取得するたびに呼ばれ、完了から7日以上経ったタスクを自動的にアーカイブします。バックグラウンドジョブを使わずリクエスト時に処理する「遅延アーカイブ」方式です。

**完了日時の自動セット／リセット:**
```python
if data.get("status") == "done" and db_task.status != "done":
    data["completed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
elif data.get("status") and data["status"] != "done":
    data["completed_at"] = None
```
ステータスが `done` に変わった瞬間に `completed_at` を記録し、`done` 以外に戻したときは `None` にリセットします。

---

### `routers/tasks.py` - タスク CRUD

| メソッド | パス | 処理 |
|---------|------|------|
| GET | /tasks | タスク一覧取得（`?include_archived=true` でアーカイブ含む） |
| GET | /tasks/{id} | 特定タスク取得 |
| POST | /tasks | タスク作成（201 返却） |
| PUT | /tasks/{id} | タスク更新 |
| DELETE | /tasks/{id} | タスク削除（204 返却） |

---

### `routers/chat.py` - AIチャット

**処理の流れ:**

```
ユーザーのメッセージ
  ↓
build_prompt()      # 現在のタスク一覧（done除く）+ メッセージ → AIへの指示文を生成
  ↓
Groq API 呼び出し   # llama-3.1-8b-instant がJSON形式で応答
  ↓
detect_due_date()   # AIの due_date が空の場合のフォールバック用に日付を検出
  ↓
actions の実行      # create / complete / update をDBに反映
  ↓
レスポンス返却
```

**`detect_due_date()`:**
AIが `due_date` を設定し忘れた場合のフォールバックとして使います。キーワードを検出して日付を返します。

```python
if re.search(r'この後|今日中|今夜|今から|あとで|後で|今日|今晩|今夜中', message):
    return str(today)
if re.search(r'明日|明日中|あす', message):
    return str(tomorrow)
if re.search(r'今週中|今週末|今週', message):
    return str(next_week)
```

`create` アクション実行時は `action.get("due_date") or detected_due` でAIの値を優先し、なければフォールバックを使います。

**`build_prompt()`:**
AIへの指示文を組み立てます。今日の日付・タスク一覧（未完了のみ）・出力形式（JSON）・日付変換ルール・アクションルールを含めます。AIは必ずJSON形式で返答するよう指示されています。

**コードフェンス除去:**
```python
if text.startswith("```"):
    lines = text.split("\n")
    text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
```
AIがMarkdownのコードブロックで囲んで返してきた場合に除去します。

---

## フロントエンド

### ディレクトリ構成

```
frontend/
├── app/
│   ├── page.tsx         # メインページ（状態管理・ビュー切り替え・カンバン）
│   ├── layout.tsx       # HTMLの外枠
│   └── globals.css      # グローバルスタイル
├── components/
│   ├── FocusView.tsx    # フォーカスビュー
│   ├── CalendarView.tsx # カレンダービュー
│   ├── ChatView.tsx     # AIチャットビュー
│   ├── TaskCard.tsx     # タスクカード（カンバン・フォーカスで使用）
│   ├── TaskForm.tsx     # タスク作成・編集フォーム
│   └── PomodoroTimer.tsx # ポモドーロタイマー（ヘッダーバー）
└── lib/
    └── api.ts           # バックエンドとの通信関数
```

---

### `lib/api.ts` - API通信

バックエンドとの通信を一元管理します。

```typescript
const API_BASE = "http://localhost:8000";
```

ローカル・EC2どちらもこの値のまま動きます（EC2ではnginxがポート80→8000に転送）。

`fetchTasks(includeArchived)` / `createTask()` / `updateTask()` / `deleteTask()` / `sendChatMessage()` の関数を提供します。全て `fetch` を使った非同期関数です。

---

### `app/page.tsx` - メインページ

アプリ全体の状態を管理するルートコンポーネントです。カンバンボードの描画もここに含まれます。

**主な状態（useState）:**

| 状態 | 型 | 説明 |
|------|----|------|
| tasks | Task[] | 全タスクデータ（アーカイブ除く） |
| view | "kanban" / "focus" / "calendar" / "chat" | 現在のビュー |
| searchQuery | string | タイトル・説明文の検索ワード |
| sortKey | "created_at" / "due_date" / "priority" / "title" | ソートキー |
| sortDir | "asc" / "desc" | ソート方向 |
| filterPriority | Priority / "all" | 優先度フィルター |
| filterOverdue | boolean | 期限切れのみ表示フラグ |
| pendingDelete | { task, timerId } / null | Undo削除の保留状態 |
| pomTask | Task / null | ポモドーロ対象タスク |
| pomState | "idle" / "working" / "break" | タイマー状態 |
| pomSeconds | number | 残り秒数 |
| pomWorkSecs | number | 作業時間（分単位で可変） |
| pomCycles | number | 完了したポモドーロ回数 |
| showArchived | boolean | アーカイブ表示フラグ |

**統計バー（カンバンビューのみ）:**
未着手・進行中・完了・期限切れの件数と完了率プログレスバーを表示します。

**Undo削除:**
```typescript
function handleDeleteRequested(task: Task) {
    setTasks(prev => prev.filter(t => t.id !== task.id));
    const timerId = setTimeout(() => { deleteTask(task.id); setPendingDelete(null); }, 5000);
    setPendingDelete({ task, timerId });
}
```
削除ボタン押下時はUIからのみ即座に除去し、5秒後に実際のAPIを呼び出します。5秒以内に「元に戻す」を押すと `clearTimeout` でキャンセルできます。

**カンバンのドラッグ＆ドロップ:**
```typescript
function handleDrop(e: React.DragEvent, status: Status) {
    const id = Number(e.dataTransfer.getData("taskId"));
    handleUpdated(await updateTask(id, { status }));
}
```
`dataTransfer` でドラッグしたタスクのIDを受け渡し、ドロップ先のステータスに更新します。

---

### `components/TaskCard.tsx` - タスクカード

カンバンボードに表示される個々のタスクカードです。

- **優先度バー**: カード左端の細い縦線（赤=高、橙=中、グレー=低）
- **期限バッジ**: 期限まであと何日かを計算して表示。超過は赤、当日はオレンジ、3日以内は黄色
- **完了日バッジ**: `status === "done"` かつ `completed_at` がある場合に表示
- **クイックステータスボタン**: 「着手する →」（todo→in-progress）/ 「完了にする ✓」（in-progress→done）
- **チェックボックス**: クリックで done ↔ todo をトグル
- **ドラッグ**: `draggable` 属性と `onDragStart` でIDを `dataTransfer` に格納
- **ポモドーロボタン**: 時間プリセット（5 / 15 / 25 / 50 分）のピッカーを表示して起動

---

### `components/FocusView.tsx` - フォーカスビュー

今日やるべきタスクに集中するためのビューです。

```typescript
.filter((t) => {
    if (!t.due_date) return false;
    const diff = getDueDiff(t.due_date);
    return diff <= 0;  // 今日期限または超過のみ
})
```

期限が今日以前のタスクだけを表示し、優先度・緊急度でソートします。

---

### `components/ChatView.tsx` - AIチャット

LINE風のチャットUIです。

**チャット履歴の保存:**
```typescript
const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("chat-history");
    return saved ? JSON.parse(saved) : [INITIAL_MESSAGE];
});
```
`localStorage` を使ってページをリロードしても履歴が残ります。

**メッセージ編集機能:**
```typescript
function handleEdit(index: number) {
    setEditingIndex(index);
    setInput(messages[index].text);
}
```
編集モード時は `editingIndex` 以降のメッセージを削除して再送します。

---

### `components/PomodoroTimer.tsx` - ポモドーロタイマー

ヘッダーに常駐する横長バーのタイマーです。`state === "idle"` のときは `return null` で非表示になります。

**タイマー遷移:**
```
working（作業中, 任意の分数）
  → 0秒でブラウザ通知 → break（休憩, 5分）
  → 0秒でブラウザ通知 → idle（終了）
```
作業時間はタスクカードのプリセット（5 / 15 / 25 / 50 分）で選択します。ブラウザ通知は `Notification.requestPermission()` で許可を求め、許可済みの場合のみ発火します。

---

## 主要機能の仕組み

### カンバンボード

```
TaskCard（draggable）
  → onDragStart: dataTransfer に taskId をセット
  → onDrop（列側）: taskId を取得 → updateTask(id, { status: 新しい列 })
```

### ポモドーロタイマー

```
タスクカードの⏱️ → 時間プリセット選択（5/15/25/50分）
  → startPomodoro(task, minutes)
    → pomState: "idle" → "working"
    → useEffect で1秒ごとに pomSeconds を減算
    → 0になったら "working" → "break" → "idle" と自動遷移
    → 各フェーズ完了時にブラウザ通知（許可済みの場合）
    → pomCycles で完了セット数をカウント
```

### Undo削除

```
削除ボタン → UIから即座に除外 → 5秒タイマー開始
  → 5秒以内に「元に戻す」: clearTimeout → tasks に再追加
  → 5秒経過: deleteTask(id) でDBから削除
```

### 自動アーカイブ

```
GET /tasks リクエスト
  → auto_archive() 実行
  → completed_at から7日以上経過した done タスクを archived=True に更新
  → archived=False のタスクのみ返却（デフォルト）
```

### AIチャット処理

```
ユーザー入力 → sendChatMessage()
  → POST /api/chat
    → build_prompt()（未完了タスク一覧+指示をAIに送信）
    → Groq API → JSON応答（コードフェンスは自動除去）
    → detect_due_date()（AIが due_date を省略した場合のフォールバック）
    → actions をDBに反映（create/complete/update）
  → onTasksChanged() → loadTasks() でカンバン再描画
```

---

## デプロイ構成

### AWS EC2

```
EC2（t2.micro / Ubuntu 24.04）
├── nginx（ポート80）
│   ├── /tasks, /api → uvicorn（127.0.0.1:8000）
│   └── /           → Next.js（127.0.0.1:3000）
├── FastAPI（systemd で自動起動）
│   └── /home/ubuntu/task-manager/backend/
└── Next.js（PM2 で自動起動）
    └── /home/ubuntu/task-manager/frontend/
```

### コード更新手順

```bash
# EC2 に SSH 後
cd ~/task-manager && git pull

# フロントエンドに変更がある場合
cd frontend && npm run build && pm2 restart task-manager-frontend

# バックエンドに変更がある場合
sudo systemctl restart task-manager-backend
```

### 注意事項

- EC2 を停止→起動するとパブリック IP が変わる（Elastic IP で固定可能）。IPが変わると `main.py` の CORS 設定と `lib/api.ts` の `API_BASE` も更新が必要
- `.env` は Git に含まれないため、サーバー上（`~/task-manager-backend/.env`）で手動管理
- SQLite のデータは EC2 上に保存。インスタンス削除でデータも消える
- t2.micro は RAM 1GB のため、Next.js ビルドに 1GB スワップが必要
