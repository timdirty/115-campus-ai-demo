# Windows 學生一鍵啟動 — PowerShell 版（與 macOS .command 同一個責任）
# 由 一鍵啟動展示.bat 呼叫，傳入：
#   STUDENT_APP_DIR、STUDENT_APP_NAME、STUDENT_BRIDGE_PORT、STUDENT_URL_PATH、STUDENT_START_SCRIPT
$ErrorActionPreference = 'Stop'

$appDir = $env:STUDENT_APP_DIR
$appName = $env:STUDENT_APP_NAME
$bridgePort = $env:STUDENT_BRIDGE_PORT
$urlPath = if ($env:STUDENT_URL_PATH) { $env:STUDENT_URL_PATH } else { '/' }
$startScript = if ($env:STUDENT_START_SCRIPT) { $env:STUDENT_START_SCRIPT } else { 'start' }
$nodeMajorRequired = if ($env:STUDENT_NODE_MAJOR_REQUIRED) { [int]$env:STUDENT_NODE_MAJOR_REQUIRED } else { 20 }

function Pause-Exit($code) {
  Write-Host ''
  Read-Host '按 Enter 關閉'
  exit $code
}

function Open-Url($url) {
  if ($env:STUDENT_NO_OPEN -eq '1') { return }
  Start-Process $url
}

if (-not $appDir -or -not $bridgePort) {
  Write-Host '啟動設定不完整，請確認 .bat 有設定 STUDENT_APP_DIR 與 STUDENT_BRIDGE_PORT。' -ForegroundColor Red
  Pause-Exit 1
}

Set-Location $appDir
$runtimeDir = Join-Path $appDir '.demo-runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Clear-Host
Write-Host '=============================================='
Write-Host "  $appName"
Write-Host '  一鍵啟動展示（Windows）'
Write-Host '=============================================='
Write-Host ''

# 1. Node.js 檢查
try {
  $nodeVer = node -v 2>$null
  $npmVer = npm -v 2>$null
  if (-not $nodeVer) { throw 'no node' }
} catch {
  Write-Host '這台電腦還沒有 Node.js。' -ForegroundColor Yellow
  Write-Host ''
  Write-Host "請先安裝 Node.js $nodeMajorRequired LTS 以上版本。"
  Write-Host '我已幫你開啟下載頁，安裝完成後重新雙擊這個檔案即可。'
  Open-Url 'https://nodejs.org/zh-tw/download/'
  Pause-Exit 1
}

$nodeMajor = [int]($nodeVer -replace 'v?(\d+)\..*', '$1')
if ($nodeMajor -lt $nodeMajorRequired) {
  Write-Host "目前 Node.js 版本是 $nodeVer，需要 $nodeMajorRequired 以上。" -ForegroundColor Yellow
  Write-Host '請先更新 Node.js。安裝完成後重新雙擊這個檔案即可。'
  Open-Url 'https://nodejs.org/zh-tw/download/'
  Pause-Exit 1
}

Write-Host "Node.js $nodeVer 已就緒"
Write-Host "npm $npmVer 已就緒"

# 2. .env.local 補建
if (-not (Test-Path '.env.local') -and (Test-Path '.env.example')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host '已建立 .env.local'
}

# 3. 首次 npm install
$lockNewerThanLock = $false
if ((Test-Path 'node_modules\.package-lock.json') -and (Test-Path 'package-lock.json')) {
  $lockNewerThanLock = (Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item 'node_modules\.package-lock.json').LastWriteTime
}
if ((-not (Test-Path 'node_modules')) -or $lockNewerThanLock) {
  Write-Host ''
  Write-Host '第一次啟動需要安裝展示套件，請保持網路連線。'
  npm install --prefer-offline --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host '套件安裝失敗，請檢查網路。' -ForegroundColor Red
    Pause-Exit 1
  }
}

# 4. build
Write-Host ''
Write-Host '準備展示頁面...'
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host '展示頁面 build 失敗。' -ForegroundColor Red
  Pause-Exit 1
}

