export const COLOR_THEMES = ['classic', 'modern', 'forest', 'midnight'] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const DEFAULT_COLOR_THEME: ColorTheme = 'classic';

export type ThemePreview = {
  id: ColorTheme;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
};

export const THEME_PREVIEWS: Record<ColorTheme, ThemePreview> = {
  classic: {
    id: 'classic',
    primary: '#1E3A5F',
    secondary: '#4F6D8A',
    accent: '#C9A227',
    background: '#F5F6F8',
    surface: '#FFFFFF',
  },
  modern: {
    id: 'modern',
    primary: '#222831',
    secondary: '#4B5563',
    accent: '#14B8A6',
    background: '#F8FAFC',
    surface: '#FFFFFF',
  },
  forest: {
    id: 'forest',
    primary: '#2F5D50',
    secondary: '#7A9E7E',
    accent: '#D9C7A3',
    background: '#F7F7F5',
    surface: '#FFFFFF',
  },
  midnight: {
    id: 'midnight',
    primary: '#1E293B',
    secondary: '#334155',
    accent: '#D4AF37',
    background: '#0F172A',
    surface: '#1E293B',
  },
};

export function isColorTheme(value: string): value is ColorTheme {
  return (COLOR_THEMES as readonly string[]).includes(value);
}
