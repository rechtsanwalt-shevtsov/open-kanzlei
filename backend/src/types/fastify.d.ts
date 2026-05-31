import type { Locale } from '../foundation/i18n/locale.js';
import type { SessionUser } from '../platform/auth/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    locale: Locale;
    user?: SessionUser;
  }
}
