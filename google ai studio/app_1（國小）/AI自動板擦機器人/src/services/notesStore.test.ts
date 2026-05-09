import assert from 'node:assert/strict';
import {DEFAULT_NOTES, normalizeNotes, resetWhiteboardDemoState} from './notesStore';

const recovered = normalizeNotes([
  {
    id: 'broken',
    title: '',
    subject: '國小自然',
    content: '',
    theme: 'neon',
    keywords: ['水循環', 123],
    linkedTaskIds: [1, 'bad'],
  },
  null,
]);

assert.equal(recovered.length, 1);
assert.equal(recovered[0].title, DEFAULT_NOTES[0].title);
assert.equal(recovered[0].subject, '國小自然');
assert.equal(recovered[0].theme, DEFAULT_NOTES[0].theme);
assert.deepEqual(recovered[0].keywords, ['水循環']);
assert.deepEqual(recovered[0].linkedTaskIds, [1]);

const fallback = normalizeNotes({bad: true});
assert.equal(fallback.length, DEFAULT_NOTES.length);

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};
(globalThis as any).window = {
  dispatchEvent: () => undefined,
};
(globalThis as any).CustomEvent = class {
  type: string;

  constructor(type: string) {
    this.type = type;
  }
};

storage.set('whiteboard-chat:elementary:v1', 'stale');
storage.set('whiteboard-session:elementary:v1', 'stale');
storage.set('whiteboard-assistant-tour:v1', 'done');

const resetNotes = resetWhiteboardDemoState();
assert.equal(resetNotes.length, DEFAULT_NOTES.length);
assert.equal(storage.has('whiteboard-chat:elementary:v1'), false);
assert.equal(storage.has('whiteboard-session:elementary:v1'), false);
assert.equal(storage.has('whiteboard-assistant-tour:v1'), false);
assert.deepEqual(JSON.parse(storage.get('whiteboard-notes:elementary:v1') ?? '[]').length, DEFAULT_NOTES.length);
