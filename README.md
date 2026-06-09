# タスク管理アプリ

AIチャットで自然言語からタスクを操作できるタスク管理Webアプリです。

## 機能

- **カンバンボード** — ドラッグ＆ドロップでステータス変更（Todo / 進行中 / 待機中 / 完了）
- **フォーカスビュー** — 今日期限のタスクに絞って表示
- **カレンダービュー** — 期限日をカレンダーで確認
- **AIチャット** — 「明日までにAの資料作成を追加して」のような自然言語でタスク操作
- **ポモドーロタイマー** — タスクカードから直接起動
- **自動アーカイブ** — 完了から7日後に自動的にアーカイブ

## 技術スタック

| 層 | 技術 |
|----|------|
| フロントエンド | Next.js 16 + Tailwind CSS |
| バックエンド | FastAPI + SQLAlchemy |
| データベース | SQLite |
| AI | Groq API (llama-3.1-8b-instant) |
| Webサーバー | nginx |

## ローカルでの起動

### バックエンド

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

> **注意:** `.env` はリポジトリ外の `~/task-manager-backend/.env` に置く必要があります。
> 以下の内容で手動作成してください。
> ```
> GROQ_API_KEY=your_groq_api_key_here
> ```
> Groq API キーの取得: https://console.groq.com

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## デプロイ（AWS EC2）

```bash
# EC2 に SSH 後
cd ~/task-manager && git pull

# フロントエンドの更新
cd frontend && npm run build && pm2 restart task-manager-frontend

# バックエンドの更新
sudo systemctl restart task-manager-backend
```

## 詳細ドキュメント

コードの仕組みや設計については [DOCS.md](DOCS.md) を参照してください。
