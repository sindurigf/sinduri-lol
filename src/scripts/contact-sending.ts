/*
 * Progressive enhancement: blocks double submits and offline posts. Uses
 * `aria-disabled`, not `disabled`, which would drop the focused button. No
 * `aria-busy` on the form: it would let a screen reader hold back the status.
 */

const SENDING_LABEL = 'Sending';
const SENDING_STATUS = 'Sending your message.';
const OFFLINE_STATUS =
  'You are offline, so your message has not been sent. It is still in the form: send it again once you are back online.';

const partsOf = (form: HTMLFormElement) => ({
  button: form.querySelector<HTMLButtonElement>('button[type="submit"]'),
  status: form.querySelector<HTMLElement>('[data-contact-status]'),
});

const reset = (form: HTMLFormElement): void => {
  const { button, status } = partsOf(form);
  delete form.dataset.sending;
  if (button) {
    button.removeAttribute('aria-disabled');
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
  if (status) status.textContent = '';
};

const onSubmit =
  (form: HTMLFormElement) =>
  (event: SubmitEvent): void => {
    if (form.dataset.sending === 'true') {
      event.preventDefault();
      return;
    }
    const { button, status } = partsOf(form);

    /* Offline, the browser's error page would discard the typed message. */
    if (!navigator.onLine) {
      event.preventDefault();
      if (status) status.textContent = OFFLINE_STATUS;
      return;
    }

    form.dataset.sending = 'true';
    if (button) {
      button.dataset.label = button.textContent?.trim() ?? '';
      button.setAttribute('aria-disabled', 'true');
      button.textContent = SENDING_LABEL;
    }
    if (status) status.textContent = SENDING_STATUS;
  };

for (const form of document.querySelectorAll<HTMLFormElement>(
  'form[data-contact-form]',
)) {
  form.addEventListener('submit', onSubmit(form));
}

/* A page restored from the back-forward cache is still mid-send. */
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const form of document.querySelectorAll<HTMLFormElement>(
    'form[data-contact-form]',
  )) {
    reset(form);
  }
});
