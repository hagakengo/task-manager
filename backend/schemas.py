from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    created_at: str
