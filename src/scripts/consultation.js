// The form remains owned by Bitrix24; no local fields or success state duplicate it.
export function bindConsultation(doc = document, { timeoutMs = 15000 } = {}) {
  const win = doc.defaultView;
  let form;
  let requested = false;
  let ready = false;
  let pending = false;
  let timer;
  let opener;
  const dialog = () => doc.getElementById('consultation-status');
  const message = (text) => { doc.getElementById('consultation-status-message').textContent = text; };
  const cancel = () => { pending = false; win.clearTimeout(timer); };
  const fail = () => {
    cancel();
    message('Форма сейчас недоступна. Напишите нам — поможем обсудить вашу задачу.');
  };
  function openForm() {
    cancel();
    dialog()?.close();
    form.show();
  }
  win.addEventListener('b24:form:init', (event) => {
    const candidate = event.detail?.object;
    if (String(candidate?.identification?.id) !== '21') return;
    // init is emitted before the vendor renders its DOM.
    win.setTimeout(() => {
      form = candidate;
      if (pending) openForm();
    }, 0);
  });
  win.addEventListener('b24:form:hide', () => { if (opener?.isConnected) opener.focus(); });
  doc.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-b24-form-trigger]');
    if (!trigger) return;
    event.preventDefault();
    opener = trigger;
    if (form) { openForm(); return; }
    pending = true;
    message('Открываем форму консультации…');
    if (!dialog().open) dialog().showModal();
    win.clearTimeout(timer);
    timer = win.setTimeout(fail, timeoutMs);
    if (!requested) {
      requested = true;
      const script = doc.createElement('script');
      script.async = true;
      script.dataset.b24Form = 'click/21/8r4fh6';
      script.src = 'https://cdn-ru.bitrix24.ru/b27699562/crm/form/loader_21.js';
      script.addEventListener('error', fail, { once: true });
      // Bitrix binds click forms to the next sibling and creates the form only
      // on that sibling's click. Wait for its loaded marker before opening.
      const observer = new win.MutationObserver(() => {
        if (!script.hasAttribute('data-b24-loaded')) return;
        observer.disconnect();
        ready = true;
        if (pending) doc.getElementById('b24-native-trigger').click();
      });
      observer.observe(script, { attributes: true, attributeFilter: ['data-b24-loaded'] });
      doc.getElementById('b24-native-trigger').before(script);
    } else if (ready) {
      doc.getElementById('b24-native-trigger').click();
    }
  });
  dialog().addEventListener('cancel', cancel);
  dialog().addEventListener('close', () => { cancel(); if (!form?.visible && opener?.isConnected) opener.focus(); });
  doc.getElementById('consultation-status-close').addEventListener('click', () => dialog().close());
}
