# タスク管理アプリ - バックエンド

FastAPI + SQLite によるタスク管理 API サーバー。

## 構成

```
task-manager-backend/
├── main.py          # エントリーポイント
├── database.py      # DB設定・モデル
├── schemas.py       # Pydanticスキーマ
├── services.py      # ビジネスロジック
├── routers/
│   ├── tasks.py     # タスクCRUD API
│   └── chat.py      # AIチャット API (Groq)
├── requirements.txt
├── .env             # APIキー（Gitに含めない）
├── tasks.db         # SQLiteデータベース
└── venv/            # 仮想環境
```

## セットアップ

```bash
cd ~/task-manager-backend

# 仮想環境作成（初回のみ）
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

## 環境変数

`.env` ファイルに以下を記載:

```
GROQ_API_KEY=your_groq_api_key_here
```

Groq API キーの取得: https://console.groq.com

## 起動

```bash
cd ~/task-manager-backend
venv/bin/uvicorn main:app --reload --port 8000
```

サーバーは http://localhost:8000 で起動します。

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/tasks | タスク一覧取得 |
| POST | /api/tasks | タスク作成 |
| PUT | /api/tasks/{id} | タスク更新 |
| DELETE | /api/tasks/{id} | タスク削除 |
| POST | /api/chat | AIチャット（自然言語でタスク操作） |

## タスクのステータス

| 値 | 説明 |
|----|------|
| `todo` | 未着手 |
| `in-progress` | 進行中 |
| `done` | 完了 |
| `waiting` | 回答待ち（確認依頼・問い合わせ中） |

## AIチャット機能

自然言語でタスクを操作できます。Groq API（llama-3.1-8b-instant）を使用。

**例:**
- 「設計書のレビューを来週金曜までに追加して」→ タスク作成
- 「メーカーへの見積依頼」→ status:waiting でタスク作成
- 「設計書レビュー完了した」→ タスクを完了に更新
- 「今日期限のタスクは？」→ 一覧回答（タスク操作なし）
