# XP ゲージ可視化ツール（Twitch & YouTube 配信対応）

このツールは、Twitch または YouTube Live のチャットで
`xp14` や `xp30` などのコメントを受け取ると、
視聴者の名前・アイコンと一緒にゲージ上に表示する配信用ウィジェットです。

OBS のブラウザソースとして組み込めるように作られています。

---

## 🧹 機能一覧

- ✅ Twitch / YouTube のチャットメッセージ取得（WebSocket 対応）
- ✅ コメント内の `xp数値` をゲージとして画面に可視化
- ✅ 視聴者アイコン＋名前＋ XP 表示
- ✅ 表示アニメーション付き（ぴょんっ）
- ✅ XP 値に応じた色分け
- ✅ 重複表示の更新対応
- ✅ スプラトゥーン風の配信演出に最適

---

## 🛠 必要なもの

- Node.js v18 以上
- Twitch 開発者用クライアント ID & シークレット
- YouTube Data API v3（有効化済み）
- OBS（ブラウザソースが使える配信ソフト）

---

## 📁 フォルダ構成

```
project/
├── server.js           # WebSocketサーバーとチャット取得
├── .env.example        # 環境変数のテンプレ（APIキーは入っていません）
└── public/
    ├── index.html      # 表示用HTML
    ├── main.js         # フロントの表示ロジック
    └── style.css       # スタイルシート
```

---

## ⚙️ セットアップ方法

### ① リポジトリをクローン

```bash
git clone https://github.com/yourname/xp-gauge.git
cd xp-gauge
```

### ② 依存パッケージをインストール

```bash
npm install
```

### ③ `.env` を作成（`.env.example` をコピー）

```bash
cp .env.example .env
```

あなた自身の API キーやチャンネル ID、動画 ID を `.env` に記入してください。

---

## 🚀 起動と使用方法

```bash
node server.js
```

ブラウザで `http://localhost:3000` を開くか、
OBS のブラウザソースでその URL を指定してください。

---

## 📺 YouTube 連携の補足

`.env` の中で次のいずれかを指定することでチャット取得できます：

- `YOUTUBE_VIDEO_ID` → 限定公開などの動画 ID で直接取得
- `YOUTUBE_CHANNEL_ID` → 公開配信中の動画を自動検索
- `YOUTUBE_CHAT_ID` → fallback（どうしても使いたい場合）

---

## 📌 注意事項

- `.env` には機密情報が含まれるため **絶対に公開しないでください**
- このリポジトリには `.env` の内容は含まれていません（`.env.example` のみ提供）

---

## 📬 ご意見・フィードバック

不具合報告・改善提案・カスタマイズ希望など、お気軽に GitHub の Issue へどうぞ！
