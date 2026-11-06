import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode, type ApiErrorBody } from '@pantrio/shared';
import type { Response } from 'express';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
};

function codeForStatus(status: number): string {
  return (
    CODE_BY_STATUS[status] ??
    (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST)
  );
}

/**
 * Every error leaves as `{ statusCode, code, message, params?, details? }`.
 * Exceptions that are not AppException get a code from their HTTP status, and
 * ValidationPipe errors become VALIDATION_FAILED with the field messages in
 * `details`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      };
    }

    const statusCode = exception.getStatus();
    const raw = exception.getResponse();
    if (typeof raw === 'string') {
      return { statusCode, code: codeForStatus(statusCode), message: raw };
    }

    const data = raw as {
      code?: unknown;
      message?: unknown;
      params?: ApiErrorBody['params'];
    };
    if (Array.isArray(data.message)) {
      const details = data.message.map(String);
      return {
        statusCode,
        code: ErrorCode.VALIDATION_FAILED,
        message: details.join('; '),
        details,
      };
    }

    return {
      statusCode,
      code:
        typeof data.code === 'string' ? data.code : codeForStatus(statusCode),
      message:
        typeof data.message === 'string' ? data.message : exception.message,
      ...(data.params ? { params: data.params } : {}),
    };
  }
}
