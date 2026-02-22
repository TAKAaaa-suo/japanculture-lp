# LP — このフォルダで完結

このフォルダ（`LPsystem/files/`）が LP のルートです。

## 構成

```
LPsystem/files/
├── index.html          # トップ（新デザイン）
├── how-it-works.html   # 固定ページ
├── shipping.html
├── fees.html
├── faq.html
├── css/
│   └── style.css       # 共通スタイル
├── js/
│   ├── config.js       # Tally URL 等（要設定）
│   └── main.js         # カウントダウン・Request・メニュー等
├── category/
│   ├── news.html
│   ├── store-items.html
│   ├── bonus-items.html
│   └── weekly-pickups.html
└── article/
    └── sample-item.html
```

## 見方

- **ローカルで確認**: このフォルダをドキュメントルートにしてサーバーを起動する  
  `python3 -m http.server 8765` を **LPsystem/files の直下で** 実行し、`http://localhost:8765/` で `index.html` を開く。
- **Tally**: `js/config.js` の `TALLY_FORM_URL` を本番フォームの URL に変更してください。

要件・デザインはプロジェクトの `docs/core/`（`docs/core/requirement.md`, `docs/core/design.md`）を参照。
