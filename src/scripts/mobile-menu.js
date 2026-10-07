const bound = new WeakSet();
export function bindMobileMenu(doc = document) {
  const button = doc.getElementById('mobile-menu-toggle');
  const menu = doc.getElementById('mobile-menu');
  if (!button || !menu || bound.has(button)) return;
  bound.add(button);
  const win = doc.defaultView;
  let previousOverflow = '';
  const isOpen = () => button.getAttribute('aria-expanded') === 'true';
  function close(restoreFocus = false) {
    if (!isOpen()) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Открыть меню');
    doc.documentElement.style.overflow = previousOverflow;
    if (restoreFocus) button.focus();
  }
  button.addEventListener('click', () => {
    if (isOpen()) { close(true); return; }
    previousOverflow = doc.documentElement.style.overflow;
    doc.documentElement.style.overflow = 'hidden';
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-label', 'Закрыть меню');
    menu.querySelector('a')?.focus();
  });
  function onClick(event) {
    if (event.target.closest('#mobile-menu a')) close();
    else if (!menu.contains(event.target) && !button.contains(event.target)) close();
  }
  function onKey(event) {
    if (!isOpen()) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.key === 'Tab') {
      const items = [button, ...menu.querySelectorAll('a[href], button:not([disabled])')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  const onResize = () => { if (win.innerWidth >= 768) close(); };
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  win.addEventListener('resize', onResize);
  doc.addEventListener('astro:before-swap', () => {
    close();
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('keydown', onKey);
    win.removeEventListener('resize', onResize);
  }, { once: true });
}
