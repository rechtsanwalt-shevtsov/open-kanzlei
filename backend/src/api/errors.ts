import type { Locale } from '../foundation/i18n/locale.js';
import { t, type MessageKey } from '../foundation/i18n/messages.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly messageKey: MessageKey,
    public readonly details?: unknown,
  ) {
    super(messageKey);
    this.name = 'AppError';
  }

  toBody(locale: Locale): { error: string; message: string } {
    return {
      error: this.code,
      message: t(locale, this.messageKey),
    };
  }
}

export function badRequest(key: MessageKey = 'error.bad_request', details?: unknown): AppError {
  return new AppError(400, key.replace('error.', ''), key, details);
}

export function unauthorized(key: MessageKey = 'error.unauthorized'): AppError {
  return new AppError(401, key.replace('error.', ''), key);
}

export function forbidden(key: MessageKey = 'error.forbidden'): AppError {
  return new AppError(403, key.replace('error.', ''), key);
}

export function conflict(key: MessageKey): AppError {
  return new AppError(409, key.replace('error.', ''), key);
}

export function notFound(key: MessageKey = 'error.not_found'): AppError {
  return new AppError(404, key.replace('error.', ''), key);
}
