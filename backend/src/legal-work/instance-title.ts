export function instanceTitleFromAttributes(
  attributes: Record<string, string | number | boolean | string[] | null>,
  fallback: string,
): string {
  for (const key of ['title', 'name', 'subject', 'label']) {
    const value = attributes[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}
