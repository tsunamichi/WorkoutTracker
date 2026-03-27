import { useMemo } from 'react';
import { useStore } from '../store';
import { buildAppTheme, normalizeColorThemeId, type AppTheme } from './appTheme';

export function useAppTheme(): AppTheme {
  const raw = useStore(s => s.settings.colorTheme);
  const id = normalizeColorThemeId(raw);
  return useMemo(() => buildAppTheme(id), [id]);
}
