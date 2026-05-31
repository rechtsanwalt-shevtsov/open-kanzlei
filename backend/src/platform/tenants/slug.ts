import type pg from 'pg';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Derives an internal tenant slug from the firm name (not shown in login UI). */
export function slugifyFirmName(firmName: string): string {
  let slug = firmName
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (slug.length < 2) {
    slug = 'kanzlei';
  }

  if (slug.length > 64) {
    slug = slug.slice(0, 64).replace(/-$/, '');
  }

  if (!SLUG_PATTERN.test(slug)) {
    slug = `kanzlei-${slug.replace(/[^a-z0-9]/g, '').slice(0, 48) || 'neu'}`;
  }

  if (!SLUG_PATTERN.test(slug)) {
    slug = 'kanzlei-neu';
  }

  return slug;
}

export async function allocateUniqueTenantSlug(
  pool: pg.Pool | pg.PoolClient,
  firmName: string,
): Promise<string> {
  const base = slugifyFirmName(firmName);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await pool.query(
      `SELECT 1 FROM platform.tenants WHERE slug = $1`,
      [candidate],
    );
    if (!existing.rowCount) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
    if (suffix > 999) {
      throw new Error('Could not allocate unique tenant slug');
    }
  }
}
