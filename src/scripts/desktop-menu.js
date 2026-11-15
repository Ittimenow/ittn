const bound = new WeakSet();

export function bindDesktopMenu(doc = document) {
  const group = doc.querySelector('[data-desktop-services]');
  const trigger = group?.querySelector('[data-services-trigger]');
  const panel = doc.getElementById('desktop-services-panel');
  if (!group || !trigger || !panel || bound.has(group)) return;
  bound.add(group);
  const win = doc.defaultView;
  const abort = new win.AbortController();
  const options = { signal: abort.signal };
  let hovered = false;
  let dismissed = false;
  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    panel.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
  };
  const open = () => { if (win.innerWidth >= 768) { dismissed = false; setOpen(true); } };
  const close = (restoreFocus = false) => {
    dismissed = true;
    setOpen(false);
    if (restoreFocus) trigger.focus();
  };

  group.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    open();
  }, options);
  group.addEventListener('pointerleave', () => {
    hovered = false;
    if (!group.contains(doc.activeElement)) { dismissed = false; setOpen(false); }
  }, options);
  group.addEventListener('focusin', (event) => {
    if (!group.contains(event.relatedTarget)) dismissed = false;
    if (!dismissed) open();
  }, options);
  group.addEventListener('focusout', (event) => {
    if (!group.contains(event.relatedTarget)) {
      if (!hovered || dismissed) setOpen(false);
      dismissed = false;
    }
  }, options);
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === ' ') {
      event.preventDefault();
      open();
      panel.querySelector('a[href]')?.focus();
    }
  }, options);
  // The current Services page uses a button; other pages keep the catalogue link.
  trigger.addEventListener('click', () => {
    if (trigger.tagName === 'BUTTON') open();
  }, options);
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    close(panel.contains(doc.activeElement));
  }, options);
  doc.addEventListener('click', (event) => {
    if (!group.contains(event.target)) close();
  }, options);
  win.addEventListener('resize', () => {
    if (win.innerWidth < 768) { hovered = false; close(); }
  }, options);
  doc.addEventListener('astro:before-swap', () => {
    close();
    abort.abort();
    bound.delete(group);
  }, { once: true });
}
