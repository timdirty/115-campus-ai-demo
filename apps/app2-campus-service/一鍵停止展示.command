#!/usr/bin/env bash

echo '==> 停止 app2 (bridge :3202 + vite)'
lsof -ti:3202 2>/dev/null | xargs -r kill -9 2>/dev/null || true
pkill -f 'vite.*app2-campus-service' 2>/dev/null || true
pkill -f 'tsx server/serialBridge' 2>/dev/null || true
echo '✓ 停止完成'
sleep 2