# 5. 殺掉舊 bridge process（佔 bridge port 的）
$portPids = Get-NetTCPConnection -LocalPort $bridgePort -ErrorAction SilentlyContinue |
  Where-Object State -eq Listen | Select-Object -ExpandProperty OwningProcess -Unique
if ($portPids) {
  Write-Host "釋放占用 port $bridgePort 的舊程序..."
  $portPids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
}

# 6. 自動偵測 Arduino（呼叫跨平台 helper）
if (-not $env:DEMO_SIMULATE_HARDWARE) {
  $detectScript = Join-Path $appDir 'scripts\detect-arduino.mjs'
  $arduinoPath = ''
  if (Test-Path $detectScript) {
    $arduinoPath = (node $detectScript 2>$null)
    $detectExit = $LASTEXITCODE
  } else {
    $detectExit = 1
  }
  if ($detectExit -eq 0 -and $arduinoPath) {
    $env:DEMO_SIMULATE_HARDWARE = '0'
    Write-Host ''
    Write-Host "✅ 偵測到實體 Arduino：$arduinoPath（硬體模式）" -ForegroundColor Green
  } else {
    $env:DEMO_SIMULATE_HARDWARE = '1'
    Write-Host ''
    Write-Host '📱 未偵測到 Arduino，使用展示模式（所有功能仍可操作）' -ForegroundColor Cyan
    Write-Host '   若已插上 Arduino 但沒有偵測到：'
    Write-Host '   1. 確認用「資料線」而非充電線'
    Write-Host '   2. 確認 Windows 已安裝 Arduino UNO R4 USB driver'
    Write-Host '   3. 確認 firmware 已預先燒入（由老師端準備）'
  }
}

# 7. 啟動 bridge
$env:BRIDGE_PORT = $bridgePort
$env:NODE_ENV = 'production'
Write-Host ''
Write-Host "啟動本機展示服務：http://127.0.0.1:$bridgePort$urlPath"

$logFile = Join-Path $runtimeDir 'app.log'
# 用 Start-Process 把 npm run start 丟到背景，stdout 寫 log file
$appProc = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', $startScript `
  -NoNewWindow -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $logFile

# 8. 等 /api/health 回應
$ready = $false
for ($i = 0; $i -lt 80; $i++) {
  Start-Sleep -Milliseconds 250
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$bridgePort/api/ready" -UseBasicParsing -TimeoutSec 1
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

if (-not $ready) {
  Write-Host ''
  Write-Host '展示服務啟動失敗，請把下面這段給老師或工程同學看：' -ForegroundColor Red
  Write-Host ''
  if (Test-Path $logFile) { Get-Content $logFile -Tail 60 }
  try { Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue } catch {}
  Pause-Exit 1
}

$demoUrl = "http://127.0.0.1:$bridgePort$urlPath"
Open-Url $demoUrl

Write-Host ''
Write-Host "展示已開啟：$demoUrl" -ForegroundColor Green
Write-Host ''
Write-Host '學生只需要照畫面操作；沒有接硬體時會自動使用展示模式。'
Write-Host '展示中請不要關閉這個視窗。'
Write-Host ''
Write-Host '展示結束後，回到這個視窗按 Enter 就會關閉展示。'

if ($env:STUDENT_AUTO_EXIT_AFTER_READY -eq '1') { exit 0 }

# 收尾：使用者按 Enter → 殺掉 bridge
Read-Host '按 Enter 關閉'
try { Stop-Process -Id $appProc.Id -Force -ErrorAction SilentlyContinue } catch {}
# 一併殺掉占住 bridge port 的所有 node 程序（npm 會 fork node serialBridge）
$leftover = Get-NetTCPConnection -LocalPort $bridgePort -ErrorAction SilentlyContinue |
  Where-Object State -eq Listen | Select-Object -ExpandProperty OwningProcess -Unique
if ($leftover) {
  $leftover | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
exit 0
