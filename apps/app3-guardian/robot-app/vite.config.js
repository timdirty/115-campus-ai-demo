import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const VALID_EMOTIONS = new Set(['happy', 'calm', 'focused', 'anxious', 'sad', 'stressed'])

const PROMPT = `\
你是國中校園裡的「AI 心靈守護機器人」，正在用鏡頭做低壓、非診斷式的情緒觀察。

請觀察畫面中每個學生的狀態（包含姿勢、頭部方向、臉部表情線索、專注程度、是否低落或緊繃）。

前端機器人只支援以下六種情緒，請務必選其中一種：
- happy：愉悅。表情明亮、放鬆、有互動意願。
- calm：平靜。狀態穩定、沒有明顯壓力或異常。
- focused：專注。注意力集中、投入學習或任務。
- anxious：焦慮。緊張、不安、坐立難安、注意力明顯飄移。
- sad：低落。疲倦、沮喪、趴桌、退縮、缺乏互動。
- stressed：緊張。高壓、憤怒、明顯煩躁、可能需要立即關懷。

回覆規則：
- response 是「機器人前端要直接說出口」的一句話，請依 emotion 生成，不要使用固定模板。
- happy/calm/focused：語氣鼓勵、自然、短句即可。
- anxious/sad/stressed：語氣溫柔、低壓、不責備，提供可立即做的小步驟。
- advice 是給老師/中控的一句行動建議。
- summary 是給中控需注意狀況使用的一句現場摘要。

請只輸出 JSON，不要 Markdown，不要多餘說明。
格式如下：
{
  "emotion": "happy/calm/focused/anxious/sad/stressed 其中之一",
  "stress": 0-100,
  "stability": 0-100,
  "focus": 0-100,
  "moodLabel": "自然中文短標籤",
  "riskLabel": "穩定/需留意/高關注",
  "response": "機器人要說的一句自然短回覆",
  "advice": "給老師或中控的一句短建議",
  "summary": "一句話描述現場情緒狀況"
}`

function clamp(v, fallback) {
  const n = parseInt(v, 10)
  return isNaN(n) ? fallback : Math.max(0, Math.min(100, n))
}

function buildPayload(parsed) {
  const emotion = VALID_EMOTIONS.has(parsed.emotion) ? parsed.emotion : 'calm'
  const stress = clamp(parsed.stress, 30)
  const stability = clamp(parsed.stability, 70)
  const focus = clamp(parsed.focus, 65)
  const response = String(parsed.response || '已完成觀察。').slice(0, 120)
  const advice = String(parsed.advice || '持續觀察即可。').slice(0, 120)
  const moodLabel = String(parsed.moodLabel || '教室觀察')
  const riskLabel = String(parsed.riskLabel || (stress >= 65 ? '需留意' : '穩定'))
  const fusionScore = parsed.fusionScore ?? +((focus + stability + (100 - stress)) / 30).toFixed(1)

  const moodScore = ['anxious', 'sad', 'stressed'].includes(emotion) ? (emotion === 'stressed' ? 2 : 1) : 0
  const soundScore = stability >= 70 ? 0 : stability >= 45 ? 1 : 2
  const nodeScore = focus >= 70 ? 0 : focus >= 45 ? 1 : 2
  const alertScore = stress < 55 ? 0 : stress < 75 ? 1 : 2

  return {
    type: 'emotion',
    source: 'gemini-node',
    emotion, response, advice, stress, stability, focus,
    moodLabel, riskLabel, fusionScore,
    signals: {
      moodScore, soundScore, nodeScore, alertScore,
      personCount: 0,
      personStates: [],
      summary: String(parsed.summary || response),
    },
    robotActive: true,
    createdAt: Date.now(),
  }
}

function geminiScanApi(apiKey, model) {
  return {
    name: 'gemini-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan-emotion', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'method not allowed' }))
          return
        }

        const reply = (status, body) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(body))
        }

        let raw = ''
        req.on('data', chunk => { raw += chunk.toString() })
        req.on('end', async () => {
          try {
            const { image } = JSON.parse(raw || '{}')
            if (!image) return reply(400, { error: 'no image in request body' })
            if (!apiKey) return reply(500, { error: 'GEMINI_API_KEY not configured' })

            const geminiRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  contents: [{
                    parts: [
                      { text: PROMPT },
                      { inline_data: { mime_type: 'image/jpeg', data: image } },
                    ],
                  }],
                  generationConfig: { response_mime_type: 'application/json', temperature: 0.4, max_output_tokens: 300 },
                }),
              }
            )

            const geminiData = await geminiRes.json()
            if (!geminiRes.ok) {
              const msg = geminiData?.error?.message || geminiRes.statusText
              return reply(502, { error: `Gemini error: ${msg}` })
            }

            const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            let parsed = {}
            try { parsed = JSON.parse(text) } catch { /* use defaults */ }

            reply(200, buildPayload(parsed))
          } catch (err) {
            reply(500, { error: err.message })
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), '')
  const apiKey = env.GEMINI_API_KEY || ''
  const model = env.GEMINI_VISION_MODEL || 'gemini-2.5-flash'

  return {
    plugins: [
      geminiScanApi(apiKey, model),
      react(),
      tailwindcss(),
    ],
  }
})
