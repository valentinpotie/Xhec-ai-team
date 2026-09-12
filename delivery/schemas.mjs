const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;

export function isProtectedPath(path, policy) {
  return !isText(path) || path.startsWith('/') || path.includes('..') || path.startsWith('.env') ||
    policy.protectedPathNames.includes(path) || policy.protectedPathPrefixes.some(prefix => path.startsWith(prefix));
}

export function isAllowedTest(command, policy) {
  return isText(command) && policy.allowedTestCommands.includes(command.trim());
}

export function validatePlan(value, policy) {
  const errors = [];
  if (!isObject(value)) return ['plan must be an object'];
  if (!['proceed', 'escalate'].includes(value.decision)) errors.push('plan decision is invalid');
  if (!isText(value.summary) || value.summary.length > 500) errors.push('plan summary is invalid');
  for (const key of ['files', 'steps', 'test_commands', 'risks']) if (!Array.isArray(value[key])) errors.push(`plan ${key} must be an array`);
  if (Array.isArray(value.files)) for (const path of value.files) if (isProtectedPath(path, policy)) errors.push(`plan path is protected: ${path}`);
  if (Array.isArray(value.test_commands)) for (const command of value.test_commands) if (!isAllowedTest(command, policy)) errors.push(`test command is not allowlisted: ${command}`);
  return errors;
}

export function validateBuilder(value, policy) {
  const errors = [];
  if (!isObject(value)) return ['builder output must be an object'];
  if (!['patch', 'escalate'].includes(value.decision)) errors.push('builder decision is invalid');
  if (!isText(value.summary) || value.summary.length > 500) errors.push('builder summary is invalid');
  if (value.decision === 'patch') {
    if (!isText(value.patch)) errors.push('builder patch is required');
    else {
      const paths = [...value.patch.matchAll(/^diff --git a\/(.*?) b\/(.*?)$/gm)].flatMap(match => [match[1], match[2]]);
      if (!paths.length) errors.push('builder patch has no git diff headers');
      for (const path of paths) if (isProtectedPath(path, policy)) errors.push(`patch touches protected path: ${path}`);
      if (value.patch.includes('GIT binary patch')) errors.push('binary patches are forbidden');
      if (value.patch.split('\n').filter(line => line.startsWith('+') || line.startsWith('-')).length > policy.maxChangedLines) errors.push('patch exceeds changed-line limit');
    }
  }
  return errors;
}

export function validateCritic(value) {
  const errors = [];
  if (!isObject(value)) return ['critic output must be an object'];
  if (!['approve', 'changes_required', 'escalate'].includes(value.verdict)) errors.push('critic verdict is invalid');
  if (!Array.isArray(value.findings)) errors.push('critic findings must be an array');
  if (value.repair_instruction !== null && !isText(value.repair_instruction)) errors.push('critic repair instruction is invalid');
  return errors;
}
