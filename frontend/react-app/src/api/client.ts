import createClient from 'openapi-fetch';
import type { paths } from './schema.js';
import type { Locale } from '../i18n/locale.js';

export type ApiError = { error: string; message: string };

export const api = createClient<paths>({
  baseUrl: '',
  credentials: 'include',
});

export function apiHeaders(locale: Locale): HeadersInit {
  return {
    'Accept-Language': locale,
  };
}

/** Headers for JSON request bodies (POST/PATCH/PUT). */
export function apiJsonHeaders(locale: Locale): HeadersInit {
  return {
    'Accept-Language': locale,
    'Content-Type': 'application/json',
  };
}

export async function readApiError(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ApiError).message);
  }
  return fallback;
}
