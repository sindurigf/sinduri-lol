import type { EmailMessageBuilder } from './contact-env';
import type { ContactSubmission } from './contact-form';

/*
 * Must match `allowed_sender_addresses` in wrangler.jsonc, which rejects any
 * other sender. tests/contact.spec.ts reads both.
 */
export const NOTIFICATION_SENDER = {
  email: 'contact-form@sinduri.lol',
  name: 'sinduri.lol contact form',
} as const;

/* Validation trims but keeps inner control characters; a header cannot. */
const oneLine = (value: string): string =>
  value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

/** The email that tells the site owner a message arrived. */
export const notificationFor = (
  submission: ContactSubmission,
  to: string,
  receivedAt: Date,
): EmailMessageBuilder => ({
  to,
  from: NOTIFICATION_SENDER,
  replyTo: submission.email,
  subject: `Contact form: ${oneLine(submission.name)}`,
  text: [
    `From: ${oneLine(submission.name)} <${submission.email}>`,
    `Received: ${receivedAt.toISOString()}`,
    '',
    submission.body,
  ].join('\n'),
});
