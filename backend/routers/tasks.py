from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas import TaskCreate, TaskUpdate, TaskResponse
import services

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return services.get_all_tasks(db)


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    return services.create_task(db, task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    result = services.update_task(db, task_id, task)
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not services.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
