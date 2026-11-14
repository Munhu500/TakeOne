import { useColorScheme } from 'react-native';
import { create } from './store';

const dark = { bg: '#09090B', surface: '#111114', raised: '#1A1A1F', line: '#27272E', fg: '#FAFAFA', muted: '#A1A1AA', faint: '#71717A', accent: '#7C5CFF', accentFg: '#FFFFFF', ok: '#34D399', warn: '#FBBF24', bad: '#F87171' };
const light: typeof dark = { bg: '#FAFAFA', surface: '#FFFFFF', raised: '#F4F4F5', line: '#E4E4E7', fg: '#09090B', muted: '#52525B', faint: '#71717A', accent: '#7C5CFF', accentFg: '#FFFFFF', ok: '#059669', warn: '#B45309', bad: '#DC2626' };
export type Colors = typeof dark;

/** Dark by default; the profile screen can switch to light or follow the system. */
export const themePref = create<'dark' | 'light' | 'system'>('dark');
export function useColors(): Colors {
  const pref = themePref.use();
  const system = useColorScheme();
  return (pref === 'system' ? system ?? 'dark' : pref) === 'light' ? light : dark;
}
export const font = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' } as const;
export const radius = { md: 12, lg: 16, xl: 22 };
