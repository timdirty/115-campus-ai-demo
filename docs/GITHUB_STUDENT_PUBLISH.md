# GitHub 發布與學生操作指南

這個工作區可以推上 GitHub，讓學生下載或由老師部署成可操作的展示版。發布前請先跑：

```zsh
node scripts/competition-readiness-check.mjs
```

推上 GitHub 並等 Pages 部署完成後，再跑：

```zsh
CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs
```

## 可以公開的內容

- 三個 App 原始碼
- Arduino UNO R4 firmware
- `firebase-applet-config.json` 的公開佔位版
- `.env.example`
- `include/arduino_secrets.example.h`

## 不要公開的內容

- `node_modules/`
- `dist/`
- `.pio/`
- `.playwright-mcp/`
- `.env` 或 `.env.local`
- `include/arduino_secrets.h`
- 真 Firebase 專案設定或真 API key
- App 1 `data/*.json` 的現場展示資料

## 學生操作方式

三隊 App 都能在沒有 Gemini key、沒有 Firebase、沒有 Arduino 的狀態下操作主要流程。若老師先啟動 App 1 的 Node bridge，App 2、App 3 也會把硬體提示送到同一個 `http://localhost:3200` gateway；bridge 沒開時會顯示 fallback 紀錄，不會卡住學生操作。

### App 2 與 App 3

App 2、App 3 是 local-first 前端展示版，學生可各自在瀏覽器操作，資料存在自己的 localStorage。

```zsh
cd "google ai studio/app_2（國小）/校園服務機器人 app"
npm install
npm run dev

cd "google ai studio/app_3（國小）/AI校園心靈守護者"
npm install
npm run dev
```

如果部署到 Vercel、Netlify 或其他靜態前端平台，直接使用各 App 的 build output 即可。沒有 Arduino bridge 時，硬體提示會走 fallback，不影響學生操作主流程。

若要接同一台教室電腦上的 App 1 bridge，可在 `.env` 設定：

```zsh
VITE_ARDUINO_BRIDGE_URL="http://localhost:3200"
```

### App 1

App 1 需要 Node bridge 才有完整 API、JSON storage、Gemini fallback 與 Arduino gateway。

```zsh
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm install
npm run build
BRIDGE_PORT=3200 NODE_ENV=production npm run start
```

學生在同一台機器或同網路環境開：

```text
http://localhost:3200
```

## GitHub Actions

repo 內已加入 `.github/workflows/demo-check.yml`。推上 GitHub 後，每次 push / PR 都會檢查：

- GitHub 發布安全掃描
- App 1 `npm run check`
- App 2 `npm run check`
- App 3 `npm run check`
- bridge/firmware 指令表一致性
- Arduino UNO R4 firmware 編譯
- GitHub Pages deploy workflow 會另外檢查三個 App、三個講稿頁與入口連結是否都在部署包內
- 部署後可用 `scripts/public-url-check.mjs` 確認公開網址真的可讀

## 多人學生操作注意

目前三個 App 都適合比賽展示與學生單機操作。它們不是正式雲端多人系統：

- App 2、App 3 的資料各自存在學生瀏覽器。
- App 1 的 production bridge 使用本機 JSON storage。
- 若要全班共用同一份資料，需要再接後端資料庫與權限設計。

## Firebase 與 API key

App 3 repo 內的 `firebase-applet-config.json` 是公開 placeholder，讓專案可以乾淨 build。展示版不需要真 Firebase。未來若要接真 Firebase，請只放在本機 `.env` 或未提交的 local config，並先調整程式讀取方式；不要把真 Google API key 推上 GitHub。
