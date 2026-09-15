/*
 * Comment field names, limits and validation, shared by the pages that render
 * a comment form and the routes that receive one.
 *
 * One module for the same reason as contact-form.ts: a renamed field on a page
 * arrives at its route as a missing value.
 */

/** Field names, as they appear in the markup and in the submitted body. */
export const COMMENT_FIELDS = {
  name: 'name',
  email: 'email',
  body: 'comment',
  honeypot: 'website',
} as const;

/** Lengths, in characters. */
export const COMMENT_LIMITS = {
  nameMin: 1,
  nameMax: 100,
  emailMax: 254,
  bodyMin: 2,
  bodyMax: 2000,
} as const;

/** The name the owner's replies are published under. */
export const OWNER_NAME = 'Sinduri';

export type CommentFieldName = 'name' | 'email' | 'body';

export interface CommentSubmission {
  name: string;
  /** Null when the commenter left it blank: it is optional. */
  email: string | null;
  body: string;
}

export interface CommentFieldError {
  field: CommentFieldName;
  message: string;
}

export type CommentValidation<Value> =
  | { ok: true; value: Value }
  | {
      ok: false;
      errors: CommentFieldError[];
      submitted: Partial<Record<CommentFieldName, string>>;
    };

/* The same deliberately permissive shape contact-form.ts explains. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readField = (form: FormData, key: string): string => {
  const raw = form.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
};

/** Second person, says what to do, and makes sense read out alone. */
const MESSAGES = {
  nameMissing: 'Enter a name. Anything you want to be called is fine.',
  nameLong: `Use ${COMMENT_LIMITS.nameMax} characters or fewer for the name.`,
  emailShape: 'Check the email address. It needs an @ and a domain.',
  emailLong: `Use ${COMMENT_LIMITS.emailMax} characters or fewer for the email address.`,
  bodyMissing: 'Write a comment.',
  bodyShort: `Write at least ${COMMENT_LIMITS.bodyMin} characters.`,
  bodyLong: `Use ${COMMENT_LIMITS.bodyMax} characters or fewer.`,
} as const;

const bodyError = (body: string): CommentFieldError | null => {
  if (body.length === 0)
    return { field: 'body', message: MESSAGES.bodyMissing };
  if (body.length < COMMENT_LIMITS.bodyMin) {
    return { field: 'body', message: MESSAGES.bodyShort };
  }
  if (body.length > COMMENT_LIMITS.bodyMax) {
    return { field: 'body', message: MESSAGES.bodyLong };
  }
  return null;
};

/** Validates a reader's comment, collecting every error at once. */
export const validateComment = (
  form: FormData,
): CommentValidation<CommentSubmission> => {
  const name = readField(form, COMMENT_FIELDS.name);
  const email = readField(form, COMMENT_FIELDS.email);
  const body = readField(form, COMMENT_FIELDS.body);

  const errors: CommentFieldError[] = [];

  if (name.length < COMMENT_LIMITS.nameMin) {
    errors.push({ field: 'name', message: MESSAGES.nameMissing });
  } else if (name.length > COMMENT_LIMITS.nameMax) {
    errors.push({ field: 'name', message: MESSAGES.nameLong });
  }

  if (email.length > COMMENT_LIMITS.emailMax) {
    errors.push({ field: 'email', message: MESSAGES.emailLong });
  } else if (email.length > 0 && !EMAIL_SHAPE.test(email)) {
    errors.push({ field: 'email', message: MESSAGES.emailShape });
  }

  const bodyProblem = bodyError(body);
  if (bodyProblem) errors.push(bodyProblem);

  return errors.length > 0
    ? { ok: false, errors, submitted: { name, email, body } }
    : { ok: true, value: { name, email: email || null, body } };
};

/** Validates the owner's reply, which carries a body and nothing else. */
export const validateOwnerReply = (
  form: FormData,
): CommentValidation<string> => {
  const body = readField(form, COMMENT_FIELDS.body);
  const problem = bodyError(body);

  return problem
    ? { ok: false, errors: [problem], submitted: { body } }
    : { ok: true, value: body };
};

/** True when the submission looks automated. See looksAutomated in contact-form.ts. */
export const commentLooksAutomated = (form: FormData): boolean =>
  readField(form, COMMENT_FIELDS.honeypot).length > 0;
