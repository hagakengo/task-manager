from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Task
from schemas import TaskCreate, TaskUpdate

ARCHIVE_AFTER_DAYS = 7


def auto_archive(db: Session) -> None:
    threshold = (datetime.now() - timedelta(days=ARCHIVE_AFTER_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    db.query(Task).filter(
        Task.status == "done",
        Task.archived == False,
        Task.completed_at != None,
        Task.completed_at <= threshold,
    ).update({"archived": True})
    db.commit()


def get_all_tasks(db: Session, include_archived: bool = False) -> list[Task]:
    auto_archive(db)
    q = db.query(Task)
    if not include_archived:
        q = q.filter(Task.archived == False)
    return q.order_by(Task.created_at.desc()).all()


def get_task(db: Session, task_id: int) -> Task | None:
    return db.query(Task).filter(Task.id == task_id).first()


def create_task(db: Session, task: TaskCreate) -> Task:
    db_task = Task(
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(db: Session, task_id: int, task: TaskUpdate) -> Task | None:
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        return None
    data = task.model_dump(exclude_none=True)
    if data.get("status") == "done" and db_task.status != "done":
        data["completed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    elif data.get("status") and data["status"] != "done":
        data["completed_at"] = None
    for k, v in data.items():
        setattr(db_task, k, v)
    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int) -> bool:
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        return False
    db.delete(db_task)
    db.commit()
    return True
