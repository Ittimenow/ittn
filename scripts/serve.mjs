import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sirv from 'sirv';

export function createStaticServer(root = resolve('dist')) {
  const release = JSON.parse(readFileSync(resolve(root, '.release.json'), 'utf8'));
  const notFound = readFileSync(resolve(root, '404.html'));
  const serve = sirv(root, { etag: true, maxAge: 0, dotfiles: false, setHeaders(res, path) {
    if (path.includes('/_astro/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } });
  return createServer((req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); decodeURIComponent(url.pathname); }
    catch { res.writeHead(400).end(); return; }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (!release.production || release.internalPaths.includes(url.pathname)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const redirect = release.redirects[url.pathname.replace(/\/$/, '')];
    if (redirect) { res.writeHead(301, { Location: redirect + url.search }).end(); return; }
    const fail = () => {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' });
      res.end(req.method === 'HEAD' ? undefined : notFound);
    };
    if (url.pathname.split('/').some(part => part.startsWith('.')) || ['/_headers', '/_redirects'].includes(url.pathname)) { fail(); return; }
    serve(req, res, fail);
  });
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createStaticServer();
  server.listen(Number(process.env.PORT || 4321), process.env.HOST || '0.0.0.0', () => console.log(`Static site listening on port ${process.env.PORT || 4321}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
}
