import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOutputText } from '../../delivery/openai.mjs';

test('extracts structured output from a REST Responses API message', () => {
  const response = { output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] };
  assert.equal(extractOutputText(response), '{"ok":true}');
});
