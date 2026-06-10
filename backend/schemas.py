from pydantic import BaseModel
from typing import Optional


# TaskCreate と TaskUpdate を分けている理由：
# - 作成時は title が必須だが、更新時は変更したいフィールドだけ送れば良い。
# - 同じモデルにすると「更新時に title が省略できない」という問題が起きる。
# - これは REST API の設計上のベストプラクティス（POST と PUT で異なる型を使う）。

class TaskCreate(BaseModel):
    # title のみ必須。他はデフォルト値を持つので省略可能。
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    # 全フィールドが Optional。
    # model_dump(exclude_none=True) と組み合わせることで、
    # 送られてきたフィールドだけを更新できる（部分更新 = PATCH 的な動作）。
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None


class TaskResponse(BaseModel):
    # from_attributes=True（旧: orm_mode=True）を設定することで、
    # SQLAlchemy の ORM オブジェクト（dict ではなく属性アクセス形式）を
    # Pydantic モデルに自動変換できる。
    # これがないと services.py で返した Task オブジェクトをそのままレスポンスにできない。
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    due_date: Optional[str]
    created_at: str
    completed_at: Optional[str] = None
    archived: bool = False
