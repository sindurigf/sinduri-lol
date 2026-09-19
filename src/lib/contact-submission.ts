import type { ContactEnv, D1Database } from './contact-env';
import {
  looksAutomated,
  validateSubmission,
  type ContactSubmission,
  type FieldError,
} from './contact-form';
import { notificationFor } from './contact-notification';

/*
 * What happens to one contact form submission, apart from the HTTP request
 * around it: /contact/send/ parses the body, calls this, and renders what it
 * returns.
 */

export type SubmissionKind = 'sent' | 'invalid' | 'limited' | 'failed';

export interface SubmissionResult {
  kind: SubmissionKind;
  /** What to refill the form with when it is rendered again. */
  values: Partial<ContactSubmission>;
  errors: FieldError[];
}

const SENT: SubmissionResult = { kind: 'sent', values: {}, errors: [] };

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRateLimited = async (
  limiter: ContactEnv['CONTACT_RATE_LIMIT'],
  key: string | null,
): Promise<boolean> => {
  if (!limiter || key === null) return false;
  const { success } = await limiter.limit({ key });
  return !success;
};

/** True once the row is written. */
const store = async (
  database: D1Database | undefined,
  submission: ContactSubmission,
  now: number,
): Promise<boolean> => {
  /*
   * A missing binding is a deploy that is not finished. Saying so beats a
   * confirmation page for a message nothing received.
   */
  if (!database) {
    console.error('contact: message not stored: MESSAGES_DB binding missing');
    return false;
  }

  try {
    await database
      .prepare(
        'INSERT INTO messages (id, name, email, body, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        submission.name,
        submission.email,
        submission.body,
        now,
      )
      .run();
    return true;
  } catch (error) {
    /*
     * The reason only, never the submission: /privacy says nothing but the
     * stored row is kept, and a log line is not the row.
     */
    console.error('contact: message not stored:', reasonOf(error));
    return false;
  }
};

/*
 * After the row is written, and never a reason to fail the submission: the
 * message is already stored and readable in D1.
 */
const notify = async (
  bindings: ContactEnv,
  submission: ContactSubmission,
  now: number,
): Promise<void> => {
  const sender = bindings.CONTACT_MAILER;
  const recipient = bindings.CONTACT_NOTIFY_TO;

  if (!sender) {
    console.error(
      'contact: notification not sent: CONTACT_MAILER binding missing',
    );
    return;
  }
  if (!recipient) {
    console.error(
      'contact: notification not sent: CONTACT_NOTIFY_TO secret missing',
    );
    return;
  }

  try {
    await sender.send(notificationFor(submission, recipient, new Date(now)));
  } catch (error) {
    console.error('contact: notification not sent:', reasonOf(error));
  }
};

/**
 * Checks, stores and forwards one submission.
 *
 * `limitKey` is the hashed sender key from `rateLimitKey`, or null when the
 * request carries no address, in which case nothing is rate limited.
 */
export const handleSubmission = async (
  form: FormData,
  bindings: ContactEnv,
  now: number,
  limitKey: string | null,
): Promise<SubmissionResult> => {
  /*
   * Answered exactly as a success is. A bot told which check caught it can be
   * adjusted until neither does, and nothing is stored.
   */
  if (looksAutomated(form)) return SENT;

  if (await isRateLimited(bindings.CONTACT_RATE_LIMIT, limitKey)) {
    return { kind: 'limited', values: {}, errors: [] };
  }

  const result = validateSubmission(form);
  if (!result.ok) {
    return { kind: 'invalid', values: result.submitted, errors: result.errors };
  }

  if (!(await store(bindings.MESSAGES_DB, result.value, now))) {
    return { kind: 'failed', values: {}, errors: [] };
  }

  await notify(bindings, result.value, now);
  return SENT;
};
