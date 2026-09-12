/*
 * The contact form's field names, limits and validation, shared by the page
 * that renders the form and the endpoint that receives it.
 *
 * One module because the two must never disagree: a renamed field on the page
 * arrives at the endpoint as a missing value, which reads as a visitor who
 * left it blank.
 */

/** Field names, as they appear in the markup and in the submitted body. */
export const FIELDS = {
  name: 'name',
  email: 'email',
  body: 'message',
  /*
   * The honeypot. Named for something a form filler will want to complete,
   * never something that reads as decoration.
   */
  honeypot: 'website',
} as const;

/**
 * Lengths, in characters. The upper bounds are what the column will hold
 * rather than a judgement about what is worth saying; the lower bounds reject
 * a body that cannot be a message.
 */
export const LIMITS = {
  nameMin: 1,
  nameMax: 100,
  emailMax: 254,
  bodyMin: 10,
  bodyMax: 5000,
} as const;

/** How long a stored message lives before the retention sweep removes it. */
export const RETENTION_DAYS = 180;

export type FieldName = 'name' | 'email' | 'body';

export interface ContactSubmission {
  name: string;
  email: string;
  body: string;
}

export interface FieldError {
  field: FieldName;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: ContactSubmission }
  | { ok: false; errors: FieldError[]; submitted: Partial<ContactSubmission> };

/*
 * Deliberately permissive: something, an @, something with a dot. A stricter
 * pattern rejects valid addresses, and the only real test of an address is
 * whether mail to it arrives. This catches a typo, not a liar.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readField = (form: FormData, key: string): string => {
  const raw = form.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
};

/**
 * Every message a failing field can produce. Second person, says what to do,
 * never blames the reader. These are read out by a screen reader after the
 * error summary takes focus, so each one has to make sense alone.
 */
const MESSAGES = {
  nameMissing: 'Enter a name. Anything you want to be called is fine.',
  nameLong: `Use ${LIMITS.nameMax} characters or fewer for the name.`,
  emailMissing: 'Enter an email address so there is a way to reply.',
  emailShape: 'Check the email address. It needs an @ and a domain.',
  emailLong: `Use ${LIMITS.emailMax} characters or fewer for the email address.`,
  bodyMissing: 'Write a message.',
  bodyShort: `Write at least ${LIMITS.bodyMin} characters.`,
  bodyLong: `Use ${LIMITS.bodyMax} characters or fewer. Email works for anything longer.`,
} as const;

/**
 * Validates a submitted form.
 *
 * Collects every error rather than returning the first, so a visitor fixing
 * three fields is told about three fields once instead of three times.
 */
export const validateSubmission = (form: FormData): ValidationResult => {
  const name = readField(form, FIELDS.name);
  const email = readField(form, FIELDS.email);
  const body = readField(form, FIELDS.body);
  const submitted = { name, email, body };

  const errors: FieldError[] = [];

  if (name.length < LIMITS.nameMin) {
    errors.push({ field: 'name', message: MESSAGES.nameMissing });
  } else if (name.length > LIMITS.nameMax) {
    errors.push({ field: 'name', message: MESSAGES.nameLong });
  }

  if (email.length === 0) {
    errors.push({ field: 'email', message: MESSAGES.emailMissing });
  } else if (email.length > LIMITS.emailMax) {
    errors.push({ field: 'email', message: MESSAGES.emailLong });
  } else if (!EMAIL_SHAPE.test(email)) {
    errors.push({ field: 'email', message: MESSAGES.emailShape });
  }

  if (body.length === 0) {
    errors.push({ field: 'body', message: MESSAGES.bodyMissing });
  } else if (body.length < LIMITS.bodyMin) {
    errors.push({ field: 'body', message: MESSAGES.bodyShort });
  } else if (body.length > LIMITS.bodyMax) {
    errors.push({ field: 'body', message: MESSAGES.bodyLong });
  }

  return errors.length > 0
    ? { ok: false, errors, submitted }
    : { ok: true, value: { name, email, body } };
};

/**
 * True when the submission looks automated.
 *
 * Silent by design: a bot told which check caught it can be adjusted until
 * none do. A caught submission is answered exactly as a successful one is.
 *
 * The honeypot is the only client-side signal. A submit-too-fast check was
 * built and removed: the timestamp needs a script, Astro inlines a script that
 * small, and the inlined bundle carries LIMITS, so the CSP hash would change
 * every time a character limit did. Rate limiting covers the same ground
 * server-side without putting validation constants in a security header.
 */
export const looksAutomated = (form: FormData): boolean =>
  readField(form, FIELDS.honeypot).length > 0;
