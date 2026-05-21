// Plain throw-based assertions: avoids both TS2775 (assertion narrowing rules)
// and TS2694 (default-import quirks of dynamic node:assert/strict).
const storage = new Map<string, string>();
let speechGeneration = 0;

class MockSpeechSynthesisUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  private listeners = new Map<string, Array<() => void>>();

  constructor(text: string) {
    this.text = text;
  }

  addEventListener(event: string, listener: () => void) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  emit(event: string) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener();
    }
  }
}

const speechSynthesisMock = {
  speakCallCount: 0,
  cancelCallCount: 0,
  speak(utterance: MockSpeechSynthesisUtterance) {
    speechSynthesisMock.speakCallCount += 1;
    const token = speechGeneration;
    setTimeout(() => {
      if (token === speechGeneration) {
        utterance.emit('end');
      }
    }, 0);
  },
  cancel() {
    speechSynthesisMock.cancelCallCount += 1;
    speechGeneration += 1;
  },
  getVoices() {
    return [
      {lang: 'en-US', name: 'English'},
      {lang: 'zh-CN', name: 'Chinese China'},
      {lang: 'zh-TW', name: 'Chinese Taiwan'},
    ];
  },
  addEventListener(event: string, listener: () => void) {
    if (event === 'voiceschanged') {
      listener();
    }
  },
};

(globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
(globalThis as any).window = {
  SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
  speechSynthesis: speechSynthesisMock,
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  },
};

const robotVoice = await import('./robotVoice');

function check(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)} got ${String(actual)}`);
  }
}

function checkTruthy(value: unknown, label: string) {
  if (!value) throw new Error(`${label}: expected truthy got ${String(value)}`);
}

function resetVoiceState() {
  robotVoice.cancel();
  storage.clear();
  robotVoice.setEnabled(true);
  speechSynthesisMock.speakCallCount = 0;
  speechSynthesisMock.cancelCallCount = 0;
}

function flushSpeech() {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

check(robotVoice.isSupported(), true, 'isSupported when synth exists');

const originalSpeechSynthesis = (globalThis as any).window.speechSynthesis;
(globalThis as any).window.speechSynthesis = undefined;
check(robotVoice.isSupported(), false, 'isSupported when synth undefined');
(globalThis as any).window.speechSynthesis = originalSpeechSynthesis;

resetVoiceState();
check(robotVoice.say('第一句', {priority: 'normal'}), true, 'queue first say');
check(robotVoice.say('第二句', {priority: 'normal'}), true, 'queue second say');
check(speechSynthesisMock.speakCallCount, 1, 'one speak in flight initially');
await flushSpeech();
await flushSpeech();
check(speechSynthesisMock.speakCallCount, 2, 'second speak fires after first end');

resetVoiceState();
check(robotVoice.say('一般任務', {priority: 'normal'}), true, 'normal before urgent');
check(robotVoice.say('緊急停止', {priority: 'urgent'}), true, 'urgent enqueued');
checkTruthy(speechSynthesisMock.cancelCallCount > 0, 'urgent should call cancel');
check(speechSynthesisMock.speakCallCount, 2, 'urgent triggers a second speak');
await flushSpeech();

resetVoiceState();
robotVoice.setEnabled(false);
check(robotVoice.say('不要播放'), false, 'disabled returns false');
check(speechSynthesisMock.speakCallCount, 0, 'disabled never speaks');

resetVoiceState();
check(robotVoice.say('保留第一句', {priority: 'normal'}), true, 'normal pre-cancel');
check(robotVoice.say('應該被清掉', {priority: 'normal'}), true, 'normal that will be cancelled');
check(speechSynthesisMock.speakCallCount, 1, 'only first speak started');
robotVoice.cancel();
await flushSpeech();
check(speechSynthesisMock.speakCallCount, 1, 'cancel prevents further speaks');

console.log('robotVoice tests passed');
