from dotenv import load_dotenv
import os

# .env の読み込みは他のモジュールより先に行う必要がある。
# FastAPI や各ルーターのインポート時に os.environ を参照するケースがあるため、
# ファイル冒頭で確実にセットしておく。
# os.path.expanduser で ~/... を絶対パスに展開している。
# .env はGit管理外のため EC2 上で手動作成・管理する運用になっている。
load_dotenv(dotenv_path=os.path.expanduser("~/task-manager-backend/.env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import tasks
from routers import chat

app = FastAPI(title="Task Manager API")

# CORS（Cross-Origin Resource Sharing）の設定。
# ブラウザはセキュリティ上、異なるオリジンへのリクエストをデフォルトでブロックする。
# フロントエンド（:3000）からバックエンド（:8000）へ通信するために必要。
#
# allow_origins にワイルドカード（*）を使わず IP を明記しているのは、
# allow_credentials=True と * は組み合わせられないブラウザ仕様があるため。
# （Cookie や認証ヘッダーを将来使うことも想定した設計）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://18.181.247.4:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# アプリ起動時にDBテーブルを自動作成する。
# SQLAlchemy の create_all はテーブルが既存の場合はスキップするため冪等（何度呼んでも安全）。
init_db()

# ルーターを登録することで各ファイルのエンドポイントがアプリに追加される。
# tasks.router は prefix="/tasks" を内部に持つのでそのまま登録。
# chat.router には prefix="/api" を追加して /api/chat にする。
app.include_router(tasks.router)
app.include_router(chat.router, prefix="/api")
