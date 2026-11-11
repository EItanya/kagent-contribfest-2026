import './build.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const content = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': types[extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

let port = 4173;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    port += 1;
    server.listen(port, '127.0.0.1');
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
server.on('listening', () => console.log(`Workshop: http://127.0.0.1:${port}\nRefresh the browser after editing.`));
server.listen(port, '127.0.0.1');