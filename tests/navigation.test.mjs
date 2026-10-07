import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindMobileMenu } from '../src/scripts/mobile-menu.js';
function setup() {
  const dom = new JSDOM('<button id="mobile-menu-toggle" aria-expanded="false"></button><nav id="mobile-menu" hidden><a href="/services/">Services</a><a href="/about/">About</a></nav>', { url: 'https://example.com/' });
  Object.defineProperty(dom.window, 'innerWidth', { value: 320, writable: true });
  const doc = dom.window.document;
  bindMobileMenu(doc);
  bindMobileMenu(doc);
  return { dom, doc, button: doc.querySelector('button'), menu: doc.querySelector('nav') };
}
test('mobile menu keeps focus, closes with Escape and restores scroll', () => {
  const { dom, doc, button, menu } = setup();
  button.click();
  assert.equal(menu.hidden, false);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.activeElement, menu.querySelector('a'));
  assert.equal(doc.documentElement.style.overflow, 'hidden');
  menu.lastElementChild.focus();
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  assert.equal(doc.activeElement, button);
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menu.hidden, true);
  assert.equal(doc.activeElement, button);
  assert.equal(doc.documentElement.style.overflow, '');
  dom.window.close();
});
test('link selection, route swap and desktop resize close the mobile menu', () => {
  const { dom, doc, button, menu } = setup();
  menu.addEventListener('click', event => event.preventDefault());
  button.click(); menu.querySelector('a').click(); assert.equal(menu.hidden, true);
  button.click(); dom.window.innerWidth = 1200; dom.window.dispatchEvent(new dom.window.Event('resize')); assert.equal(menu.hidden, true);
  dom.window.innerWidth = 320; button.click(); doc.dispatchEvent(new dom.window.Event('astro:before-swap'));
  assert.equal(menu.hidden, true); assert.equal(doc.documentElement.style.overflow, '');
  dom.window.close();
});
