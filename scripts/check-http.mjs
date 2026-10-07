import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { redirects } from '../config/release.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4321';
const production = process.argv.includes('--production');
const manifest = process.argv.indexOf('--routes');
const routes = manifest >= 0
  ? JSON.parse(await readFile(process.argv[manifest + 1], 'utf8'))
  : (await readdir('dist', { recursive: true })).filter(path => path.endsWith('.html')).map(path => '/' + path.replace(/(^|\/)index\.html$/, '$1'));
assert.ok(Array.isArray(routes) && routes.length > 0 && routes.every(route => typeof route === 'string' && route.startsWith('/') && !route.startsWith('//')), 'Invalid HTTP route manifest');
for (const route of routes) {
  const response = await fetch(base + route, { redirect: 'manual' });
  const redirect = redirects[route.replace(/\/$/, '')];
  assert.equal(response.status, redirect ? 301 : 200, route);
  if (redirect) assert.equal(response.headers.get('location'), redirect);
  if (!production) assert.match(response.headers.get('x-robots-tag'), /noindex/, route);
  await response.arrayBuffer();
}
const missing = await fetch(base + '/missing-release-smoke-test/');
assert.equal(missing.status, 404);
assert.match(missing.headers.get('x-robots-tag'), /noindex/);
await missing.arrayBuffer();
const home = await fetch(base);
assert.equal(home.headers.get('x-robots-tag'), production ? null : 'noindex, nofollow');
await home.arrayBuffer();
console.log(`HTTP smoke passed for ${routes.length} routes, redirects and 404 (${production ? 'production' : 'staging'}).`);
