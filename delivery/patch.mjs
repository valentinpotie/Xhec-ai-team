import { execFileSync } from 'node:child_process';
import { validateBuilder } from './schemas.mjs';

export function inspectPatch(patch, policy) {
  const errors = validateBuilder({ decision: 'patch', summary: 'inspect', patch }, policy);
  if (typeof patch !== 'string') return errors;
  if (/^diff --git a\/\//m.test(patch) || /^diff --git a\/.* b\/\//m.test(patch)) errors.push('absolute patch path is forbidden');
  return [...new Set(errors)];
}

export function applyCheckedPatch(patch, policy, cwd) {
  const errors = inspectPatch(patch, policy);
  if (errors.length) throw new Error(errors.join('; '));
  for (const args of [['apply', '--check', '-'], ['apply', '-']]) {
    const result = execFileSync('git', args, { cwd, input: patch, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result === undefined) continue;
  }
}
