import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const files = ['src', 'scripts', 'tests'].flatMap(dir => readdirSync(dir).filter(n => /\.(js|mjs)$/.test(n)).map(n => `${dir}/${n}`));
let errors = 0;
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status !== 0) { console.error(result.stderr); errors++; } }
const html = readFileSync('index.html', 'utf8');
for (const match of html.matchAll(/(?:src|href)="(https?:[^\"]+)"/g)) { console.error(`Unexpected external runtime dependency: ${match[1]}`); errors++; }
const ids = [...html.matchAll(/\bid="([^\"]+)"/g)].map(m => m[1]); if (new Set(ids).size !== ids.length) { console.error('Duplicate HTML IDs'); errors++; }
console.log(`${files.length} JS files checked; ${ids.length} unique HTML IDs; ${errors} error(s).`); process.exitCode = errors ? 1 : 0;

// Keep the short user docs navigable without crawling unrelated web resources.
const docs = ['README.md', ...readdirSync('docs').filter(name => name.endsWith('.md')).map(name => `docs/${name}`)];
let broken = 0;
for (const file of [...docs, 'index.html']) {
  const text = readFileSync(file, 'utf8');
  const links = file.endsWith('.html') ? [...text.matchAll(/href="([^"#]+)"/g)].map(m=>m[1]) : [...text.matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]);
  for (const link of links) {
    if (/^[a-z]+:/i.test(link) || link.startsWith('#')) continue;
    if (!existsSync(resolve(dirname(file),link.split('#')[0]))) { console.error(`Broken documentation link in ${file}: ${link}`); broken++; }
  }
}
console.log(`${docs.length} Markdown documents checked; ${broken} broken local link(s).`);
process.exitCode = errors || broken ? 1 : 0;
