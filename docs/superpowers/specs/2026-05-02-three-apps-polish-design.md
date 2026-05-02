# Three Apps Competition Polish — Design Spec
**Date:** 2026-05-02  
**Status:** Approved  
**Scope:** App 1 (AI自動板擦機器人), App 2 (校園服務機器人), App 3 (AI校園心靈守護者)  
**Constraint:** No Arduino/hardware changes. All AI features + UI polish only.

---

## Problem Statement

All three competition apps currently use regex pattern-matching as their "AI" — returning hardcoded template strings after a fake delay. Key issues:
- App 1: board analysis, chat, quiz generation all return hardcoded data regardless of actual input
- App 2: teacher replies, dispatch recommendations are keyword-matched; dashboard stats flicker randomly
- App 3: care responses limited to 5 patterns; campus map is CSS-skewed white boxes with no visual hierarchy

With a real Gemini API key available, the goal is to make all three apps genuinely AI-powered with robust local fallbacks.

---

## Approach: Full Gemini Integration + Rich Local Fallback (Option C)

Each app calls real Gemini API first. On failure (timeout, quota, no network), falls back to a dramatically expanded local template library. No app ever breaks or hangs.

---

## App 1 — AI自動板擦機器人

### Backend Gemini Routes (`server/routes/gemini.ts`)

New file, mounted in `server/index.ts` (or `serialBridge.ts`). Uses `@google/generative-ai` SDK server-side. Key: `process.env.GEMINI_API_KEY`.

| Route | Input | Output | Model |
|-------|-------|--------|-------|
| `POST /api/ai/chat` | `{message, history[], noteIds[]}` | `{reply: string}` | gemini-1.5-flash |
| `POST /api/ai/analyze-board` | `{imageBase64, mimeType, subject?}` | `{regions[], transcript, learningStatus}` | gemini-1.5-flash (vision) |
| `POST /api/ai/generate-quiz` | `{content, subject?, count?}` | `{questions[]}` | gemini-1.5-flash |
| `POST /api/ai/summarize` | `{content, subject?}` | `{summary: string}` | gemini-1.5-flash |

System prompts: teacher assistant role, 國小 reading level, Traditional Chinese output, JSON-structured responses.

All routes: 8-second server-side timeout, structured error response `{error, fallback: true}`.

### Frontend Fallback Improvements (`src/services/classroomApi.ts`)

- Replace single hardcoded fallback with 5 subject-specific templates: 數學、語文、自然、社會、綜合
- `learningStatus` fallback: random in realistic ranges (focus: 72–88, confused: 8–18, tired: 4–12) — not always 82/12/6
- Board region labels vary by subject template instead of always A="圖解與例題"

### Status Display Fix (`src/pages/Home.tsx`)

- Gemini status tile: show `ok={false}` with amber indicator when in `local-fallback` mode, not always green

---

## App 2 — 校園服務機器人

### Shared Gemini Service (`src/services/geminiAi.ts`) — NEW FILE

```typescript
// Direct Gemini REST API call from browser
// Key: import.meta.env.VITE_GEMINI_API_KEY
// Timeout: 6 seconds
// Returns: string response
// Throws on failure → caller catches and uses local fallback
export async function askGemini(systemPrompt: string, userPrompt: string): Promise<string>
```

### `src/services/localAi.ts` — FULL REWRITE

Three exported functions, each: try Gemini → catch → local fallback.

**`generateTeacherReply(question: string, subject?: string): Promise<string>`**
- Gemini system prompt: 國小教師 AI 助理，親切易懂，不超過 3 句
- Local fallback: 40 templates across 8 subjects × 5 situation types (confused, quiz-request, group-work, review, general)

**`generateDispatchRecommendation(zone: string, taskType: DispatchTaskType): Promise<string>`**
- Gemini system prompt: 校園服務機器人調度系統，給出具體行動建議
- Local fallback: 20 templates per (zone × taskType) matrix

