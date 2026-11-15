import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindMobileMenu } from '../src/scripts/mobile-menu.js';
import { bindDesktopMenu } from '../src/scripts/desktop-menu.js';
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

function desktopSetup(current = false) {
  const tag = current ? 'button' : 'a';
  const dom = new JSDOM(`<div data-desktop-services><${tag} ${current ? 'type="button"' : 'href="/services/"'} data-services-trigger aria-expanded="false" aria-controls="desktop-services-panel">Services</${tag}><div id="desktop-services-panel" hidden><a href="/services/sites/">Sites</a><a href="/services/rbs/">RBS</a></div></div><button id="outside">Outside</button>`);
  const doc = dom.window.document;
  Object.defineProperty(dom.window, 'innerWidth', { value: 1280, writable: true });
  bindDesktopMenu(doc); bindDesktopMenu(doc);
  const group = doc.querySelector('[data-desktop-services]');
  const trigger = doc.querySelector('[data-services-trigger]');
  const panel = doc.getElementById('desktop-services-panel');
  const key = (target, value) => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  return { dom, doc, group, trigger, panel, key };
}

test('desktop submenu closes on Escape while hovered and focused, restores focus, and reopens with ArrowDown', () => {
  const { dom, doc, group, trigger, panel, key } = desktopSetup();
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  assert.equal(panel.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  panel.querySelector('a').focus();
  key(doc, 'Escape');
  assert.equal(panel.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(doc.activeElement, trigger);
  key(trigger, 'ArrowDown');
  assert.equal(panel.hidden, false);
  assert.equal(doc.activeElement, panel.querySelector('a'));
  key(doc, 'Escape');
  group.dispatchEvent(new dom.window.Event('pointerleave'));
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  assert.equal(panel.hidden, false);
  dom.window.close();
});

test('desktop submenu follows focus and closes on outside click, mobile resize and route disposal', () => {
  const { dom, doc, group, trigger, panel } = desktopSetup();
  trigger.focus();
  assert.equal(panel.hidden, false);
  doc.getElementById('outside').focus();
  assert.equal(panel.hidden, true);
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  doc.getElementById('outside').click();
  assert.equal(panel.hidden, true);
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  dom.window.innerWidth = 767;
  dom.window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(panel.hidden, true);
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  assert.equal(panel.hidden, true);
  dom.window.innerWidth = 1280;
  trigger.focus();
  assert.equal(panel.hidden, false);
  doc.dispatchEvent(new dom.window.Event('astro:before-swap'));
  assert.equal(panel.hidden, true);
  group.dispatchEvent(new dom.window.Event('pointerenter'));
  assert.equal(panel.hidden, true);
  dom.window.close();
});

test('current-page desktop Services button opens by click and Space, and Escape preserves its focus', () => {
  const { dom, doc, trigger, panel, key } = desktopSetup(true);
  trigger.focus();
  key(doc, 'Escape');
  assert.equal(doc.activeElement, trigger);
  trigger.click();
  assert.equal(panel.hidden, false);
  key(doc, 'Escape');
  key(trigger, ' ');
  assert.equal(panel.hidden, false);
  assert.equal(doc.activeElement, panel.querySelector('a'));
  dom.window.close();
});
