from __future__ import annotations
import json
import os
import re
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal, Task

router = APIRouter(prefix="/chat", tags=["chat"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ChatRequest(BaseModel):
    message: str


def detect_due_date(message: str, today: date) -> str | None:
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)
    if re.search(r'この後|今日中|今夜|今から|あとで|後で|今日|今晩|今夜中', message):
        return str(today)
    if re.search(r'明日|明日中|あす', message):
        return str(tomorrow)
    if re.search(r'今週中|今週末|今週', message):
        return str(next_week)
    return None


def build_prompt(message: str, tasks: list, today: date) -> str:
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    tasks_text = "\n".join([
        f"- ID:{t.id} [{t.status}] {t.title} 期限:{t.due_date or 'なし'} 優先度:{t.priority}"
        for t in tasks
    ]) or "（タスクなし）"

    return f"""あなたはタスク管理AIアシスタントです。
今日の日付: {today}（明日:{tomorrow}, 来週月曜:{next_week}）

現在のタスク一覧:
{tasks_text}

ユーザーメッセージ: {message}

以下のJSON形式のみで返答してください（コードブロック不要、他のテキスト不要）:
{{"reply": "ユーザーへの返答（日本語、簡潔に）", "actions": []}}

actionsに使えるタイプ:
- {{"type":"create","title":"タイトル","description":"詳細説明（任意）","due_date":"YYYY-MM-DD or null","priority":"high/medium/low","status":"todo"}}
- {{"type":"create","title":"タイトル","description":null,"due_date":null,"priority":"medium","status":"waiting"}}
- {{"type":"complete","task_id":数字}}
- {{"type":"update","task_id":数字,"due_date":"YYYY-MM-DD or null","status":"todo/in-progress/done/waiting"}}

日付変換ルール（必ず適用すること）:
- 「この後」「今日中」「今夜」「今から」「あとで」「後で」「今日」→ due_date:"{today}"
- 「明日」「明日中」→ due_date:"{tomorrow}"
- 「今週中」「今週末」→ due_date:"{next_week}"
- 「〇日まで」「〇日締め」→ 該当日付に変換
- 日時を示す言葉が含まれる場合は必ずdue_dateを設定し、nullにしない

変換例:
- 「この後ご飯」→ {{"type":"create","title":"ご飯","due_date":"{today}","priority":"low","status":"todo"}}
- 「明日打ち合わせ」→ {{"type":"create","title":"打ち合わせ","due_date":"{tomorrow}","priority":"medium","status":"todo"}}

アクションルール:
- 作業・確認・提出・交換などの動詞を含むフレーズはcreate
- 「確認依頼」「問い合わせ」「回答待ち」「見積依頼」「メーカー確認」「客先確認」はstatus:waiting
- 「完了」「終わった」「できた」「済み」はcomplete（既存タスクと照合）
- 「延期」「変更」「〜に変更」はupdate
- タスク一覧の照会・質問はactionsを空にしてreplyのみ
- 期限なし指定はdue_date:null"""


@router.post("")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    from groq import Groq

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"reply": "GROQ_API_KEY が設定されていません。", "actions_result": []}

    client = Groq(api_key=api_key)

    tasks = db.query(Task).filter(Task.status != "done").order_by(Task.created_at.desc()).all()
    prompt = build_prompt(req.message, tasks, date.today())

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        text = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        data = json.loads(text)
    except Exception as e:
        return {"reply": f"AI処理エラー: {e}", "actions_result": []}

    detected_due = detect_due_date(req.message, date.today())

    results = []
    for action in data.get("actions", []):
        t = action.get("type")
        try:
            if t == "create":
                due = action.get("due_date") or detected_due
                task = Task(
                    title=action["title"],
                    description=action.get("description"),
                    due_date=due,
                    priority=action.get("priority", "medium"),
                    status=action.get("status", "todo"),
                )
                db.add(task)
                db.commit()
                db.refresh(task)
                results.append({"action": "created", "task_id": task.id, "title": task.title, "status": task.status})

            elif t == "complete":
                task = db.query(Task).filter(Task.id == action["task_id"]).first()
                if task:
                    task.status = "done"
                    task.completed_at = date.today().strftime("%Y-%m-%d %H:%M:%S")
                    db.commit()
                    results.append({"action": "completed", "task_id": task.id, "title": task.title})

            elif t == "update":
                task = db.query(Task).filter(Task.id == action["task_id"]).first()
                if task:
                    if "due_date" in action:
                        task.due_date = action["due_date"]
                    if "status" in action:
                        task.status = action["status"]
                    if "priority" in action:
                        task.priority = action["priority"]
                    db.commit()
                    results.append({"action": "updated", "task_id": task.id, "title": task.title})
        except Exception as e:
            results.append({"action": "error", "detail": str(e)})

    return {"reply": data.get("reply", ""), "actions_result": results}
