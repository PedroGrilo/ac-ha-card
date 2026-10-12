#!/usr/bin/env node
// Tiny dependency-free static server for the demo: node scripts/serve.mjs [port]
// Serves the project root, so the demo is at http://localhost:8765/demo/ (add ?dist=1 for the bundle).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // The project root has no index.html: send the preview (and anyone typing /) to the demo.
    if (url.pathname === '/') {
      res.writeHead(302, { location: '/demo/' + url.search, 'cache-control': 'no-store' }).end();
      return;
    }
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (path !== ROOT && !path.startsWith(ROOT + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const s = await stat(path).catch(() => null);
    if (s && s.isDirectory()) {
      // /demo → /demo/ so relative URLs (./demo.js) resolve inside the directory.
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { location: url.pathname + '/' + url.search }).end();
        return;
      }
      path = join(path, 'index.html');
    }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`ACHA demo: http://localhost:${PORT}/demo/  (bundle: /demo/?dist=1)`));
