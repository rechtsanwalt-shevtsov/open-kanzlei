import { badRequest } from '../../api/errors.js';

export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,62}$/;

export function assertUsername(username: string): string {
  const trimmed = username.trim();
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw badRequest('error.validation_failed');
  }
  return trimmed;
}

export function assertPassword(password: string): void {
  if (!password || password.length < 8) {
    throw badRequest('error.validation_failed');
  }
}
