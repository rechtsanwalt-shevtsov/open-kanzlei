export type Locale = 'de' | 'en';

const SUPPORTED: Locale[] = ['de', 'en'];

export function parseLocale(value: string | undefined): Locale | undefined {
  if (!value) return undefined;
  const primary = value.split(',')[0]?.trim().split('-')[0]?.toLowerCase();
  if (primary === 'de' || primary === 'en') return primary;
  return undefined;
}

export function resolveLocale(options: {
  explicit?: string;
  userPreferred?: string | null;
  tenantDefault?: string;
}): Locale {
  const fromExplicit = parseLocale(options.explicit);
  if (fromExplicit) return fromExplicit;

  if (options.userPreferred === 'de' || options.userPreferred === 'en') {
    return options.userPreferred;
  }

  if (options.tenantDefault === 'de' || options.tenantDefault === 'en') {
    return options.tenantDefault;
  }

  return 'de';
}

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED.includes(value as Locale);
}
