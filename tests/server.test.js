import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('static preview supports a project subpath, safe asset reads and hidden-file denial', async t => {
  const processHandle = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0', HOST: '127.0.0.1', BASE_PATH: '/audio-sim/' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { if (processHandle.exitCode === null) { const exit = once(processHandle, 'exit'); processHandle.kill(); await exit; } });
  const url = await new Promise((resolve, reject) => {
    let text = ''; const timer = setTimeout(() => reject(new Error('Preview server startup timed out')), 5000);
    processHandle.once('error', error => { clearTimeout(timer); reject(error); });
    processHandle.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited with ${code}`)); });
    processHandle.stdout.on('data', data => {
      text += data; const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/audio-sim\//);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  const page = await fetch(url); assert.equal(page.status, 200); assert.match(await page.text(), /src\/app\.js/);
  const script = await fetch(`${url}src/app.js`); assert.equal(script.status, 200); assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(script.headers.get('x-content-type-options'), 'nosniff');
  const head = await fetch(`${url}style.css`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const post = await fetch(url, { method: 'POST' }); assert.equal(post.status, 405);
  assert.equal((await fetch(`${url}.git/config`)).status, 403);
  assert.equal((await fetch(`${url}%2egit/config`)).status, 403);
  assert.equal((await fetch(`${url}missing.js`)).status, 404);
  const origin = new URL(url).origin; assert.equal((await fetch(`${origin}/`)).status, 404);
  const redirect = await fetch(url.slice(0, -1), { redirect: 'manual' }); assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/audio-sim/');
});
