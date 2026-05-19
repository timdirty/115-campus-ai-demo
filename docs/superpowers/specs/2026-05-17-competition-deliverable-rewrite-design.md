# 三隊作品說明書重製設計 spec

**日期**：2026-05-17
**任務類型**：交付物（docx）重製
**對象**：臺北市 114 年度中小學資通訊應用大賽 - 智組型機器人創意賽
**緊急程度**：高（評審已點名「不要假圖」，5/25 決賽）

## 目標

三隊（App1 / App2 / App3）的初版作品說明書 docx 全面重製，達成：

1. **移除所有 AI 生成 / 不相干假圖**（評審指名問題）
2. **硬體規格改寫**：從錯誤的 LEGO EV3 規格改為實際的 Arduino Uno R4 + L293D + TT motor + 3D 列印
3. **內容對齊真實成果**：demo 站 SPA、Scratch 藍圖（Notion）、Mermaid 流程圖
4. **同套封面模板**：三隊識別度一致、評審能看出系列性
5. **符合 Notion 三條規則**：
   - 圖風格繁中、學生手繪 / 工程草圖風（不可 AI 商業插圖）
   - 不露校名 / 校徽 / 制服 / 走廊地磚 / 招牌
   - 圖與 demo 動作必須圍繞作品主題

## 三隊基本資料對齊

| 項目 | App1 國 | App2 品 | App3 印 |
|---|---|---|---|
| 學層別 | ☑ 國小 | ☑ 國小 | ☑ 國中 |
| 作品名稱 | AI 智慧型白板機器人 | （需確認，建議：校園 AI 多功能服務機器人） | AI 校園心靈守護者（建議改用 Notion 標題，原 docx 寫「AI 學校情緒檢測裝置」） |
| 關鍵詞 | LLM、語音辨識、手寫辨識與姿態辨識 | 配送系統、AI 技術、避障技術 | AI 情緒辨識、智慧校園、預警系統 |
| 編號 | （承辦單位填） | （承辦單位填） | （承辦單位填） |

## 硬體規格（覆蓋原 EV3 內容）

### 共通硬體
- Arduino Uno R4 WiFi 或 Uno R4 Minima
- L293D 馬達驅動板（雙 H-Bridge）
- TT 馬達（黃色直流減速馬達）
- 3D 列印外殼（PLA 列印，學生用 Fusion 360 / Tinkercad 自行設計，STL 存證在 Notion）
- 杜邦線 / 麵包板 / 鋰電池或行動電源

### App1 額外
- 板擦臂結構（伺服機 + 3D 列印手臂）
- 攝影機（拍照保存板書，配 Web AI OCR）
- LED 矩陣（顯示完成動畫 / 煙火）

### App2 額外
- 四輪驅動（M1+M2 輪子 / M3+M4 掃地滾輪）
- 太陽能板（綠能驗證 / 部分輔助電源）
- 超音波感測器（避障）
- 顏色感測器（循線 / 區域辨識）
- 載物托盤
- 麥克風 + 喇叭（語音問答）

### App3 額外
- HY-M302 九合一感測擴充板
- DHT11（溫濕度）
- 光敏電阻
- RGB LED（風險燈號：綠 / 黃 / 紅）
- 麥克風（語音語氣分析）
- 四輪驅動（M1+M4 左 / M2+M3 右，可巡邏）

## 軟體規格

| 軟體 | App1 | App2 | App3 |
|---|---|---|---|
| Scratch 3.0 | ✅ 原型驗證 | ✅ 多機派遣邏輯 | ✅ 風險分級模擬 |
| Arduino IDE / PlatformIO | ✅ Uno R4 韌體 | ✅ Uno R4 韌體 | ✅ Uno R4 韌體 |
| Web App（React + Node） | ✅ 老師擦板 App | ✅ 派遣儀表板 | ✅ 老師關懷 App |
| Gemini AI / LLM | ✅ 手寫 OCR / 板書 Q&A | ✅ 學生課業問答 | ✅ 情緒分析 + 關懷建議 |
| Firebase / 雲端 | ✅ 板書快照儲存 | ✅ 任務報告 | ✅ 風險警示同步 |
| Fusion 360 / Tinkercad | ✅ 3D 列印設計 | ✅ 3D 列印設計 | ✅ 3D 列印設計 |

**全面移除**：EV3 主機、LEGO Studio 2.0、EV3 Program、Spike、樂高積木、樂高輪子、洞棍、齒輪（樂高的）、Google Stitch（保留 Scratch logo 但用真實 logo 不要 AI 卡通版）

