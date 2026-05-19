---
name: app2-test
description: 一鍵啟動 App2 校園服務機器人本機測試（VITE_AI_PROXY_DISABLED=1 模擬 GH Pages 直連 Gemini）。當使用者說「app2 測試」「啟動 app2」「測 teach」「測 AI」時使用。
---

# App2 本機 GH Pages 模擬測試

模擬 GitHub Pages 環境（`VITE_AI_PROXY_DISABLED=1`）在本機跑 App2，驗證直連 Gemini API 路徑是否正常。

## 步驟

### 1. 確認工作目錄

```bash
ls apps/app2-campus-service/package.json 2>/dev/null && echo "OK" || echo "請先 cd 到 repo root"
```

若輸出不是 OK，停下並告知使用者。

### 2. 確認 `.env.local` 有 API key

```bash
grep -s "VITE_GEMINI_API_KEY" apps/app2-campus-service/.env.local 2>/dev/null && echo "KEY_FOUND" || echo "KEY_MISSING"
```

若輸出 `KEY_MISSING`：
- 建立 `.env.local`：

```bash
cat > apps/app2-campus-service/.env.local << 'EOF'
VITE_AI_PROXY_DISABLED=1
VITE_GEMINI_API_KEY=請填入你的Gemini_API_Key
EOF
```

然後**停下**，告訴使用者：「請編輯 `apps/app2-campus-service/.env.local`，把 `VITE_GEMINI_API_KEY` 後面換成真實的 key，然後再呼叫 `/app2-test`。」

若輸出 `KEY_FOUND`，確認 `VITE_AI_PROXY_DISABLED=1` 也有設：

```bash
grep -s "VITE_AI_PROXY_DISABLED" apps/app2-campus-service/.env.local || echo "VITE_AI_PROXY_DISABLED=1" >> apps/app2-campus-service/.env.local
```

### 3. 停掉佔用 5173 的舊 server

```bash
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
```

### 4. 啟動 dev server（背景）

```bash
cd apps/app2-campus-service && nohup npm run dev > /tmp/app2-dev.log 2>&1 &
echo $! > /tmp/app2-dev.pid
echo "啟動中..."
```

### 5. 等待 Vite 就緒

```bash
for i in $(seq 1 20); do
  grep -q "Local:" /tmp/app2-dev.log 2>/dev/null && break
  sleep 1
done
grep "Local:" /tmp/app2-dev.log 2>/dev/null || echo "（等待中，請稍後）"
```

### 6. 報告測試網址

告訴使用者：

```
✅ App2 dev server 已啟動（GH Pages 模擬模式）

測試項目：
1. 點名掃描（修復重點）
   → http://localhost:5173/#teach
   → 點「AI 場域點名」→ 允許攝影機 → 應顯示出席人數，不出現「無法連接 AI 服務」

2. Live Camera 場景辨識
   → http://localhost:5173/#delivery
   → 開啟攝影機 → 場景標籤應顯示 Gemini 辨識結果

3. 生活服務視覺分析
   → http://localhost:5173/#life
   → 同上

測試完畢請說「push」我幫你推上 GitHub。
```

### 錯誤排查

若仍出現 CORS / 連線錯誤：

```bash
grep "VITE_AI_PROXY_DISABLED\|VITE_GEMINI" apps/app2-campus-service/.env.local
```

確認兩個變數都存在且值正確。

若出現 `API key not valid`：key 本身有問題，確認是否正確複製且未過期。
