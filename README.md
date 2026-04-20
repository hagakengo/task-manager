# タスク管理アプリ

Python (FastAPI) + Next.js で構築したタスク管理アプリです。

## 起動方法

### バックエンド (Python / FastAPI)

```bash
cd task-manager/backend

# 仮想環境を作成（初回のみ）
python -m venv venv

# 仮想環境を有効化
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 依存パッケージをインストール（初回のみ）
pip install -r requirements.txt

# サーバー起動
uvicorn main:app --reload
```

→ http://localhost:8000 で起動  
→ API ドキュメント: http://localhost:8000/docs

---

### フロントエンド (Next.js)

```bash
cd task-manager/frontend

# 依存パッケージをインストール（初回のみ）
npm install

# 開発サーバー起動
npm run dev
```

→ http://localhost:3000 でアクセス

---

## 機能

- タスクの作成・編集・削除
- ステータス管理（未着手 / 進行中 / 完了）
- 優先度設定（高 / 中 / 低）
- 期限日設定・期限切れ表示
- カンバンボード形式のUI