## 三份 docx 統一架構

維持競賽要求的標準骨架，但內容全面重寫：

```
封面（同模板）
摘要（300 字以內）
甲、創作動機
乙、創作目的
丙、設備及器具（含 3D 列印 + Arduino 規格表）
丁、創作的過程（含設計思維表 + Mermaid 流程圖）
戊、創作結果
  ├─ 模型設計（3D 列印外殼 + 接線 + 實機照）
  ├─ APP 設計（真實 demo 站截圖 + Scratch 藍圖）
  ├─ 系統流程圖（Mermaid 渲染）
  └─ 系統架構圖（Mermaid 渲染）
己、討論（結論）
庚、參考資料及其他附件
```

## 封面模板（三隊共用）

**版型**：A4 直、純 typography + 一張主視覺
- **頂端**：「臺北市 114 年度中小學資通訊應用大賽」「智組型機器人創意賽作品說明書」（黑色細明體 / 等線）
- **學層別 + 編號欄**：標準格式（含勾選方塊）
- **主視覺區（中央 16:9）**：放 demo 站 hero 截圖或實機照拼貼
  - App1 → demo 站 app1 首頁 hero
  - App2 → demo 站 app2 派遣 dashboard
  - App3 → demo 站 app3 三層架構畫面
- **作品名稱**：大號粗體繁中
- **關鍵詞**：副標小字
- **底部 footer**：作品編號 + 隊伍識別小色塊（App1 橘 / App2 綠 / App3 紫，對應 Notion callout 色）

**禁止**：卡通插畫、AI 生成機器人、學生卡通圖、虛構教室場景

## 圖片來源優先序與生圖規則

### ✅ 可以用 AI 生圖的類型（鼓勵最佳化）
- **流程圖 / 狀態圖 / 操作流程圖**：Mermaid 程式碼 → PNG（美化、加色彩、加 icon）
- **系統架構圖 / 三層架構圖**：可用 draw.io 風格、可用 AI 生成概念示意（標明「概念示意圖」）
- **心智圖 / 功能分類圖 / 設計思維圖**：可生
- **章節分隔卡 / 標題視覺 / banner 圖**：可生（抽象幾何 / 漸層 / icon 拼貼）
- **使用情境想像圖**：可生（但必須標明「設計願景示意，非實機」）
- **3D 列印 STL 等角投影**：用 trimesh/blender 渲染（屬於真實設計圖、可放）

### ❌ 絕對不可 AI 生圖的類型（必留占位符）
- **機器人實機照**（必須是真實拍攝的 Arduino + L293D + TT motor + 3D 列印外殼）
- **3D 列印實物照**（必須真實列印出來的零件）
- **接線完成照**（必須真實接線特寫）
- **demo 現場照 / 使用照**（必須真實場景）
- **學生實作過程照**（必須真實學生操作）

### 圖片來源優先序
1. **真實 demo 站截圖**（pages-dist/screenshots/ + 專案根目錄 app{1,2,3}-*.png 數十張）→ APP 區、UI 展示
2. **Notion 既有實作照片**（每頁底部「未分類照片暫存區」共 ~30 張學生實作 jpeg）→ 製作過程、佐證
3. **AI 美化的 Mermaid 流程圖**（PNG）→ 系統架構、狀態圖、流程圖
4. **AI 生成的概念示意圖 / 心智圖 / banner**→ 章節視覺、設計願景
5. **Scratch 截圖**（Notion 詳細積木藍圖）→ APP 設計區
6. **3D 列印 STL 等角投影**（trimesh/blender 渲染）→ 模型設計區
7. **占位符**：實機照、3D 列印實物照、接線特寫、demo 現場照（皆待補拍）

## 占位符規格

無真實素材的圖片位置：

```
┌────────────────────────────────────┐
│                                    │
│   【實機照 - 待補拍】              │
│   建議拍攝：                       │
│   1. Arduino R4 + L293D 接線特寫   │
│   2. 3D 列印外殼正面照             │
│   3. 完整機器人 45 度俯視          │
│   4. 工作中 demo 連拍              │
│                                    │
│   位置：戊章 - 模型設計            │
│                                    │
└────────────────────────────────────┘
```

placeholder 用淺灰色 1pt 邊框 + 灰色文字，docx 內以「圖文框」或「圖片替代文字」形式呈現。

**Codex 寫稿時遇到沒素材的位置就寫占位符，不可自行用 AI 生圖**。

## 移除清單（必刪）

