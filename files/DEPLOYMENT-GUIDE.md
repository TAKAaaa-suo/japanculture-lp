# JapanCulture LP - デプロイメントガイド

**LP の実体はこのフォルダ（`LPsystem/files/`）です。** デプロイ時はこのフォルダを publish ディレクトリに指定してください。

## 📦 パッケージ内容

```
LPsystem/files/
├── index.html                    # メインLP（1ページスクロール）
├── how-it-works.html            # 使い方詳細ページ
├── shipping.html                # 送料詳細
├── fees.html                    # 料金詳細
├── faq.html                     # FAQ
├── css/
│   └── style.css               # メインスタイル（モバイルファースト）
├── js/
│   ├── config.js               # Tally設定ファイル
│   └── main.js                 # カウントダウン・スクロール・Request等
├── category/
│   ├── news.html               # ニュース一覧
│   ├── store-items.html        # 今週買える商品
│   ├── bonus-items.html        # 特典情報
│   └── weekly-pickups.html     # おすすめ
└── article/
    └── sample-item.html        # 記事サンプル（Request this item CTA付き）
```

## 🚀 実装状況

### ✅ 完成済み（すぐに使える）
- [x] index.html（全セクション）
- [x] css/style.css
- [x] js/config.js
- [x] js/main.js（カウントダウン＝木曜締切・Request・メニュー等）
- [x] how-it-works.html, shipping.html, fees.html, faq.html
- [x] category/ 全4ページ
- [x] article/sample-item.html

### ⚠️ 未作成（必要に応じて追加）
- [ ] terms.html（利用規約）
- [ ] privacy.html（プライバシーポリシー）

## 📋 セットアップ手順（5分）

### ステップ1: Tallyフォーム設定

