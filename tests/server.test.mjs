import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStaticServer } from '../scripts/serve.mjs';
import { releaseConfig } from '../config/release.mjs';
test('static server: status codes, redirects, metadata isolation, cache and environment headers', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ittn-server-'));
  await mkdir(join(root, '_astro'));
  await mkdir(join(root, 'services', 'sites'), { recursive: true });
  const release = releaseConfig({ DEPLOY_ENV: 'production', SITE_URL: 'https://example.com' });
  await Promise.all(Object.entries({ '.release.json': JSON.stringify(release), '404.html': '<h1>Not found</h1>', 'index.html': '<h1>Home</h1>', '_headers': 'private config', '_astro/main.css': 'body{}', 'services/sites/index.html': '<h1>Sites</h1>' }).map(([path, data]) => writeFile(join(root, path), data)));
  const server = createStaticServer(root);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(base); assert.equal(response.status, 200); assert.equal(response.headers.get('x-robots-tag'), null);
  for (const path of ['/services/web', '/services/web/']) {
    response = await fetch(base + path + '?utm_source=test', { redirect: 'manual' });
    assert.equal(response.status, 301); assert.equal(response.headers.get('location'), '/services/sites/?utm_source=test');
  }
  response = await fetch(base + '/services/sites/'); assert.equal(response.status, 200);
  for (const path of ['/missing/', '/_headers', '/.release.json', '/%2erelease.json']) {
    response = await fetch(base + path); assert.equal(response.status, 404, path); assert.match(response.headers.get('x-robots-tag'), /noindex/);
  }
  response = await fetch(base + '/_astro/main.css'); assert.match(response.headers.get('cache-control'), /immutable/); assert.match(response.headers.get('content-type'), /css/); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  response = await fetch(base, { method: 'POST' }); assert.equal(response.status, 405);
  response = await fetch(base + '/missing/', { method: 'HEAD' }); assert.equal(response.status, 404); assert.equal(await response.text(), '');
  await writeFile(join(root, '.release.json'), JSON.stringify(releaseConfig({})));
  const stage = createStaticServer(root);
  await new Promise((resolve, reject) => { stage.once('error', reject); stage.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { stage.closeAllConnections(); await new Promise(resolve => stage.close(resolve)); });
  response = await fetch(`http://127.0.0.1:${stage.address().port}/`);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
});