| 隊 | 舊 image | 內容 | 原因 |
|---|---|---|---|
| 印 | image9 | AI 卡通機器人 + 學生封面 | AI 假圖 |
| 印 | image5 | 含 AI 機器人的架構圖 | AI 假圖 |
| 印 | image8、image12 | 擬真機器人 render | AI 假圖（與實機不符） |
| 印 | image17 | 賽博龐克 AI 監視器 | AI 假圖 + 與作品無關 |
| 印 | image18 | Apple M6 chip 圖 | 與作品完全無關（佔位錯誤） |
| 印 | image19 | 卡通 Google Stitch logo | AI 假圖 |
| 品 | image20 | 「校園 AI 智多星」卡通封面 | AI 假圖 |
| 品 | image18 | 混合 AI 機器人架構圖 | AI 假圖 |
| 品 | image19 | 卡通 Scratch logo | 改用 Scratch 官方 logo |
| 國 | image22 | 「AI 智慧教學系統」卡通封面 | AI 假圖 |
| 國 | image8 | 藍光筆電 render | AI 假圖 + 與作品無關 |
| 國 | image19 | AI 智組型機器人標註圖 | AI 假圖 |
| 國 | image23、image24 | iPhone APP 三聯 mockup | 改用真實 demo 站截圖 |

## 替換來源對照表

| 章節 | 來源 |
|---|---|
| 封面主視覺 | demo 站 hero screenshot |
| 丙、設備清單照片 | Arduino R4 / L293D / TT motor / PLA 線材 官方產品照 + STL 等角圖 |
| 丁、流程圖 | Notion mermaid → PNG |
| 戊、模型設計 | 3D 列印 STL 等角 + 實機照（待補）+ 接線圖 |
| 戊、APP 設計 | demo 站真實 React 截圖 + Scratch 藍圖截圖 |
| 戊、系統架構圖 | Notion mermaid → PNG |

## Codex 任務拆切（3 隊各派一個）

每個 codex 任務獨立、輸出單檔 markdown 草稿，**不寫 docx**（docx 由 Claude 整合產出）。

### Codex Task 1：App1 內容草稿
- 讀本 spec + Notion App1 頁面 + pages-dist/app1/ HTML + screenshots/app1-*
- 產出 `docs/competition/app1-rewrite-draft.md`
- 內容：摘要、甲~庚全部章節，硬體規格按本 spec
- 圖位置用 `[IMG: 描述 | 來源]` 標註

### Codex Task 2：App2 內容草稿
- 同上但對 App2
- 產出 `docs/competition/app2-rewrite-draft.md`

### Codex Task 3：App3 內容草稿
- 同上但對 App3
- 產出 `docs/competition/app3-rewrite-draft.md`

## Claude 整合任務

1. 收三份 md 草稿
2. 解決三隊風格不一致 / 內容重複 / 用語衝突
3. 跨隊一致性檢查（規格表格、關鍵詞排版）
4. 下載 Notion 照片到 local
5. 用 python-docx 產生三份新 docx，套同套封面模板
6. 自我審：placeholder 是否清楚標示、學層別、硬體規格、無 AI 假圖殘留

## 交付物

- `初版作品說明書(印)_v2.docx`（App3 國中）
- `初版作品說明書(品)_v2.docx`（App2 國小）
- `初版作品說明書(國)_v2.docx`（App1 國小）
- 全部放在 `/Volumes/Tim aaddtional/Download/準備比賽/`

不覆蓋原 v1，避免誤刪。

## 風險與防呆

| 風險 | 防呆 |
|---|---|
| Codex 自行生 AI 圖塞進稿 | spec 明寫禁止 + 必用占位符 |
| 照片含校園敏感資訊 | 整合階段肉眼確認每張，必要時裁切 |
| 學層別搞錯 | spec 寫死、整合時 double-check |
| 硬體規格寫回 EV3 | spec 明列「全面移除」清單 + codex prompt 強調 |
| 文字過於 AI 腔 | 學生口吻範例已在 Notion，引用 Notion 內「學生語氣虛擬程式碼」風格 |
| docx 排版崩 | 用 python-docx + 從原 docx 抽 styles.xml 確保字體一致 |

## 不在範圍

- 不重做 demo 站（成品已上線）
- 不重做 firmware（platformio.ini 已正確）
- 不補拍實機照（使用者後補，docx 內用占位符）
- 不重寫 Scratch 程式（Notion 已有完整版）

---

待 user 拍板後進入 Codex 平行派送階段。
