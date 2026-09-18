import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const files = ['src', 'scripts', 'tests'].flatMap(dir => readdirSync(dir).filter(n => /\.(js|mjs)$/.test(n)).map(n => `${dir}/${n}`));
let errors = 0;
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status !== 0) { console.error(result.stderr); errors++; } }
const html = readFileSync('index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="(https?:[^\"]+)"/g)) { console.error(`Unexpected external runtime dependency: ${match[1]}`); errors++; }
const ids = [...html.matchAll(/\bid="([^\"]+)"/g)].map(m => m[1]); if (new Set(ids).size !== ids.length) { console.error('Duplicate HTML IDs'); errors++; }
console.log(`${files.length} JS files checked; ${ids.length} unique HTML IDs; ${errors} error(s).`); process.exitCode = errors ? 1 : 0;
