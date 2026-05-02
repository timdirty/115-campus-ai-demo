# Three Apps Competition Completion — Design Spec

**Date:** 2026-05-02  
**Scope:** All non-Arduino improvements across App 1, App 2, App 3  
**Verified by:** Codex independent audit  
**Approach:** C→B (competition-priority order, comprehensive execution)

---

## Problem Summary

Three React competition apps must work reliably at a venue with uncertain WiFi. Audit identified:
- External URL dependencies that produce broken images or font fallback offline
- Poor-quality AI fallback logic that reveals the demo is unprepared when no Gemini key is present
- Hardcoded subject-specific content in App 2 that only fits history class
- Incomplete demo guide in App 3 (4 of 8 required steps)

---

## Architecture Decisions

### 1. External Image URLs → SVG Data URIs

All `img: string` fields in state types must remain `string`. The only approach that satisfies this constraint while eliminating network dependency is **base64-encoded SVG data URIs** (`data:image/svg+xml;base64,...`).

- Zero runtime network requests
- No build pipeline changes needed
- No new files committed
- No TypeScript type changes required
- Existing tests unaffected (no tests assert on image `src` values)

For `<img src={...}>` components that wrap decorative background images (TeachView classroom, LifeView mapcam), replace with a `<div>` with CSS gradient background — no `<img>` tag needed.

### 2. Google Fonts → System Font Fallbacks

All three `src/index.css` files import Google Fonts with `display=swap`. This means text already renders immediately with system fonts; Google Fonts are an enhancement, not a requirement. The competition machines (macOS) have excellent system CJK fonts (PingFang SC covers Noto Sans TC needs).

Fix: Add comprehensive system font fallback stacks to each app's `@theme` block. Do NOT self-host fonts (would require woff2 downloads, increase bundle size, change build process — net negative for competition prep time).

### 3. AI Fallback Quality (App 1)

`localQuiz()` currently takes raw content lines 0–4 as question text and hardcodes `ans: 0` for every question — all correct answers are always option A. `chatWithAI()` returns a fixed template regardless of note content or chat history.

Fix: Use the note's real `content` field to extract meaningful quiz items:
- Split content into sentences/bullet points
- Extract subject-object pairs as correct answers
- Generate distractors from other terms in the same note
- Shuffle answer position to avoid always being option A

`localSummary()` already derives some bullets from content via `lines.slice(0, 6)`. Enhancement: extract actual structured sections (what was taught, key terms, action items) from note content.

`chatWithAI()` fallback: generate a context-aware response using the linked note's subject and content — not a fixed template.

### 4. App 2 TeachView AI Suggestions

Current hardcoded responses name specific historical figures (達文西/米開朗基羅/拉斐爾), making them obviously wrong for any other subject. Replace with subject-agnostic templates that work for any course.

### 5. App 3 DemoGuide Expansion

PLAN_TODO specifies an 8-step demo flow. Current implementation has 4 steps. Add 4 steps covering: acoustic alert detection, proactive care, robot dispatch, node restart — matching the PLAN_TODO demo script.

---

## Changes by File

### P0 — Breaks offline (fix first)

| File | Change |
|---|---|
| `app_2/src/state/appState.ts:184–191` | Replace `productImages.toast/egg/pizza` Google CDN with SVG data URIs |
| `app_2/src/App.tsx:187,287` | Replace user avatar `<img src="https://lh3...">` with SVG data URI |
| `app_2/src/views/TeachView.tsx:186,337` | Replace Unsplash `<img>` with `<div>` CSS gradient |
| `app_2/src/views/LifeView.tsx:354` | Replace Unsplash `<img>` with `<div>` CSS gradient |
| `app_1/src/services/notesStore.ts:55,56,73,74,91,92` | Replace Unsplash demo note thumbnails with whiteboard SVG data URIs |
| `app_1/src/services/notesStore.ts:194` | Replace fallback Unsplash URL with whiteboard SVG data URI |
| All 3 `src/index.css:1` | Add system font fallback stacks to `@theme` |

### P1 — Degrades demo quality

| File | Change |
|---|---|
| `app_1/src/services/geminiService.ts` | Improve `localQuiz()`, `localSummary()`, `chatWithAI()` fallback |
| `app_2/src/views/TeachView.tsx` | Replace hardcoded history-class AI suggestions with subject-agnostic responses |

### P2 — Polish

| File | Change |
|---|---|
| `app_3/src/App.tsx` | Expand DemoGuide from 4 to 8 steps per PLAN_TODO |

### Hygiene

| File | Change |
|---|---|
| `app_2/src/views/DeliveryView.tsx` | Remove dead `INITIAL_PRODUCTS` constant (lines 14–18) |

---

## Out of Scope

- Arduino firmware (explicitly excluded by user)
- App 1 bridge server logic
- New features not in PLAN_TODO
- Self-hosting Google Fonts (build complexity vs. competition benefit not worth it)
- `server/defaults.ts` Unsplash URLs (server-side only, only active when bridge runs locally)

---

## Success Criteria

- `npm run check` passes for all 3 apps (TypeScript + tests + build)
- Zero `<img src="https://...">` with external domains in any app's `src/` directory
- App 1 quiz: answers distributed across A/B/C/D (not always A)
- App 1 chat fallback: response references the linked note's subject
- App 2 AI suggestions: no subject-specific named content
- App 3 DemoGuide: 8 steps visible
- All apps render correctly with system fonts (verified by visual check before competition)

---

## Risk Register

| Risk | Mitigation |
|---|---|
| SVG data URIs increase bundle size | SVGs are small (<1 KB each); negligible impact |
| `normalizePersistedState` in `appState.ts` validates `img: string` — could corrupt SVG data URI | The `text()` normalizer checks `value.trim()` which passes for data URIs ✓ |
| App 1 improved `localQuiz()` could generate confusing questions | Cap at 4 questions, require minimum content length before generating |
| App 3 DemoGuide expansion adds scroll length on mobile | Keep step descriptions short; test on 390px viewport |
