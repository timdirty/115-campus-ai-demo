# 協作開發完整指南

> 給新加入這個專案的開發者：照這份從頭到尾跑一次，30 分鐘上手，之後每天用 Part 3 的 SOP 開發。

Repo: <https://github.com/timdirty/115-campus-ai-demo>

---

## Part 0：你需要的東西

開始前先確認：

- 有 GitHub 帳號（沒有就到 <https://github.com> 註冊）
- 把你的 GitHub username / email 告訴 Tim，等 Tim 寄邀請
- 一台 Mac 或 Windows（本指南指令以 macOS / Linux 為主，Windows 改用 Git Bash 或 WSL）

---

## Part 1：環境準備（只做一次）

### 1.1 接受 GitHub 邀請

1. 收信箱會有一封「Tim invited you to collaborate on `timdirty/115-campus-ai-demo`」
2. 點 `View invitation` → `Accept invitation`
3. 沒接受的話你可以看 repo，但**不能 push**

### 1.2 安裝 Git

macOS：
```bash
# 用 Homebrew
brew install git

# 確認版本（>= 2.30 都可以）
git --version
```

Windows：到 <https://git-scm.com/download/win> 下載安裝，安裝時所有選項用預設即可，會附帶 Git Bash。

### 1.3 設定你的 Git 身份（重要）

這會出現在每次 commit 上，**用你 GitHub 註冊的 email**，這樣 commit 才會跟你的頭像綁定：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的GitHub email"

# 確認
git config --global --get user.name
git config --global --get user.email
```

### 1.4 認證 GitHub（讓你能 push）

GitHub 從 2021 開始不能用密碼 push，要用 **Personal Access Token (PAT)** 或 **SSH key**。**推薦用 PAT，新手最簡單。**

#### 方案 A：Personal Access Token（推薦）

1. GitHub 右上角頭像 → `Settings` → 最下面 `Developer settings` → `Personal access tokens` → `Tokens (classic)` → `Generate new token (classic)`
2. Note 填「dev laptop」之類的
3. Expiration 選 `90 days` 或 `No expiration`
4. Scopes 勾 `repo`（整個 repo 權限就好）
5. 按 `Generate token` → **複製那串 token，現在就存到密碼管理員**，關掉頁面就再也看不到

之後 `git push` 時：
- Username: 你的 GitHub username
- Password: **貼那串 token**（不是 GitHub 登入密碼）

macOS 會幫你存進 Keychain，之後不用再貼。

#### 方案 B：SSH key（進階）

```bash
ssh-keygen -t ed25519 -C "你的email"
# 一路按 Enter 就好
cat ~/.ssh/id_ed25519.pub
```

複製 `cat` 出來那一整行 → GitHub Settings → `SSH and GPG keys` → `New SSH key` → 貼上。

clone 時改用 `git@github.com:timdirty/115-campus-ai-demo.git` 而不是 `https://...`。

### 1.5 安裝開發工具

```bash
# Node.js 20+（用 nvm 管版本最方便）
brew install nvm
nvm install 20
nvm use 20
node --version  # 應該是 v20.x

# VS Code
brew install --cask visual-studio-code

# PlatformIO（Arduino 韌體開發用，做韌體才需要）
brew install platformio
pio --version
```

VS Code 安裝這些 extension：
- ESLint
- Prettier
- PlatformIO IDE（做韌體才裝）

---

## Part 2：第一次拿到專案

### 2.1 Clone 到本機

選一個你要放 code 的資料夾（例如 `~/code/`）：

```bash
mkdir -p ~/code && cd ~/code
git clone https://github.com/timdirty/115-campus-ai-demo.git
cd 115-campus-ai-demo
```

### 2.2 認識專案結構

這是一個 **monorepo**（一個 repo 裡放三個獨立 app）：

