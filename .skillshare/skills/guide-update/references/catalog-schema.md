# app-catalog.mjs Schema & Audit Rules

## File location
`scripts/app-catalog.mjs` — source of truth for guide HTML generation.

## Top-level App entry fields

```js
{
  id: 'app2',          // 'app1' | 'app2' | 'app3'
  devPort: 11502,      // doc only; actual port set in package.json dev:web
  routes: [...],       // demo routes shown in guide
  simpleSteps: [...],  // step-by-step numbered list
  judgeQaExtra: [...], // Q&A pairs for judges
  robot: { ... },      // hardware spec block
  visionCards: [...],  // (app2 only) vision demo cards
}
```

## Route entry fields

```js
{
  id: 'store-delivery-loop',
  label: '…',
  summary: '…',
  demoScript: '…',    // judge-facing demo speech
  hardware: ['FORWARD', 'STOP', …],  // MUST match real firmware/action names
  proof: ['…'],
  fallback: '…',
  screenshots: ['app2-step1.png', …],  // MUST exist in assets/screenshots/
  startUrl: './app2/#delivery',
}
```

## Screenshot naming convention

| App | Basename pattern | Route |
|-----|-----------------|-------|
| app1 | `app1-step{N}.png` | step1=home, step2=whiteboard, step3=robot, step4=chat |
| app2 | `app2-step{N}.png` | step1=home, step2=teach, step3=delivery, step4=teach-detail, step5=delivery-detail, step6=student |
| app2 | `app2-attend.png` | #teach scrolled (attendance scan view) |
| app2 | `app2-teach-done.png` | #teach scrolled (task complete) |
| app2 | `app2-life-vision.png` | #student scrolled (vision result) |
| app3 | `app3-step{N}.png` | step1=home, step2=care, step3=sensing, step4=alerts |

**Audit rule**: every filename listed under `screenshots: [...]` must exist in `assets/screenshots/`.  
Run: `ls assets/screenshots/` and cross-check.

## Vision cards (app2 only)

```js
visionCards: [
  { file: '01-crowd-hallway.png', title: '人流疏導', result: '廣播疏導', zone: '福利社前' },
  …
]
```

Card images live in `apps/app2-campus-service/public/demo-assets/vision-cards/`.  
Build script copies them to `pages-dist/app2/demo-assets/vision-cards/`.

## Audit checklist (run for each app being updated)

1. `hardware: []` entries — verify against real firmware commands (see `command-sources.md`)
2. `screenshots: []` entries — verify every file exists in `assets/screenshots/`
3. `startUrl` — verify hash route exists in the app's router
4. `demoScript` / `summary` — check for EV3/LEGO/SPIKE mentions (must be purged)
5. `visionCards[].file` — verify PNG exists in app2 `public/demo-assets/vision-cards/`
