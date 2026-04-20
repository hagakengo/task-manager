import os
from sqlalchemy import create_engine, Column, Integer, String, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

DB_PATH = os.path.join(os.path.dirname(__file__), "tasks.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    created_at = Column(String, nullable=False, server_default=text("datetime('now', 'localtime')"))


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
