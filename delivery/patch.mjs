import { execFileSync } from 'node:child_process';
import { validateBuilder } from './schemas.mjs';

export function normalizePatch(patch) {
  if (typeof patch !== 'string') return patch;
  return patch.trim().replace(/^```(?:diff|patch)?\s*\n/i, '').replace(/\n```\s*$/, '');
}

export function inspectPatch(patch, policy) {
  patch = normalizePatch(patch);
  const errors = validateBuilder({ decision: 'patch', summary: 'inspect', patch }, policy);
  if (typeof patch !== 'string') return errors;
  if (/^diff --git a\/\//m.test(patch) || /^diff --git a\/.* b\/\//m.test(patch)) errors.push('absolute patch path is forbidden');
  return [...new Set(errors)];
}

export function applyCheckedPatch(patch, policy, cwd) {
  patch = normalizePatch(patch);
  const errors = inspectPatch(patch, policy);
  if (errors.length) throw new Error(errors.join('; '));
  for (const args of [['apply', '--check', '-'], ['apply', '-']]) {
    const result = execFileSync('git', args, { cwd, input: patch, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result === undefined) continue;
  }
}
