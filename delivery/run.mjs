import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import policy from './policy.mjs';
import { requestStructuredOutput } from './openai.mjs';
import { applyCheckedPatch, normalizePatch } from './patch.mjs';
import { validateBuilder, validateCritic, validatePlan } from './schemas.mjs';

const schema = (properties, required) => ({ type: 'object', additionalProperties: false, properties, required });
const planSchema = schema({ decision: { type: 'string', enum: ['proceed', 'escalate'] }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, steps: { type: 'array', items: { type: 'string' } }, test_commands: { type: 'array', items: { type: 'string' } }, risks: { type: 'array', items: { type: 'string' } } }, ['decision', 'summary', 'files', 'steps', 'test_commands', 'risks']);
const builderSchema = schema({ decision: { type: 'string', enum: ['patch', 'escalate'] }, summary: { type: 'string' }, patch: { type: 'string' } }, ['decision', 'summary', 'patch']);
const criticSchema = schema({ verdict: { type: 'string', enum: ['approve', 'changes_required', 'escalate'] }, findings: { type: 'array', items: schema({ severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, reason: { type: 'string' } }, ['severity', 'file', 'reason']) }, repair_instruction: { type: ['string', 'null'] } }, ['verdict', 'findings', 'repair_instruction']);

const output = command => execFileSync(command[0], command.slice(1), { encoding: 'utf8' });
const sourceFor = async files => Promise.all(files.slice(0, 8).map(async file => {
  const content = await readFile(file, 'utf8');
  if (content.length <= 30000) return { file, content };
  const lines = content.split('\n');
  const selected = new Set();
  lines.forEach((line, index) => {
    if (/filter|toolbar|preset|saved/i.test(line)) for (let cursor = Math.max(0, index - 35); cursor <= Math.min(lines.length - 1, index + 45); cursor++) selected.add(cursor);
  });
  const snippets = [...selected].sort((a, b) => a - b).map(index => `${index + 1}: ${lines[index]}`).join('\n');
  return { file, content: snippets.slice(0, 50000), note: 'Line-numbered excerpts selected for feature-relevant symbols.' };
}));

export async function runDelivery(item, { dryRun = false } = {}) {
  const card = { title: item.content.title, body: item.content.body || '', project_item_id: item.id };
  const tree = output(['git', 'ls-files']).split('\n').filter(Boolean).slice(0, 500);
  const plan = await requestStructuredOutput({ name: 'delivery_plan', schema: planSchema, instructions: 'You are a software delivery planner. Return only the schema. Escalate only destructive, credential-related, infrastructure, or genuinely unimplementable work. A card that names its target file and explicitly forbids sensitive paths is eligible to proceed; do not escalate it for generic regression risk. Select tests only from the supplied policy.', input: JSON.stringify({ card, tree, policy }) });
  const planErrors = validatePlan(plan, policy);
  if (planErrors.length || plan.decision === 'escalate') return { outcome: 'review_required', reason: planErrors.join('; ') || plan.summary, plan };
  if (dryRun) return { outcome: 'dry_run', plan };

  const branch = `codex/delivery-${item.id}`;
  output(['git', 'checkout', '-b', branch]);
  const builder = await requestStructuredOutput({ name: 'delivery_patch', schema: builderSchema, instructions: 'You implement only the approved plan. When decision is patch, patch MUST be a complete unified Git diff beginning exactly with "diff --git a/"; never use prose, explanations, or Markdown fences. Use only paths from the approved plan. Never modify protected files or invoke commands.', input: JSON.stringify({ card, plan, sources: await sourceFor(plan.files), policy }) });
  builder.patch = normalizePatch(builder.patch);
  const builderErrors = validateBuilder(builder, policy);
  if (builderErrors.length || builder.decision === 'escalate') return { outcome: 'review_required', reason: builderErrors.join('; ') || builder.summary, plan, builder };
  applyCheckedPatch(builder.patch, policy, process.cwd());
  const testOutput = plan.test_commands.map(command => output(command.split(' '))).join('\n');
  const diff = output(['git', 'diff', '--no-ext-diff']);
  const critic = await requestStructuredOutput({ name: 'delivery_critic', schema: criticSchema, instructions: 'You are an independent adversarial code reviewer. Compare the card, plan, patch, and test output. Approve only when all requirements and safety conditions are met.', input: JSON.stringify({ card, plan, diff, testOutput, policy }) });
  const criticErrors = validateCritic(critic);
  if (criticErrors.length || critic.verdict !== 'approve') return { outcome: 'review_required', reason: criticErrors.join('; ') || critic.repair_instruction || critic.verdict, plan, critic, branch };
  return { outcome: 'approved_for_pr', plan, builder, critic, testOutput, branch };
}