**`generateStudentReport(name: string, data: StudentReport): Promise<string>`**
- Gemini system prompt: 班級學習報告生成器，段落式繁體中文
- Local fallback: 3 performance tiers × narrative templates

### Dashboard Metrics Fix (`src/views/DashboardView.tsx`)

Remove `setInterval` random fluctuation. Replace with time-based deterministic function:
- `getFocusScore(hour)` → realistic curve peaking at 9–10am and 2–3pm
- `getDeliveryProgress()` → based on current orders in state, not random increment

---

## App 3 — AI校園心靈守護者

### Shared Gemini Service

Same `src/services/geminiAi.ts` pattern as App 2.

### `src/services/localGuardianAi.ts` — ENHANCED

**`generateSupportReply(text, mood, location?, recentAlert?): Promise<string>`**
- Gemini system prompt: 學校輔導老師角色，溫暖同理，不做診斷，鼓勵尋求支持。Context includes: mood, location, recent alert summary.
- Local fallback: expand from 5 → 30+ templates organized by `(trigger × mood × riskLevel)`:
  - Crisis (3): immediate referral language
  - Bullying (5): peer conflict support
  - Academic stress (6): exam/grade anxiety
  - Social isolation (5): loneliness, exclusion
  - General tiredness (5): rest and self-care
  - Positive/gratitude (6): reinforce wellbeing

### Campus Map Redesign (`src/components/CampusMapSvg.tsx`) — NEW COMPONENT

Replace `MapGrid2D` CSS boxes with a proper SVG school floor plan:

**Layout (viewport: 400×320):**
```
┌─────────────────────────────────┐
│  [教室群 A]    [走廊]  [圖書館]  │
│                                 │
│      [中庭廣場]                  │
│                                 │
│  [教室群 B]         [操場]      │
└─────────────────────────────────┘
```

**Features:**
- SVG `<rect>` + `<path>` shapes with rounded corners for each zone
- Zone fill color driven by `riskLevel`: low=green-100, medium=amber-100, high=red-100
- Risk pulse animation: high-risk zones get `animate-pulse` ring
- Zone labels: Chinese name + risk badge (低/中/高)
- Robot marker: SVG robot icon `<motion.g>` animates to zone center on dispatch
- Click zone → opens zone inspector (same as before, just triggered from better map)

Props: `zones: ZoneStatus[], dispatchTarget: string | null, onZoneClick: (id) => void`

---

## Shared Infrastructure

### Environment Files

App 1 (`server/.env` or root `.env`):
```
GEMINI_API_KEY=<key>
```

App 2 + App 3 (each app root `.env`):
```
VITE_GEMINI_API_KEY=<key>
```

All `.env` files already in `.gitignore`. Students set these before demo day.

### Error Handling Contract

All Gemini calls:
1. 6-second client timeout / 8-second server timeout
2. Network error → silent catch → local fallback (no UI error shown)
3. Response validation: if Gemini returns unexpected format → fallback
4. Never block UI — always return within timeout window

### Build Verification

After each app: `npm run check` (tsc + vitest + build). All must pass zero errors before marking complete.

---

## Out of Scope

- Arduino/hardware serial commands (no changes)
- Firebase integration (App 3 already gracefully handles missing config)
- Real-time sensor data (out of demo scope)
- Authentication systems
- Backend database (localStorage + JSON files remain)

---

## Success Criteria

1. App 1 AI chat responds to actual questions with real Gemini intelligence
2. App 1 board analysis returns subject-appropriate, non-identical analysis each time
3. App 2 teacher AI gives contextually relevant subject-specific answers
4. App 2 dashboard shows realistic time-based metrics, no random flickering
5. App 3 care responses feel warm, personal, context-aware (not template-obvious)
6. App 3 map shows a recognizable school layout with color-coded risk zones
7. All three apps fall back gracefully when Gemini is unavailable
8. `npm run check` passes for all three apps
