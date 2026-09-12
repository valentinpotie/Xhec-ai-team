import { execFileSync } from 'node:child_process';
import { loadConfig } from './config.mjs';
import { claimItem, listApprovedItems, projectByOwnerAndNumber, setItemStatusByName } from './project.mjs';
import { runDelivery } from './run.mjs';

const config = await loadConfig();
Object.assign(process.env, Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined)));
const dryRun = process.argv.includes('--dry-run');
const selectedId = process.env.PROJECT_ITEM_ID;
const run = (file, args) => execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env }).trim();

if (!config.PROJECT_OWNER || !config.PROJECT_NUMBER) throw new Error('PROJECT_OWNER and PROJECT_NUMBER are required');
const project = await projectByOwnerAndNumber(config.PROJECT_OWNER, Number(config.PROJECT_NUMBER));
const items = (await listApprovedItems(project.id)).filter(item => !selectedId || item.id === selectedId);
if (!items.length) { console.log('No Approved for delivery cards found.'); process.exit(0); }

for (const item of items) {
  if (!dryRun) await claimItem(project.id, item.id);
  try {
    const result = await runDelivery(item, { dryRun });
    console.log(JSON.stringify({ item: item.id, ...result }, null, 2));
    if (dryRun) continue;
    if (result.outcome !== 'approved_for_pr') {
      await setItemStatusByName(project.id, item.id, 'Needs human review');
      continue;
    }
    run('git', ['config', 'user.name', 'T-REX Delivery Agent']);
    run('git', ['config', 'user.email', 'delivery-agent@users.noreply.github.com']);
    run('git', ['add', '--all']);
    run('git', ['commit', '-m', `feat: deliver ${item.content.title}`]);
    run('git', ['push', '--set-upstream', 'origin', result.branch]);
    const prUrl = run('gh', ['pr', 'create', '--base', 'main', '--head', result.branch, '--title', item.content.title, '--body', `Automated T-REX delivery for Project item ${item.id}. Independent critic approved the final diff.`]);
    run('gh', ['pr', 'merge', prUrl, '--squash', '--auto']);
    console.log(`Auto-merge enabled: ${prUrl}`);
  } catch (error) {
    console.error(`Delivery failed for ${item.id}: ${error.message}`);
    if (!dryRun) await setItemStatusByName(project.id, item.id, 'Delivery failed');
  }
}
