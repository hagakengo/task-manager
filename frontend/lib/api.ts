// バックエンドのベースURL。
// ローカル開発時は Next.js(:3000) からバックエンド(:8000) に直接リクエストする。
// EC2 では nginx がポート80で受けてポート8000に転送するため、この値のままで動く。
const API_BASE = "http://localhost:8000";

// TypeScript の Union 型で取り得る値を列挙する。
// 文字列リテラル型にすることで、タイポや未定義の値を型レベルで防げる。
export type Status = "todo" | "in-progress" | "done" | "waiting";
export type Priority = "high" | "medium" | "low";

// バックエンドの TaskResponse スキーマと対応させている。
// null を許容するフィールドは `string | null` と明示することで、
// 参照前に null チェックを強制できる。
export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  archived: boolean;
}

// 作成と更新で型を分けている理由：
// - 作成時は title が必須、更新時は全フィールドが任意（部分更新）。
// - 同じ型にすると「更新時に title が必須」という制約が外れない。
export interface TaskCreate {
  title: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  due_date?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: Status;
  priority?: Priority;
  due_date?: string;
}

export async function fetchTasks(includeArchived = false): Promise<Task[]> {
  const url = includeArchived ? `${API_BASE}/tasks?include_archived=true` : `${API_BASE}/tasks`;
  // cache: "no-store" は Next.js のキャッシュを無効化する設定。
  // デフォルトでは Next.js がレスポンスをキャッシュするため、
  // タスクを追加・更新しても古いデータが返ってしまう。
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    // JSON を送る場合は Content-Type ヘッダーが必須。
    // これがないとバックエンドがリクエストボディをパースできない。
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
}

export async function updateTask(id: number, data: TaskUpdate): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update task");
  return res.json();
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  // バックエンドは 204 No Content を返すのでボディなし。
  // Promise<void> にすることで呼び出し元が戻り値を使おうとするのを型で防ぐ。
  if (!res.ok) throw new Error("Failed to delete task");
}

export interface ChatResponse {
  reply: string;
  actions_result: { action: string; task_id?: number; title?: string; status?: string }[];
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}
