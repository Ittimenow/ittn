import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { bindConsultation } from '../src/scripts/consultation.js';
function setup(timeoutMs = 5000) {
  const dom = new JSDOM('<button data-b24-form-trigger>Consult</button><div id="b24-integration"><button id="b24-native-trigger" hidden></button><dialog id="consultation-status"><p id="consultation-status-message"></p><a href="mailto:hello@ittimenow.com">Email</a><button id="consultation-status-close">Close</button></dialog></div>');
  const doc = dom.window.document, dialog = doc.querySelector('dialog');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new dom.window.Event('close')); };
  bindConsultation(doc, { timeoutMs });
  return { dom, doc, dialog, click: () => doc.querySelector('[data-b24-form-trigger]').click() };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
test('CRM loads on demand without an intermediate dialog, then opens only the initialized form', async () => {
  const { dom, doc, dialog, click } = setup();
  assert.equal(doc.querySelectorAll('script').length, 0);
  click(); click();
  const trigger = doc.querySelector('[data-b24-form-trigger]');
  assert.equal(doc.querySelectorAll('script').length, 1);
  assert.equal(dialog.open, false);
  assert.equal(trigger.hasAttribute('data-b24-loading'), true);
  assert.equal(trigger.getAttribute('aria-busy'), 'true');
  assert.match(trigger.getAttribute('aria-label'), /Открываем форму/);
  let opens = 0;
  const form = { identification: { id: '21' }, getId: () => '21', show() { opens++; }, hide() {} };
  doc.getElementById('b24-native-trigger').addEventListener('click', () => {
    dom.window.dispatchEvent(new dom.window.CustomEvent('b24:form:init', { detail: { object: form } }));
  });
  assert.equal(doc.querySelector('script').nextElementSibling.id, 'b24-native-trigger');
  doc.querySelector('script').setAttribute('data-b24-loaded', 'true');
  await tick();
  assert.equal(opens, 1); assert.equal(dialog.open, false);
  assert.equal(trigger.hasAttribute('data-b24-loading'), false);
  assert.equal(trigger.hasAttribute('aria-busy'), false);
  assert.equal(trigger.hasAttribute('aria-label'), false);
  click(); assert.equal(opens, 2); assert.equal(doc.querySelectorAll('script').length, 1);
  dom.window.close();
});
test('blocked CRM gives contact fallback, never a false success', () => {
  const { dom, doc, dialog, click } = setup(); click();
  assert.equal(dialog.open, false);
  doc.querySelector('script').dispatchEvent(new dom.window.Event('error'));
  assert.equal(dialog.open, true);
  assert.equal(doc.querySelector('[data-b24-form-trigger]').hasAttribute('data-b24-loading'), false);
  assert.match(doc.querySelector('[role="status"]')?.textContent || doc.getElementById('consultation-status-message').textContent, /недоступна/);
  assert.ok(dialog.querySelector('a[href^="mailto:"]'));
  dom.window.close();
});
test('timeout and cancellation prevent a late popup from interrupting the visitor', async () => {
  const { dom, doc, dialog, click } = setup(5); click();
  assert.equal(dialog.open, false);
  await tick();
  assert.equal(dialog.open, true);
  assert.match(doc.getElementById('consultation-status-message').textContent, /недоступна/);
  doc.getElementById('consultation-status-close').click();
  let opens = 0;
  dom.window.dispatchEvent(new dom.window.CustomEvent('b24:form:init', { detail: { object: { identification: { id: 21 }, getId: () => '21', show() { opens++; } } } }));
  await tick(); assert.equal(opens, 0); assert.equal(dialog.open, false);
  dom.window.close();
});

test('a network error releases the loader and a new click opens one recovered form', async () => {
  const { dom, doc, dialog, click } = setup();
  click();
  const failed = doc.querySelector('script');
  failed.dispatchEvent(new dom.window.Event('error'));
  assert.equal(dialog.open, true);
  assert.equal(doc.querySelectorAll('script').length, 0);
  dialog.close();
  click(); click();
  const retry = doc.querySelector('script');
  assert.notEqual(retry, failed);
  assert.equal(doc.querySelectorAll('script').length, 1);
  let opens = 0, nativeClicks = 0;
  doc.getElementById('b24-native-trigger').addEventListener('click', () => {
    nativeClicks++;
    dom.window.dispatchEvent(new dom.window.CustomEvent('b24:form:init', {
      detail: { object: { identification: { id: 21 }, show() { opens++; } } },
    }));
  });
  failed.setAttribute('data-b24-loaded', 'true');
  failed.dispatchEvent(new dom.window.Event('error'));
  await tick();
  assert.equal(nativeClicks, 0);
  assert.equal(dialog.open, false);
  retry.setAttribute('data-b24-loaded', 'true');
  await tick();
  assert.equal(nativeClicks, 1);
  assert.equal(opens, 1);
  assert.equal(doc.querySelector('[data-b24-form-trigger]').hasAttribute('aria-busy'), false);
  dom.window.close();
});

test('a loader timeout allows a fresh request without reacting to the abandoned loader', async () => {
  const { dom, doc, dialog, click } = setup(5);
  click();
  const failed = doc.querySelector('script');
  await tick();
  assert.equal(dialog.open, true);
  assert.equal(failed.isConnected, false);
  dialog.close();
  click();
  assert.notEqual(doc.querySelector('script'), failed);
  let nativeClicks = 0;
  doc.getElementById('b24-native-trigger').addEventListener('click', () => nativeClicks++);
  failed.setAttribute('data-b24-loaded', 'true');
  await Promise.resolve();
  assert.equal(nativeClicks, 0);
  dom.window.close();
});
