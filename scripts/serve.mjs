import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = await realpath(resolve(fileURLToPath(new URL('..', import.meta.url))));
const port = Number(process.env.PORT ?? 8080), host = process.env.HOST || '127.0.0.1';
const base = process.env.BASE_PATH || '/';
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
if (!/^\/(?:[\w-]+\/)*$/.test(base)) throw new Error('BASE_PATH must be / or a slash-terminated path such as /audio-sim/.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const withinRoot = file => file === root || file.startsWith(root + sep);
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (base !== '/' && pathname === base.slice(0, -1)) { response.writeHead(308, { Location: base }); response.end(); return; }
    if (!pathname.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
    const relative = pathname.slice(base.length);
    if (relative.split(/[\\/]/).some(segment => segment.startsWith('.'))) { response.writeHead(403); response.end('Forbidden'); return; }
    let file = resolve(root, relative || '.');
    if (!withinRoot(file)) { response.writeHead(403); response.end('Forbidden'); return; }
    file = await realpath(file);
    if (!withinRoot(file)) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await stat(file)).isDirectory()) file = await realpath(resolve(file, 'index.html'));
    if (!withinRoot(file)) { response.writeHead(403); response.end('Forbidden'); return; }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Not found'); }
});
server.on('error', error => { console.error(`Cannot start preview server: ${error.message}`); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Audio Sim: http://${host}:${server.address().port}${base}\nCtrl+C to stop. Static preview only; no backend or external dependencies.`));
