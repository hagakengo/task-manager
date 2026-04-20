const API_BASE = "http://localhost:8000";

export type Status = "todo" | "in-progress" | "done";
export type Priority = "high" | "medium" | "low";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
}

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

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}/tasks`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tasks");
  return res.json();
}

export async function createTask(data: TaskCreate): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
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
  if (!res.ok) throw new Error("Failed to delete task");
}
