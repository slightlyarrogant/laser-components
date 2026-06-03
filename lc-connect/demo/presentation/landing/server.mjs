// Tiny static server for the LC Connect customer landing page.
// Serves this directory on PORT (default 3010) with HTTP range support so the
// embedded film seeks/streams. Completely separate from the LC Connect MCP
// server (port 3003) — exposing this must not affect the connector.
//
//   node server.mjs            # PORT=3010

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3010);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.webm': 'video/webm', '.ico': 'image/x-icon',
};

function safePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const full = path.normalize(path.join(ROOT, p));
  if (!full.startsWith(ROOT)) return null; // no traversal
  return full;
}

const server = http.createServer((req, res) => {
  const file = safePath(req.url || '/');
  if (!file) { res.writeHead(403); return res.end('forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': 'public, max-age=3600',
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' });
      fs.createReadStream(file).pipe(res);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`[landing] serving ${ROOT} on http://127.0.0.1:${PORT}`));
