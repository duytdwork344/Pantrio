/**
 * Stable API error codes (requirements 2b.1 #8).
 *
 * Response body: `{ statusCode, code, message, params?, details? }`.
 * Clients translate by `code` (key `errors.<CODE>`); `message` is English and
 * meant for debugging only. Generic codes derive from the HTTP status, so a
 * module that has not been migrated still returns a usable code.
 */
export const ErrorCode = {
  // Generic (derived from HTTP status)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  // Auth / users
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  LOCALE_NOT_SUPPORTED: 'LOCALE_NOT_SUPPORTED',
  // Content translations (requirements 2b.2)
  TRANSLATION_INCOMPLETE: 'TRANSLATION_INCOMPLETE',
  TRANSLATION_IS_SOURCE: 'TRANSLATION_IS_SOURCE',
  RECIPE_NOT_PUBLISHED: 'RECIPE_NOT_PUBLISHED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiErrorBody = {
  statusCode: number;
  code: string;
  message: string;
  params?: Record<string, string | number | boolean | null>;
  /** Field-level messages from validation (debug / dev forms). */
  details?: string[];
};
