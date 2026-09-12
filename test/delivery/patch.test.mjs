import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPatch, normalizePatch } from '../../delivery/patch.mjs';
import policy from '../../delivery/policy.mjs';

test('accepts a small patch to a normal source file', () => {
  const patch = 'diff --git a/delivery/example.mjs b/delivery/example.mjs\n--- a/delivery/example.mjs\n+++ b/delivery/example.mjs\n@@ -0,0 +1 @@\n+export const ok = true;\n';
  assert.deepEqual(inspectPatch(patch, policy), []);
});

test('rejects absolute paths and binary patches', () => {
  const patch = 'diff --git a//tmp/x b//tmp/x\nGIT binary patch\n';
  const errors = inspectPatch(patch, policy).join(' ');
  assert.match(errors, /absolute|binary/);
});

test('unwraps a markdown diff fence before validation', () => {
  const patch = '```diff\ndiff --git a/a.mjs b/a.mjs\n--- a/a.mjs\n+++ b/a.mjs\n@@ -0,0 +1 @@\n+export {};\n```';
  assert.match(normalizePatch(patch), /^diff --git/m);
});