```
115-campus-ai-demo/
├── apps/
│   ├── app1-whiteboard/        # App 1：白板互動（含硬體 bridge）
│   ├── app2-campus-service/    # App 2：校園服務（含掃地機器人）
│   └── app3-guardian/          # App 3：守護者（含感測器 + 機器人）
├── firmware/                   # Arduino 韌體（PlatformIO）
│   ├── app1-whiteboard-drive/
│   ├── app2-sweeper-drive/
│   ├── app3-guardian-sensor/
│   └── app3-guardian-drive/
├── docs/                       # 文件（你正在讀的就在這）
├── platformio.ini              # 韌體編譯設定
├── CLAUDE.md                   # 給 AI 助手讀的（也可以人讀）
└── README.md                   # 專案總覽
```

**重點規則**：
- App 1 / 2 / 3 的改動**只動自己的 app 資料夾**
- 三個 app 是獨立的，A 動 app1 不會影響 app2

### 2.3 安裝依賴 + 試跑

```bash
# 根目錄
npm install

# 每個 app 也要各自裝
cd apps/app1-whiteboard && npm install && cd ../..
cd apps/app2-campus-service && npm install && cd ../..
cd apps/app3-guardian && npm install && cd ../..
```

跑起來看看：

```bash
# 跑 app1
cd apps/app1-whiteboard
npm run dev
# 通常會開 http://localhost:5173 之類的
```

### 2.4 跑不起來？

按順序試：

1. `node --version` 是不是 v20+？不是的話 `nvm install 20 && nvm use 20`
2. `npm install` 有沒有 error？有的話貼錯誤訊息問 Tim
3. port 被佔？換個 port 跑：`npm run dev -- --port 5174`
4. 缺 `.env`？檢查 app 資料夾有沒有 `.env.example`，複製成 `.env` 再填值；**沒有的話問 Tim 要**（**.env 永遠不能 commit**）

---

## Part 3：每日並行開發 SOP（**最重要，要背起來**）

並行開發 = 每人在**自己的 branch**做事，**永遠不要直接改 main**。`main` 是穩定線，動 main 要透過 Pull Request 合進去。

### 完整循環（每個任務都這樣跑）

```bash
# === 步驟 1：開工前同步最新 main ===
git checkout main
git pull origin main

# === 步驟 2：從最新 main 開 branch ===
git checkout -b feature/你的名字-你在做什麼
# 範例：
# git checkout -b feature/alex-app2-add-csv-export
# git checkout -b fix/alex-app1-camera-bug
# git checkout -b docs/alex-update-readme

# === 步驟 3：改檔案 ===
# 用 VS Code 改、加新檔、刪舊檔...

# === 步驟 4：看你改了什麼 ===
git status              # 看哪些檔被改/新增
git diff                # 看具體改了什麼內容

# === 步驟 5：commit ===
git add <你要 commit 的檔>
# 或一次加全部已改的：
git add -A

git commit -m "feat(app2): add CSV export for attendance"
#                ^^^^^^^^^   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                type(scope) 描述（用英文或中文都可，但要具體）

# 一個 branch 可以 commit 很多次，commit 小一點比較好

# === 步驟 6：推到 GitHub ===
git push -u origin feature/alex-app2-add-csv-export
# 第一次推用 -u，之後同 branch 直接 git push 就好

# === 步驟 7：開 Pull Request ===
# 推完 GitHub 會回一個連結，點開就能建 PR
# 或到 https://github.com/timdirty/115-campus-ai-demo/pulls 按 New pull request
#
# PR 標題：跟 commit message 類似，講清楚做了什麼
# PR description：
#   - 做了什麼
#   - 為什麼這樣做
#   - 怎麼測試（reviewer 要怎麼驗）
#   - 截圖（如果是 UI 改動）
#
# 右側 Reviewers 指派 Tim（或對應的人）

# === 步驟 8：等 review ===
# Tim 在 PR 上留 comment
# 你看到 comment → 在 local 改 → 再 commit + push
# push 會自動更新 PR，不用重開
git add -A
git commit -m "address review comments"
git push

# === 步驟 9：所有 comment 都解掉 + Tim 按 Approve ===
# 點 PR 頁面的 `Merge pull request` → `Confirm merge`
# 通常用 `Squash and merge`（把多個 commit 壓成一個進 main，歷史乾淨）

# === 步驟 10：合完之後 ===
git checkout main
git pull origin main                                  # 把剛剛合進去的拉下來
git branch -d feature/alex-app2-add-csv-export        # 刪掉本地舊 branch

# → 開下個任務，回步驟 1
```

