from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db
from schemas import TaskCreate, TaskUpdate, TaskResponse
import services

# prefix="/tasks" によりこのルーター内の全エンドポイントが /tasks 以下になる。
# tags=["tasks"] は FastAPI の自動生成ドキュメント（/docs）でのグループ名。
router = APIRouter(prefix="/tasks", tags=["tasks"])


# response_model=list[TaskResponse] を指定することで：
# 1. SQLAlchemy ORM オブジェクトを自動的に JSON に変換する。
# 2. レスポンスに含めたくないフィールド（将来的に追加した内部フィールドなど）を自動除外できる。
# 3. FastAPI の /docs にレスポンスの型が表示される。
@router.get("", response_model=list[TaskResponse])
def get_tasks(include_archived: bool = False, db: Session = Depends(get_db)):
    # クエリパラメータ ?include_archived=true を bool として受け取れる。
    # Depends(get_db) で DB セッションを依存性注入する（テスト時の差し替えも容易）。
    return services.get_all_tasks(db, include_archived=include_archived)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    result = services.get_task(db, task_id)
    if result is None:
        # FastAPI では HTTPException を raise するとそのままエラーレスポンスになる。
        # return ではなく raise することで、後続のコードが実行されない。
        raise HTTPException(status_code=404, detail="Task not found")
    return result


# status_code=201 を指定することで作成成功時に 200 ではなく 201 Created を返す。
# REST の慣習に沿った設計。
@router.post("", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    return services.create_task(db, task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    result = services.update_task(db, task_id, task)
    if result is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return result


# status_code=204 は「成功したがレスポンスボディなし」を意味する。
# DELETE の標準的なステータスコード。
@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    # services.delete_task は対象が存在しない場合に False を返す。
    if not services.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
