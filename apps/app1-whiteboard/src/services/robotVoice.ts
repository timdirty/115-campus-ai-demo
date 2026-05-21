export interface SayOptions {
  priority?: 'normal' | 'urgent';
  lang?: string;
  rate?: number;
  pitch?: number;
}

type QueueItem = {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
};

const ENABLED_KEY = 'app1.voice.enabled';
const DEFAULT_LANG = 'zh-TW';
const DEFAULT_RATE = 1.0;
const DEFAULT_PITCH = 1.0;

let queue: QueueItem[] = [];
let speaking = false;
let generation = 0;
let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerAttached = false;
let enabledOverride: boolean | undefined;

function getWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function getSynth(): SpeechSynthesis | undefined {
  return getWindow()?.speechSynthesis;
}

function getUtteranceCtor(): typeof SpeechSynthesisUtterance | undefined {
  if (typeof SpeechSynthesisUtterance !== 'undefined') {
    return SpeechSynthesisUtterance;
  }

  return (getWindow() as (Window & {SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance}) | undefined)?.SpeechSynthesisUtterance;
}

function cacheVoices(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  try {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
    }
  } catch {
    return cachedVoices;
  }

  return cachedVoices;
}

function ensureVoiceCache(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  if (!voicesListenerAttached && typeof synth.addEventListener === 'function') {
    try {
      synth.addEventListener('voiceschanged', () => {
        cacheVoices(synth);
      });
      voicesListenerAttached = true;
    } catch {
      voicesListenerAttached = true;
    }
  }

  return cacheVoices(synth);
}

function selectVoice(synth: SpeechSynthesis, lang: string): SpeechSynthesisVoice | null {
  const voices = ensureVoiceCache(synth);
  if (voices.length === 0) return null;

  const normalizedLang = lang.toLowerCase();
  if (normalizedLang.startsWith('zh')) {
    return (
      voices.find((voice) => voice.lang.toLowerCase() === 'zh-tw') ??
      voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn') ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('zh-')) ??
      voices[0] ??
      null
    );
  }

  const languageRoot = normalizedLang.split('-')[0];
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalizedLang) ??
    voices.find((voice) => voice.lang.toLowerCase().split('-')[0] === languageRoot) ??
    voices[0] ??
    null
  );
}

function makeItem(text: string, synth: SpeechSynthesis, opts: SayOptions = {}): QueueItem {
  const lang = opts.lang ?? DEFAULT_LANG;

  return {
    text,
    lang,
    rate: opts.rate ?? DEFAULT_RATE,
    pitch: opts.pitch ?? DEFAULT_PITCH,
    voice: selectVoice(synth, lang),
  };
}

function finishItem(item: QueueItem, token: number) {
  if (token !== generation || queue[0] !== item) return;

  queue.shift();
  speaking = false;
  speakNext();
}

function speakNext() {
  if (speaking || queue.length === 0) return;

  const synth = getSynth();
  const Utterance = getUtteranceCtor();
  const item = queue[0];
  if (!synth || !Utterance || !item) {
    queue = [];
    speaking = false;
    return;
  }

  try {
    const utterance = new Utterance(item.text);
    const token = generation;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      finishItem(item, token);
    };

    utterance.lang = item.lang;
    utterance.rate = item.rate;
    utterance.pitch = item.pitch;
    utterance.voice = item.voice;
    utterance.addEventListener('end', done);
    utterance.addEventListener('error', done);

    speaking = true;
    synth.speak(utterance);
  } catch {
    queue.shift();
    speaking = false;
    speakNext();
  }
}

export function isSupported(): boolean {
  return Boolean(getSynth());
}

export function say(text: string, opts: SayOptions = {}): boolean {
  try {
    const synth = getSynth();
    if (!isEnabled() || !synth || !getUtteranceCtor()) return false;

    const item = makeItem(text, synth, opts);
    if (opts.priority === 'urgent') {
      try {
        synth.cancel();
      } catch {
        return false;
      }

      generation += 1;
      queue = [];
      speaking = false;
      queue.push(item);
      speakNext();
      return true;
    }

    queue.push(item);
    speakNext();
    return true;
  } catch {
    return false;
  }
}

export function cancel(): void {
  generation += 1;
  queue = [];
  speaking = false;

  try {
    getSynth()?.cancel();
  } catch {
    // Speech synthesis cancellation is best-effort.
  }
}

export function setEnabled(enabled: boolean): void {
  enabledOverride = enabled;

  try {
    getWindow()?.localStorage?.setItem(ENABLED_KEY, String(enabled));
  } catch {
    // Storage may be unavailable; voice state still remains safe.
  }

  if (!enabled) {
    cancel();
  }
}

export function isEnabled(): boolean {
  try {
    const stored = getWindow()?.localStorage?.getItem(ENABLED_KEY);
    return stored === null || stored === undefined ? enabledOverride ?? true : stored !== 'false';
  } catch {
    return enabledOverride ?? true;
  }
}
