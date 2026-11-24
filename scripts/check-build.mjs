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
  // DOM parsers silently move trailing scripts into body, hiding invalid source HTML.
  const htmlEnd = markup.lastIndexOf('</html>');
  if (!release.internalPaths.includes(route) && htmlEnd !== -1 && markup.slice(htmlEnd + 7).trim()) {
    errors.push(`${route}: content after closing html`);
  }
  const dom = new JSDOM(markup, { url: release.site + route, virtualConsole: new VirtualConsole() });
  pages.set(route, { doc: dom.window.document, dom });
}
const check = (condition, message) => { if (!condition) errors.push(message); };
const exists = path => paths.has(path) || paths.has(path.replace(/\/$/, '') + '/index.html');
let links = 0;
const seenTitles = new Map();
const seenDescriptions = new Map();
const analyticsSources = new Set();
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
    for (const image of doc.querySelectorAll('img')) {
      check(Boolean(image.getAttribute('src')?.trim() || image.getAttribute('srcset')?.trim()), `${route}: image without src/srcset`);
      check(!image.hasAttribute('sizes') || Boolean(image.getAttribute('srcset')?.trim()), `${route}: image sizes without srcset`);
      check(image.alt === image.alt.normalize('NFC'), `${route}: image alt is not NFC`);
    }
    check(!doc.querySelector('div[aria-label]:not([role]), div[aria-label][role="generic"]'), `${route}: aria-label on generic div`);
    for (const element of doc.querySelectorAll('article, section')) {
      check(Boolean(element.querySelector('h1, h2, h3, h4, h5, h6')), `${route}: ${element.localName} without heading: ${element.className}`);
    }
    for (const card of doc.querySelectorAll('.case-team-card')) {
      check(Boolean(card.querySelector('h3')), `${route}: team heading must follow h2 without skipping a level`);
    }
    check(doc.querySelectorAll('h1').length === 1, `${route}: expected one h1`);
    check(doc.querySelectorAll('title').length === 1, `${route}: expected one title`);
    check(doc.querySelectorAll('meta[name="description"]').length === 1, `${route}: expected one description`);
    for (const [seen, value, field] of [
      [seenTitles, doc.title.trim(), 'title'],
      [seenDescriptions, doc.querySelector('meta[name="description"]')?.content.trim(), 'description'],
    ]) {
      check(!seen.has(value), `${route}: duplicate ${field} with ${seen.get(value)}`);
      seen.set(value, route);
    }

    for (const link of doc.querySelectorAll('a[href]')) {
      const labelledBy = (link.getAttribute('aria-labelledby') || '').split(/\s+/).some(id => doc.getElementById(id)?.textContent.trim());
      const name = link.textContent.trim() || link.getAttribute('aria-label')?.trim() || labelledBy
        || link.getAttribute('title')?.trim() || [...link.querySelectorAll('img')].some(image => image.alt.trim());
      check(Boolean(name), `${route}: unnamed link ${link.getAttribute('href')}`);
    }

    check(!doc.querySelector('.ds-kicker, .home-section-kicker, .implementation-kicker'), `${route}: section kicker`);
    check(!doc.querySelector('form[data-b24-form-wrapper]'), `${route}: duplicate local CRM form`);
    check(Boolean(doc.querySelector('main [data-service-final-cta]')), `${route}: missing final CTA`);
    if (route !== '/') check(Boolean(doc.querySelector('[aria-label="Хлебные крошки"] [aria-current="page"]')), `${route}: missing current breadcrumb`);
    check(Boolean(doc.querySelector('#mobile-menu-toggle[aria-expanded="false"][aria-controls="mobile-menu"]')), `${route}: menu ARIA`);
    check(Boolean(doc.querySelector('#mobile-menu[hidden]')), `${route}: menu initially visible`);
    check(Boolean(doc.querySelector('[data-services-trigger][aria-expanded="false"][aria-controls="desktop-services-panel"]')), `${route}: desktop menu ARIA`);
    check(Boolean(doc.querySelector('#desktop-services-panel[hidden]')), `${route}: desktop submenu initially visible`);
  }
  if (!release.internalPaths.includes(route)) {
    check(Boolean(doc.querySelector('script[data-site-analytics]')) === release.production, `${route}: analytics environment mismatch`);
  }
  // A static noscript pixel would bypass the runtime origin guard in local previews.
  check(!doc.documentElement.outerHTML.includes('mc.yandex.ru/watch/'), `${route}: analytics pixel bypasses origin check`);
  for (const script of doc.querySelectorAll('script[data-site-analytics]')) analyticsSources.add(script.textContent);
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
      if (!release.internalPaths.includes(route) && attr === 'href' && element.matches('a') && paths.has(path + '/index.html')) {
        check(false, `${route}: internal link requires trailing slash: ${value}`);
      }

      check(exists(path), `${route}: missing ${attr} ${path}`);
      if (url.hash && url.hash !== '#') {
        const target = pages.get(path.endsWith('/') || path.endsWith('.html') ? path : path + '/')?.doc;
        if (target) check(Boolean(target.getElementById(decodeURIComponent(url.hash.slice(1)))), `${route}: missing anchor ${value}`);
      }
    }
  }
}
for (const source of analyticsSources) {
  const productionURL = new URL('/analytics-origin-check/?source=build-test', release.site);
  const foreignPortURL = new URL(productionURL);
  foreignPortURL.port = productionURL.port === '444' ? '445' : '444';
  const blockedURLs = [
    'http://localhost:3040/',
    'http://127.0.0.1:4327/',
    'http://[::1]:4327/',
    'https://ittimenow-ittn-020d.twc1.net/',
    `https://preview.${productionURL.hostname}/`,
    `https://${productionURL.hostname}.invalid/`,
    productionURL.href.replace(/^https:/, 'http:'),
    foreignPortURL.href,
  ];
  for (const [url, allowed] of [[productionURL.href, true], ...blockedURLs.map(url => [url, false])]) {
    // Execute only the built inline snippet. Default resources are disabled, so
    // even the allowed origin cannot fetch tag.js or send analytics requests.
    const dom = new JSDOM('<!doctype html><script></script>', { url, runScripts: 'outside-only' });
    try {
      dom.window.eval(source);
      const tags = dom.window.document.querySelectorAll('script[src="https://mc.yandex.ru/metrika/tag.js"]');
      if (allowed) {
        const calls = dom.window.ym?.a ?? [];
        check(tags.length === 1, `${url}: production analytics loader missing`);
        check(calls.length === 1 && calls[0][0] === 91660098 && calls[0][1] === 'init'
          && calls[0][2]?.url === dom.window.location.href, `${url}: production analytics init mismatch`);
      } else {
        check(tags.length === 0 && dom.window.ym === undefined, `${url}: analytics enabled outside production origin`);
      }
    } catch (error) {
      errors.push(`${url}: analytics script failed: ${error.message}`);
    } finally {
      dom.window.close();
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
