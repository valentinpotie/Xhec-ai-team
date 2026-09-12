import { readFile } from 'node:fs/promises';

export async function loadConfig() {
  const config = { ...process.env };
  if (!config.OPENAI_API_KEY || !config.PROJECTS_TOKEN) {
    try {
      const local = JSON.parse(await readFile(new URL('../secrets.local.json', import.meta.url), 'utf8'));
      config.OPENAI_API_KEY ||= local.openai_key;
      config.PROJECTS_TOKEN ||= local.github_token;
      config.GITHUB_TOKEN ||= local.github_token;
      config.PROJECT_OWNER ||= local.github_owner;
      config.PROJECT_NUMBER ||= local.github_project;
    } catch { /* GitHub Actions uses environment secrets; local config is optional. */ }
  }
  return config;
}
