import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorBody, ErrorCode } from '@pantrio/shared';

type Params = NonNullable<ApiErrorBody['params']>;

/**
 * HTTP error with a stable `code` that clients translate (requirements 2b.1 #8).
 * `message` stays English for logs and debugging. New codes go in
 * `ErrorCode` (@pantrio/shared) so both clients get the same list.
 *
 *   throw new AppException(HttpStatus.CONFLICT, ErrorCode.AUTH_EMAIL_TAKEN, 'Email already registered');
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly params?: Params,
  ) {
    super({ statusCode: status, code, message, params }, status);
  }
}