### Commit message 怎麼寫

**爛的**：
- `update`
- `fix bug`
- `改了一些東西`

**好的**（用 [Conventional Commits](https://www.conventionalcommits.org/) 格式）：

```
<type>(<scope>): <短描述>

[詳細說明，可選]
```

`type` 常用：
- `feat`: 新功能
- `fix`: 修 bug
- `docs`: 改文件
- `refactor`: 重構（功能不變）
- `test`: 加測試
- `chore`: 雜事（升版號、改 config）

`scope` 用 app 名或模組名：

```
feat(app1): add laser pointer detection
fix(app2): bridge IP not detected on iPad
docs(collab): add onboarding guide
refactor(app3): split sensor reader into its own module
chore(deps): bump vite from 5.0 to 5.1
```

### Branch 命名規則

`<type>/<你的名字>-<短描述>`

範例：
- `feature/alex-app2-add-csv-export`
- `fix/alex-bridge-ip-detect`
- `docs/alex-update-readme`
- `experiment/alex-try-new-camera-lib`（實驗用，可能不會合）

---

## Part 4：分工守則（避免兩人打架）

### 4.1 按 app 分工最安全

- Tim 改 app1，你改 app2 → 幾乎不會撞
- 兩人都改 app1 → 講好誰改哪幾個檔

### 4.2 改這些檔案前一定要喊一聲

這些是「shared 檔案」，兩人同時改一定 conflict：

- 根目錄 `package.json` / `package-lock.json`
- `platformio.ini`
- `CLAUDE.md` / `AGENTS.md` / `README.md`
- `docs/SHARED_AGENT_CORE.md`
- `.gitignore`

動之前在群組講一下「我要改 X 檔，10 分鐘」，避免撞車。

### 4.3 Branch 不要拖

- branch 開了**最多 2-3 天就要合**，不要拖一週
- 越久越容易跟 main 衝突
- 如果一個任務做不完，**分批合**（每天合一小塊）

### 4.4 每天上工先 pull

```bash
git checkout main
git pull origin main
```

不 pull 就開 branch → 你的 branch 起點是舊的 → 越改越偏離 main → 合的時候 conflict 爆炸。

---

## Part 5：衝突來了怎麼辦

### 5.1 Conflict 長什麼樣

當兩人改到同一個檔的同一行，git 不知道要留誰的，會在檔案裡塞這種標記：

```
<<<<<<< HEAD
你 branch 的版本
=======
main 的版本
>>>>>>> main
```

### 5.2 解 conflict 步驟

假設你在 `feature/alex-xxx` 要合進 main，但 main 已經有新東西：

```bash
# 1. 先同步 main
git checkout main
git pull origin main

# 2. 切回你的 branch，把 main 合進來
git checkout feature/alex-xxx
git merge main

# 3. 如果跳出 CONFLICT，git 會告訴你哪些檔有衝突
# 用 VS Code 開那個檔，VS Code 會標出 <<<<<<< ======= >>>>>>>
# 三個按鈕：Accept Current（留你的）/ Accept Incoming（留 main 的）/ Accept Both
# 通常要手動編輯，**保留正確邏輯**，不是無腦選一邊

# 4. 解完每個衝突檔後
git add <解完的檔>

# 5. 全部解完
git commit                # 不用打 message，會自動帶 merge commit
git push                  # 推上去，PR 自動更新
```

### 5.3 真的搞砸了想救回來

```bash
# 不確定剛剛做了什麼、想取消 merge
git merge --abort

# 改壞了想丟掉所有未 commit 的改動（你還沒 commit 的東西會永久丟掉，謹慎）
git checkout .

# 想看歷史上某個版本
git log --oneline -20         # 看最近 20 個 commit
git show <commit hash>        # 看那個 commit 改了什麼

# 救回不小心刪掉的 branch（git 90 天內都記得）
git reflog                    # 看你最近做過的所有操作
git checkout -b 救回來的branch <reflog 顯示的 hash>
```

**完全不知道怎麼辦時**：先 **不要做任何事**，截圖你看到的訊息傳給 Tim，比亂下指令安全。

---

## Part 6：常見地雷（每條都會害你掉血）

| 地雷 | 後果 | 預防 |
|---|---|---|
| commit `.env` / API key | key 被全世界看到 → 被盜刷 | commit 前 `git status` 掃一眼，看到 `.env` 立刻 `git restore --staged .env` |
| commit `node_modules/` | repo 變幾 GB | 別碰 `.gitignore` 裡 `node_modules` 的規則 |
| commit 一大堆截圖 / 暫存檔 | repo 亂 | 圖片放 `docs/competition/assets/` 之類有意義的位置；隨手截圖刪掉就好 |
| 直接在 main 改 | 跟同事打架 | 永遠 `git checkout -b feature/...` 開 branch |
| 用 `git push --force` | 同事的 commit 被洗掉 | **永遠不要對 main 用 force**；自己 branch 真的要 rebase 用 `--force-with-lease` |
| branch 拖兩週才合 | conflict 大到無法解 | 每 1-2 天合一次 |
| `git commit -am "update"` | 兩個月後看不懂自己 commit | 寫 `fix(app2): bridge IP detection broken on Safari` |
| 在 GitHub 網頁直接編輯 main | 跳過 PR、跳過 review | 設了 branch protection 就改不了，沒設的話**手動忍住** |
| 沒 pull 就開新 branch | 起點是舊版 main，conflict 機率爆增 | SOP 步驟 1 永遠先 `git pull` |
| 把整個 `dist/` / `build/` 推上去 | repo 變肥、編譯產物不需要進 git | `.gitignore` 已擋，別手動 `git add -f` 加 |

---

## Part 7：常用指令速查

```bash
# === 看狀態 ===
git status                      # 我改了哪些檔
git diff                        # 改的內容
git diff --staged               # 已 staged 但未 commit 的內容
git log --oneline -10           # 最近 10 個 commit
git log --graph --oneline -20   # 圖形化看分支歷史

# === Branch ===
git branch                      # 我有哪些本地 branch
git branch -r                   # remote 上有哪些 branch
git checkout -b xxx             # 開新 branch 並切過去
git checkout main               # 切回 main
git branch -d xxx               # 刪本地 branch（已合併才能刪）
git branch -D xxx               # 強制刪本地 branch（沒合也刪，謹慎）
git push origin --delete xxx    # 刪 remote 的 branch

# === 同步 ===
git fetch                       # 拉 remote 資訊但不合併（看一下）
git pull                        # 拉 remote 並合進當前 branch
git pull --rebase               # 拉並 rebase（歷史比較乾淨，但新手先用一般 pull）

# === 改檔 ===
git add <檔>                    # stage 單一檔
git add -A                      # stage 全部
git restore --staged <檔>       # 把已 stage 的取消（unstage）
git restore <檔>                # 丟掉未 commit 的改動（謹慎）
git commit -m "..."             # commit
git commit --amend              # 改最近一個 commit（push 過就不要 amend）

# === 推 ===
git push                        # 推到當前 branch 的 remote
git push -u origin xxx          # 第一次推某 branch，設 upstream

# === 救援 ===
git merge --abort               # 取消正在進行的 merge
git rebase --abort              # 取消正在進行的 rebase
git reflog                      # 看所有操作歷史（救回誤刪 branch 用）
git stash                       # 暫存目前未 commit 的改動
git stash pop                   # 把暫存的拿回來
```

---

## Part 8：FAQ

**Q1：我可以直接在 GitHub 網頁編輯檔案嗎？**
> 可以，但**跳過了 PR review**，team 工作應該避免。緊急修小 typo 例外。

**Q2：PR 上 Tim 留了 10 個 comment，全部都要解嗎？**
> 是。每個 comment 要嘛改、要嘛回覆解釋為什麼不改，**全部 resolve** 才能合。

**Q3：我推到自己 branch 的東西寫錯了，可以改嗎？**
> 可以。直接在 local 再改、再 commit、再 push 就好。同個 branch 的 PR 會自動更新。**已合進 main 的不要 amend**，再開新 PR 修。

**Q4：什麼時候用 `Squash and merge` vs `Rebase and merge` vs `Create a merge commit`？**
> 預設用 **Squash and merge**：把 PR 裡多個 commit 壓成一個進 main，main 歷史乾淨。除非 Tim 特別說，都用這個。

**Q5：我可以開 PR 但還沒做完嗎？**
> 可以，叫 **Draft PR**。建 PR 時下拉選 `Create draft pull request`。做完按 `Ready for review`。

**Q6：CI 紅了（PR 頁面有紅叉）怎麼辦？**
> 點紅叉 → 看 log → 通常是 lint / test / build 失敗。在 local 跑 `npm run build` / `npm run check` 重現，修完再 push。**CI 沒綠不能合。**

**Q7：我不想用 CLI，可以用 GUI 嗎？**
> 可以，推薦：
> - [GitHub Desktop](https://desktop.github.com/)（最簡單）
> - [Sourcetree](https://www.sourcetreeapp.com/)（功能多）
> - VS Code 內建的 Source Control 面板（最輕量）
>
> 但**指令還是要看得懂**，出問題的時候 GUI 救不了你。

**Q8：commit 寫錯字了想改最近一次 commit message？**
> ```bash
> git commit --amend -m "新的 message"
> # 如果還沒 push，直接改就好
> # 已經 push 但只有你自己的 branch：git push --force-with-lease
> # 已經 push 到 main：算了，再開新 commit 解釋就好，不要 force main
> ```

**Q9：我搞不清楚現在在哪個 branch？**
> ```bash
> git branch        # * 那個就是當前 branch
> git status        # 第一行會說 On branch xxx
> ```

**Q10：我需要每天看 main 的更新嗎？**
> 至少**開工時 pull 一次**。如果有人通知「我合了一個 PR」，pull 一下看看影不影響你正在做的東西。

---

## Part 9：這個專案的特殊規則

讀完 Git 流程後，**這幾份必讀**：

- [`README.md`](../README.md) — 專案總覽
- [`CLAUDE.md`](../CLAUDE.md) — 專案規則（給人也給 AI 看）
- [`docs/SHARED_AGENT_CORE.md`](SHARED_AGENT_CORE.md) — 三 app 工作守則
- [`docs/FIRMWARE_ENV_MAP.md`](FIRMWARE_ENV_MAP.md) — 韌體環境對應表（做韌體才需要）
- [`docs/AGENT_INTEROP.md`](AGENT_INTEROP.md) — Claude / Codex 協同規則

**關鍵守則**：
1. App 1 / 2 / 3 的改動**只動自己的 app 資料夾**
2. `platformio.ini` 改之前先講
3. Firebase / Arduino secret **絕對不能 commit**
4. 韌體 commit 前先確認 `pio run -e <對應 env>` 可以 build
5. UI 改動 commit 前跑 `npm run verify:ui`（有此 script 的 app 才跑）

---

## Part 10：第一個任務建議

讀完這份後，**先做一個小任務練手**：

1. 開個 branch `docs/<你的名字>-fix-typo`
2. 在這份文件或 README 改一個 typo
3. commit + push + 開 PR
4. 等 Tim review + merge

跑完一輪就熟悉整個流程了。**真的開發再從 issue / 任務清單拿任務。**

---

## 求救管道

- 卡住 30 分鐘解不出來 → 直接問 Tim
- Git 操作不確定 → **先不要動**，截圖傳出來問
- 文件有錯 / 看不懂 → 開 issue 或直接改這份檔案發 PR

歡迎加入。
