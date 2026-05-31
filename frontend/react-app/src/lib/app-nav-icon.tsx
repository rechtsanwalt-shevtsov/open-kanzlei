import type { IconType } from 'react-icons';
import * as LuIcons from 'react-icons/lu';

export function resolveAppNavIcon(name: string | null | undefined): IconType | null {
  if (!name) return null;
  const Icon = (LuIcons as Record<string, IconType>)[name];
  return Icon ?? null;
}

interface AppNavIconProps {
  name: string | null | undefined;
  size?: number;
}

export function AppNavIcon({ name, size = 16 }: AppNavIconProps) {
  const Icon = resolveAppNavIcon(name);
  if (!Icon) return null;
  return <Icon size={size} aria-hidden />;
}
