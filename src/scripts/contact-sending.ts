/*
 * The contact form's sending state. Progressive: the form posts and reports
 * back without this. It adds three things while the request is in flight:
 * a second submit is blocked, the button says what is happening, and the
 * status region below it announces it.
 *
 * `aria-disabled`, never `disabled`: a disabled button leaves the tab order
 * and the accessibility tree, so a screen reader would lose the control it
 * just pressed. The result keeps its own path: a failure re-renders the page
 * with focus on the error summary, a success loads /contact/sent/.
 */

const SENDING_LABEL = 'Sending';
const SENDING_STATUS = 'Sending your message.';

const partsOf = (form: HTMLFormElement) => ({
  button: form.querySelector<HTMLButtonElement>('button[type="submit"]'),
  status: form.querySelector<HTMLElement>('[data-contact-status]'),
});

const reset = (form: HTMLFormElement): void => {
  const { button, status } = partsOf(form);
  delete form.dataset.sending;
  form.removeAttribute('aria-busy');
  if (button) {
    button.removeAttribute('aria-disabled');
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
  if (status) status.textContent = '';
};

const onSubmit = (event: SubmitEvent): void => {
  const form = event.currentTarget as HTMLFormElement;
  if (form.dataset.sending === 'true') {
    event.preventDefault();
    return;
  }
  const { button, status } = partsOf(form);
  form.dataset.sending = 'true';
  form.setAttribute('aria-busy', 'true');
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
  form.addEventListener('submit', onSubmit);
}

/* Back from the back-forward cache, the page is as it was left: mid-send. */
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  for (const form of document.querySelectorAll<HTMLFormElement>(
    'form[data-contact-form]',
  )) {
    reset(form);
  }
});
