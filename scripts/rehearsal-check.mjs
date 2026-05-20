#!/usr/bin/env node
const BRIDGES = [
  { name: 'App1 板擦機器人', port: 3201 },
  { name: 'App2 服務機器人', port: 3202 },
  { name: 'App3 心靈守護者', port: 3203 },
];

let allOk = true;

for (const bridge of BRIDGES) {
  const url = `http://localhost:${bridge.port}/api/health`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const arduino = data.arduinoConnected ?? false;
    const ai = data.geminiConfigured ?? data.ai ?? false;
    const sim = data.hardwareSimulation ?? false;
    console.log(`✅ ${bridge.name} (:${bridge.port})`);
    console.log(`   Arduino: ${arduino ? '🟢 connected' : sim ? '🟡 simulated' : '🔴 disconnected'}`);
    console.log(`   AI:      ${ai ? '🟢 Gemini' : '🟡 local fallback'}`);
  } catch (e) {
    console.log(`❌ ${bridge.name} (:${bridge.port}): ${e.message}`);
    console.log(`   → Run: npm run start:all`);
    allOk = false;
  }
}

console.log('');
if (allOk) {
  console.log('🟢 DEMO READY');
} else {
  console.log('🔴 DEMO NOT READY — fix above errors before demo');
  process.exit(1);
}
