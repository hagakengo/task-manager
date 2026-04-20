from sqlalchemy.orm import Session
from database import Task
from schemas import TaskCreate, TaskUpdate


def get_all_tasks(db: Session) -> list[Task]:
    return db.query(Task).order_by(Task.created_at.desc()).all()


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
    for k, v in task.model_dump(exclude_none=True).items():
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