1. [Tally.so](https://tally.so) でアカウント作成
2. 依頼フォームを作成（フィールド）：
   ```
   - Service Type（選択）: Standard / Rare / Event
   - Country（選択）: Singapore / USA / Australia
   - Shipping Address（テキスト・複数行）
   - Item Name（テキスト）
   - Preferred Store（テキスト）
   - Budget Limit（数値・任意）
   - Reference Photo（ファイル or URL）
   - Terms Agreement（チェックボックス）
   ```

3. Hidden Fieldsを追加：
   ```
   - item_name
   - item_url
   - ref
   ```

4. フォームURLをコピー（例：`https://tally.so/r/abc123`）

5. **`js/config.js`を編集：**
   ```javascript
   window.JC_CONFIG = { TALLY_FORM_URL: 'https://tally.so/r/abc123' };
   window.CONFIG = { TALLY_FORM_URL: 'https://tally.so/r/abc123', FORM_PARAMS: { item_name: 'item_name', item_url: 'item_url', ref: 'ref' } };
   ```

### ステップ2: ローカルテスト

```bash
# このフォルダ（LPsystem/files）で実行
cd LPsystem/files
python3 -m http.server 8000

# ブラウザで確認
http://localhost:8000
```

**チェック項目：**
- [ ] カウントダウンが動く
- [ ] Requestボタンを押すとTallyフォームが開く
- [ ] ヘッダーのリンクでスムーススクロール
- [ ] モバイル表示で崩れない

### ステップ3: デプロイ

#### A. Netlify（推奨・最も簡単）

```bash
# Netlify CLIインストール
npm install -g netlify-cli

# ログイン
netlify login

# デプロイ（LPsystem/files を指定）
cd LPsystem/files
netlify deploy --prod

# またはGUI: https://app.netlify.com
# → "Add new site" → "Deploy manually" → LPsystem/files フォルダをドラッグ
```

**設定：**
- Custom domain設定: `Settings > Domain management`
- SSL自動有効化

#### B. Vercel

```bash
# Vercel CLIインストール
npm install -g vercel

# デプロイ（LPsystem/files を指定）
cd LPsystem/files
vercel --prod
```

#### C. GitHub Pages

```bash
# リポジトリ作成
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/japanculture-lp.git
git push -u origin main

# Settings > Pages > Source: main branch
```

**URL例：** `https://YOUR_USERNAME.github.io/japanculture-lp/`

## 🔧 カスタマイズガイド

### カウントダウンの締切日を変更

注文締切は**木曜 23:59**。`js/main.js`の`getNextThursday()`で計算している。固定日時にしたい場合は `index.html` の countdown セクションに `data-deadline="2026-03-05T14:59:59Z"` のような ISO 日時を指定する。

### カラーテーマ変更

`css/style.css`のCSS Variables：

```css
:root {
    --color-primary: #ef4444;      /* 赤 → 好きな色に */
    --color-secondary: #f59e0b;    /* オレンジ */
    --color-success: #10b981;      /* 緑 */
}
```

### フォント変更

```css
:root {
    --font-display: 'Your Font', sans-serif;
    --font-body: 'Your Font', sans-serif;
}
```

Google Fontsを使う場合は`<head>`に追加：
```html
<link href="https://fonts.googleapis.com/css2?family=Your+Font&display=swap" rel="stylesheet">
```

## 📊 運用開始チェックリスト

### フェーズ0: 準備（公開前）

- [ ] Tallyフォーム作成・URL設定
- [ ] Airtableベース作成（依頼・見積・成約）
- [ ] Tally Webhook → Airtable連携
- [ ] PayPal / Stripe / Wise設定
- [ ] ドメイン取得（例：japanculture.com）
- [ ] メール送信元設定（orders@japanculture.com）

### フェーズ1: コンテンツ追加

- [ ] 実際の商品写真をRecent Purchasesに追加
- [ ] 実績数字を更新（購入数・満足度・実績年数）
- [ ] レビューを実顧客のものに差し替え
- [ ] Store calendarを今月の実際の予定に更新
- [ ] 利用規約・プライバシーポリシー作成
- [ ] FAQ詳細ページ作成
- [ ] Shipping詳細ページ作成
- [ ] Fees詳細ページ作成

### フェーズ2: 連携・計測

- [ ] Google Analytics 4設置
   ```html
   <!-- index.html の <head> に追加 -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'G-XXXXXXXXXX');
   </script>
   ```

- [ ] 自動返信メール設定（Tally完了後）
- [ ] 見積メールテンプレート作成
- [ ] 週次更新フロー確認（毎週日曜）

### フェーズ3: 公開

- [ ] 全ページをテスト環境で確認
- [ ] モバイル・タブレット・デスクトップで表示確認
- [ ] 全Requestボタンの動作確認
- [ ] カウントダウンの日時が正しいか確認
- [ ] SSL証明書が有効か確認
- [ ] 本番デプロイ
- [ ] 初回記事投稿

## 🎯 週次運用フロー

### 毎週日曜（情報更新日）

1. `index.html`の以下を更新：
   ```html
   <!-- Upcoming trip セクション -->
   <p class="upcoming-store">📍 【次週の店舗名】 • Tokyo</p>
   
   <!-- カウントダウン（jsで自動更新） -->
   
   <!-- Store calendar -->
   <div class="calendar-item active">
       <div class="calendar-date">Mar 8</div>
       <div class="calendar-store">【次週の店舗名】</div>
   </div>
   ```

2. Store Itemsカテゴリに新記事追加

3. Newsletter送信（購読者がいれば）

### 毎週金曜（Store Run日）

1. 店舗訪問・購入
2. 写真撮影・検品
3. 購入完了メール送信
4. Recent Purchasesセクション更新（任意）

### 月2回（発送日）

1. 保管中商品を梱包
2. 国際発送
3. 追跡番号メール送信

## 🐛 よくあるトラブル

### Requestボタンが動かない

**原因：** `js/config.js` の `TALLY_FORM_URL` が未設定のまま。

**解決：** `window.JC_CONFIG.TALLY_FORM_URL` と `window.CONFIG.TALLY_FORM_URL` を本番の Tally フォーム URL に設定する。

### カウントダウンが表示されない

**原因：** JavaScriptエラー

**解決：**
1. ブラウザのコンソールを開く（F12）
2. エラーメッセージを確認
3. `js/main.js`が正しく読み込まれているか確認

### スタイルが崩れる

**原因：** CSSファイルのパスが間違っている

**解決：**
```html
<!-- ルートディレクトリのページ -->
<link rel="stylesheet" href="css/style.css">

<!-- categoryフォルダ内のページ -->
<link rel="stylesheet" href="../css/style.css">
```

### モバイルで表示が崩れる

**原因：** viewportメタタグがない

**解決：**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

## 📞 次のステップ

1. **利用規約・プライバシーポリシー** - terms.html, privacy.html を必要に応じて作成
2. **実際のコンテンツに差し替え** - 写真・数字・レビュー
3. **Airtable連携** - Tally → Airtable → 見積メール自動化
4. **決済設定** - PayPal / Stripe / Wise
5. **運用開始** - 初回記事投稿・SNS告知

## 💡 ヒント

- **SEO対策**: 各ページの`<title>`と`<meta description>`を最適化
- **画像最適化**: 実際の商品写真は WebP 形式で軽量化
- **A/Bテスト**: Google Optimizeで異なるキャッチコピーをテスト
- **コンバージョン計測**: GAのイベントトラッキングでRequestボタンクリックを計測

---

## ✅ 実装チェックリスト（executeplan.md準拠）

### 🔴 Critical（必須）
- [x] Hero にペルソナ別メッセージング
- [x] 「参加権」コンセプト（Buy with us）
- [x] FOMO設計（緊急性バッジ・社会的証明・カウントダウン）
- [x] 送料訴求セクション（Save 66%・Before/After）
- [x] カウントダウン1秒更新

### 🟡 High Priority（強く推奨）
- [x] 信頼構築（実績数字・検品・返金保証・PayPal）
- [x] Standard / Rare / Event の違い明示
- [x] Which service do I need? フロー
- [x] モバイルファースト設計
- [x] Event 2週間前予約を強調

### 🟢 Medium Priority（検討推奨）
- [x] 4カテゴリの役割明示
- [x] FAQ戦略的配置
- [x] Before/After比較
- [x] Store visit calendar
- [x] Recent purchases showcase
- [x] Newsletter

---

**このLPで月間収益100万円目標は達成可能です！**

サポートが必要な場合はお気軽にお問い合わせください。
