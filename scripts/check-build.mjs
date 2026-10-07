import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
const root = resolve('dist');
const release = JSON.parse(await readFile(join(root, '.release.json'), 'utf8'));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : join(dir, entry.name)))).flat();
}
const files = await walk(root);
const paths = new Set(files.map(file => '/' + relative(root, file)));
const html = files.filter(file => file.endsWith('.html'));
const errors = [];
const pages = new Map();
const routeFor = file => '/' + relative(root, file).replace(/(^|\/)index\.html$/, '$1');
for (const file of html) {
  const route = routeFor(file);
  const markup = await readFile(file, 'utf8');
  const dom = new JSDOM(markup, { url: release.site + route, virtualConsole: new VirtualConsole() });
  pages.set(route, { doc: dom.window.document, dom });
}
const check = (condition, message) => { if (!condition) errors.push(message); };
const exists = path => paths.has(path) || paths.has(path.replace(/\/$/, '') + '/index.html');
let links = 0;
for (const [route, { doc }] of pages) {
  if (doc.querySelector('meta[http-equiv="refresh"]')) continue;
  check(Boolean(doc.title.trim()), `${route}: missing title`);
  check(Boolean(doc.querySelector('meta[name="description"]')?.content), `${route}: missing description`);
  const indexable = release.production && !release.internalPaths.includes(route);
  check(doc.querySelector('meta[name="robots"]')?.content.includes(indexable ? 'index, follow' : 'noindex'), `${route}: incorrect robots`);
  if (indexable) {
    check(doc.querySelector('link[rel="canonical"]')?.href === release.site + route, `${route}: incorrect canonical`);
  }
  if (!release.internalPaths.includes(route)) {
    check(doc.querySelectorAll('h1').length === 1, `${route}: expected one h1`);
    check(!doc.querySelector('.ds-kicker, .home-section-kicker, .implementation-kicker'), `${route}: section kicker`);
    check(!doc.querySelector('form[data-b24-form-wrapper]'), `${route}: duplicate local CRM form`);
    check(Boolean(doc.querySelector('main [data-service-final-cta]')), `${route}: missing final CTA`);
    if (route !== '/') check(Boolean(doc.querySelector('[aria-label="Хлебные крошки"] [aria-current="page"]')), `${route}: missing current breadcrumb`);
    check(Boolean(doc.querySelector('#mobile-menu-toggle[aria-expanded="false"][aria-controls="mobile-menu"]')), `${route}: menu ARIA`);
    check(Boolean(doc.querySelector('#mobile-menu[hidden]')), `${route}: menu initially visible`);
  }
  for (const schema of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { JSON.parse(schema.textContent); } catch { errors.push(`${route}: invalid JSON-LD`); }
  }
  for (const image of doc.querySelectorAll('img')) check(image.hasAttribute('alt'), `${route}: image without alt`);
  for (const video of doc.querySelectorAll('video')) {
    check(video.getAttribute('preload') === 'none', `${route}: eager video`);
    check(!video.hasAttribute('autoplay'), `${route}: autoplay video`);
  }
  const references = [...doc.querySelectorAll('[href], [src], [poster], [data-src], meta[property="og:image"], meta[name="twitter:image"]')];
  for (const element of references) {
    for (const attr of ['href', 'src', 'poster', 'data-src', 'content']) {
      if (attr === 'content' && !element.matches('meta[property="og:image"], meta[name="twitter:image"]')) continue;
      const value = element.getAttribute(attr);
      if (!value || /^(mailto:|tel:|data:|javascript:)/.test(value)) continue;
      const url = new URL(value, release.site + route);
      if (url.origin !== release.site) continue;
      links++;
      const path = decodeURIComponent(url.pathname);
      check(exists(path), `${route}: missing ${attr} ${path}`);
      if (url.hash && url.hash !== '#') {
        const target = pages.get(path.endsWith('/') || path.endsWith('.html') ? path : path + '/')?.doc;
        if (target) check(Boolean(target.getElementById(decodeURIComponent(url.hash.slice(1)))), `${route}: missing anchor ${value}`);
      }
    }
  }
}
const robots = await readFile(join(root, 'robots.txt'), 'utf8');
check(release.production ? robots.includes(`Sitemap: ${release.site}/sitemap-index.xml`) && !robots.includes('Disallow: /\n') : robots.includes('Disallow: /\n'), 'robots.txt environment mismatch');
if (release.production) {
  const sitemap = await readFile(join(root, 'sitemap-0.xml'), 'utf8');
  for (const [route, { doc }] of pages) {
    if (doc.querySelector('meta[http-equiv="refresh"]') || release.internalPaths.includes(route)) {
      check(!sitemap.includes(`<loc>${release.site}${route}</loc>`), `${route}: internal/redirect in sitemap`);
    } else check(sitemap.includes(`<loc>${release.site}${route}</loc>`), `${route}: absent from sitemap`);
  }
}
for (const { dom } of pages.values()) dom.window.close();
assert.equal(errors.length, 0, '\n' + errors.join('\n'));
console.log(`Validated ${html.length} HTML files and ${links} local references (${release.production ? 'production' : 'staging'}).`);
