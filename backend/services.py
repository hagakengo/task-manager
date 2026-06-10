from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import Task
from schemas import TaskCreate, TaskUpdate

# マジックナンバーを定数化することで、数字の意味が伝わり変更も一箇所で済む。
ARCHIVE_AFTER_DAYS = 7


def auto_archive(db: Session) -> None:
    """
    完了から一定日数が経過したタスクを自動的にアーカイブする。

    【遅延アーカイブという設計選択】
    定期実行ジョブ（cron）ではなく、タスク一覧の取得リクエスト時に呼ぶ方式を採用している。
    理由：
    - cron を動かすにはサーバー設定が必要でデプロイが複雑になる。
    - このアプリの規模では「タスク一覧を取得したときに都度処理する」で十分。
    - ユーザーがアプリを開いたタイミングで自動整理されるのでUX上も自然。

    【文字列比較で日時を比較できる理由】
    completed_at は "YYYY-MM-DD HH:MM:SS" 形式で保存されている。
    この形式は辞書順 = 時系列順なので、文字列の <= 比較がそのまま日時比較として機能する。
    """
    threshold = (datetime.now() - timedelta(days=ARCHIVE_AFTER_DAYS)).strftime("%Y-%m-%d %H:%M:%S")
    db.query(Task).filter(
        Task.status == "done",
        Task.archived == False,
        Task.completed_at != None,   # completed_at が NULL のタスクは対象外
        Task.completed_at <= threshold,
    ).update({"archived": True})
    db.commit()


def get_all_tasks(db: Session, include_archived: bool = False) -> list[Task]:
    # リクエストのたびに auto_archive を呼ぶことで「遅延アーカイブ」を実現する。
    auto_archive(db)
    q = db.query(Task)
    if not include_archived:
        q = q.filter(Task.archived == False)
    # 作成日時の降順（新しい順）で返す。
    return q.order_by(Task.created_at.desc()).all()


def get_task(db: Session, task_id: int) -> Task | None:
    # .first() は結果がなければ None を返す。.one() は存在を保証するが例外を出す。
    # None チェックは呼び出し元（routers/tasks.py）で行う。
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
    # commit 後に refresh しないと、SQLite が自動採番した id や
    # server_default で設定した created_at が Python オブジェクトに反映されない。
    db.refresh(db_task)
    return db_task


def update_task(db: Session, task_id: int, task: TaskUpdate) -> Task | None:
    db_task = db.query(Task).filter(Task.id == task_id).first()
    if not db_task:
        return None

    # exclude_none=True で、リクエストに含まれなかった（None のままの）フィールドを除外する。
    # これにより「送られたフィールドだけを上書き」する部分更新が実現できる。
    data = task.model_dump(exclude_none=True)

    # ステータスが done に変わった瞬間だけ completed_at を記録する。
    # 「すでに done → done」の場合は上書きしない（初回完了日時を保持するため）。
    if data.get("status") == "done" and db_task.status != "done":
        data["completed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # done から他のステータスに戻したときは completed_at をリセットする。
    # 再完了したときに正しい完了日時が記録されるようにするため。
    elif data.get("status") and data["status"] != "done":
        data["completed_at"] = None

    # setattr でフィールドを動的に上書きする。
    # data のキーは TaskUpdate のフィールド名と一致しているため安全に使える。
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
    # 成否を bool で返すことで、呼び出し元がタスクの存在チェックを別途しなくて済む。
    return True
