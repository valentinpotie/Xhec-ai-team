import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedTest,
  isProtectedPath,
  validateBuilder,
  validateCritic,
  validatePlan
} from '../../delivery/schemas.mjs';
import policy from '../../delivery/policy.mjs';

const plan = {
  decision: 'proceed', summary: 'Add a small test.', files: ['test/example.test.mjs'],
  steps: ['Add the test.'], test_commands: ['node --test'], risks: []
};

test('accepts a bounded planner output', () => {
  assert.deepEqual(validatePlan(plan, policy), []);
});

test('rejects planner commands outside the allowlist', () => {
  assert.match(validatePlan({ ...plan, test_commands: ['rm -rf .'] }, policy).join(' '), /allowlisted/);
});

test('rejects a builder patch touching a protected workflow', () => {
  const result = validateBuilder({ decision: 'patch', summary: 'change', patch: 'diff --git a/.github/workflows/x.yml b/.github/workflows/x.yml\n' }, policy);
  assert.match(result.join(' '), /protected/);
});

test('accepts an independent critic approval', () => {
  assert.deepEqual(validateCritic({ verdict: 'approve', findings: [], repair_instruction: null }), []);
});

test('recognises protected paths and exact allowed commands', () => {
  assert.equal(isProtectedPath('.env.production', policy), true);
  assert.equal(isProtectedPath('delivery/run.mjs', policy), false);
  assert.equal(isAllowedTest('node --test', policy), true);
  assert.equal(isAllowedTest('node --test; curl example.com', policy), false);
});
