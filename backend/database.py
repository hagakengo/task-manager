import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

# DB ファイルをスクリプトと同じディレクトリに置く。
# os.path.dirname(__file__) でこのファイルの場所を取得しているため、
# どのディレクトリから uvicorn を起動しても同じ場所に tasks.db が作られる。
DB_PATH = os.path.join(os.path.dirname(__file__), "tasks.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# check_same_thread=False は SQLite 固有の設定。
# デフォルトでは SQLite は「作成したスレッドからしかアクセスできない」制約があるが、
# FastAPI は非同期処理で複数スレッドからDBを呼ぶため、この制約を解除する必要がある。
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# autocommit=False: 明示的に commit() を呼ぶまで変更がDBに反映されない。
#   → 途中でエラーが起きたときに rollback できる。
# autoflush=False: commit 前に自動的に SQL が発行されない。
#   → 意図しないタイミングでクエリが走るのを防ぐ。
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(String)
    status = Column(String, nullable=False, default="todo")
    priority = Column(String, nullable=False, default="medium")
    due_date = Column(String)

    # server_default は Python ではなく SQLite 側で値をセットする。
    # text() でSQL式を直接渡すことで 'localtime' オプションを使い、
    # UTC ではなくサーバーのローカル時刻で記録される。
    created_at = Column(String, nullable=False, server_default=text("datetime('now', 'localtime')"))

    completed_at = Column(String)
    archived = Column(Boolean, nullable=False, default=False)


def get_db():
    # FastAPI の Depends() で使うジェネレーター関数。
    # yield でセッションを渡し、リクエスト処理が終わったら finally で必ずクローズする。
    # try/finally にすることで、エラーが起きても接続が解放される。
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Base を継承した全モデルのテーブルをDBに作成する。
    # 既存テーブルは変更しない（ALTER はしない）ため、カラム追加時は手動マイグレーションが必要。
    Base.metadata.create_all(bind=engine)
