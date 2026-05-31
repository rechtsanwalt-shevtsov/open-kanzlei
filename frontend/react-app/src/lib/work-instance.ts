export function instanceTitle(
  attributes: Record<string, unknown> | undefined,
  fallback: string,
): string {
  const attrs = attributes ?? {};
  for (const key of ['title', 'name', 'subject', 'label']) {
    const v = attrs[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
}

export function attributeSearchText(attributes: Record<string, unknown> | undefined): string {
  if (!attributes) return '';
  return Object.values(attributes)
    .filter((v) => v != null && typeof v !== 'object')
    .map(String)
    .join(' ')
    .toLowerCase();
}
