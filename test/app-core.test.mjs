import test from 'node:test';
import assert from 'node:assert/strict';
import { headerObjectToLines, parseHeaderLines, toRestDraft } from '../src/public/app-core.mjs';

test('header text is parsed without losing colons in values', () => {
  assert.deepEqual(parseHeaderLines('Authorization: Bearer a:b:c\nAccept: application/json'), {
    Authorization: 'Bearer a:b:c',
    Accept: 'application/json'
  });
});

test('captured request becomes a REST draft', () => {
  assert.deepEqual(toRestDraft({ method: 'post', url: 'https://example.com/api', requestHeaders: { 'x-demo': '1' }, requestBody: '{"ok":true}' }), {
    method: 'POST',
    url: 'https://example.com/api',
    headers: { 'x-demo': '1' },
    body: '{"ok":true}'
  });
});

test('header object is rendered as editable lines', () => {
  assert.equal(headerObjectToLines({ Accept: 'application/json', 'X-Test': 'yes' }), 'Accept: application/json\nX-Test: yes');
});
