import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ErrorCode, type ApiErrorBody } from '@pantrio/shared';
import { ApiExceptionFilter } from './api-exception.filter';
import { AppException } from './app-exception';

function run(exception: unknown): { status: number; body: ApiErrorBody } {
  const res = {
    status: jest.fn<unknown, [number]>(),
    json: jest.fn<unknown, [ApiErrorBody]>(),
  };
  res.status.mockReturnValue(res);
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
}

describe('ApiExceptionFilter', () => {
  it('keeps the code and params of an AppException', () => {
    const { status, body } = run(
      new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AUTH_EMAIL_TAKEN,
        'Email already registered',
        {
          email: 'a@b.c',
        },
      ),
    );
    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      code: 'AUTH_EMAIL_TAKEN',
      message: 'Email already registered',
      params: { email: 'a@b.c' },
    });
  });

  it('derives a code from the status for plain Nest exceptions', () => {
    const { body } = run(new NotFoundException("Recipe 'x' not found"));
    expect(body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: "Recipe 'x' not found",
    });
  });

  it('turns ValidationPipe errors into VALIDATION_FAILED with details', () => {
    const { body } = run(
      new BadRequestException(['email must be an email', 'password too short']),
    );
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual([
      'email must be an email',
      'password too short',
    ]);
    expect(body.message).toBe('email must be an email; password too short');
  });

  it('hides unknown errors behind INTERNAL_ERROR', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new Error('db password is hunter2'));
    expect(status).toBe(500);
    expect(body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
