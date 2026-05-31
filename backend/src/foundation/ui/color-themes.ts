export const COLOR_THEMES = ['classic', 'modern', 'forest', 'midnight'] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const DEFAULT_COLOR_THEME: ColorTheme = 'classic';

export function isColorTheme(value: unknown): value is ColorTheme {
  return typeof value === 'string' && (COLOR_THEMES as readonly string[]).includes(value);
}

export function resolveEffectiveColorTheme(
  tenantTheme: unknown,
  userTheme: unknown,
): ColorTheme {
  if (isColorTheme(userTheme)) return userTheme;
  if (isColorTheme(tenantTheme)) return tenantTheme;
  return DEFAULT_COLOR_THEME;
}
