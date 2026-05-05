# Demo Ready Runbook

## One Command

```zsh
npm run demo:ready
```

這個指令會用硬體模擬模式跑完整 readiness，並重新產生展示講稿與 EV3 校準表。

## Hardware Simulation

```zsh
DEMO_SIMULATE_HARDWARE=1 npm run dev
```

模擬模式會讓 Arduino 與 EV3 回傳可展示的成功結果。沒有接硬體時可用它保住現場流程；接真機時拿掉這個環境變數。

## Public Routes

- https://timdirty.github.io/115-campus-ai-demo/
- https://timdirty.github.io/115-campus-ai-demo/app1/
- https://timdirty.github.io/115-campus-ai-demo/app2/
- https://timdirty.github.io/115-campus-ai-demo/app3/
- https://timdirty.github.io/115-campus-ai-demo/app1-guide.html
- https://timdirty.github.io/115-campus-ai-demo/app2-guide.html
- https://timdirty.github.io/115-campus-ai-demo/app3-guide.html

## Final Public Check

GitHub Pages 部署完成後再跑：

```zsh
CHECK_PUBLIC_URLS=1 node scripts/competition-readiness-check.mjs
```
