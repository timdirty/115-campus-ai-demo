#!/usr/bin/env node
// 跨平台 Arduino 偵測 — exit code 0 = 有接、1 = 沒接
// 輸出：找到時 print path（例：/dev/cu.usbmodem83101 或 COM5）
// 給 macOS .command 和 Windows .bat 共用，避免 platform-specific 邏輯重複
import {SerialPort} from 'serialport';

function isArduinoLikePort(port) {
  const text = `${port.path} ${port.manufacturer ?? ''}`.toLowerCase();
  // 跨平台特徵：mac 是 cu.usbmodem*, win 是 COM*，manufacturer 多含 arduino
  return text.includes('arduino') || text.includes('usbmodem') || text.includes('uno')
    || (port.vendorId && port.vendorId.toLowerCase() === '2341');  // Arduino 官方 VID
}

try {
  const ports = await SerialPort.list();
  const found = ports.find(isArduinoLikePort);
  if (found) {
    process.stdout.write(found.path);
    process.exit(0);
  }
  process.exit(1);
} catch (err) {
  console.error('detect-arduino failed:', err.message);
  process.exit(2);
}
