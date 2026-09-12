import { readFile } from 'node:fs/promises';

export default JSON.parse(await readFile(new URL('./policy.json', import.meta.url), 'utf8'));
