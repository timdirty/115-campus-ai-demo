import assert from 'node:assert/strict';
import {DEFAULT_NOTES, normalizeNotes} from './notesStore';

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
