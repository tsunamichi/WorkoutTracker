import { useStore } from '../store';
import { buildAppTheme, normalizeColorThemeId } from './appTheme';

/** Synchronous theme for call sites that cannot use `useAppTheme` (e.g. non-React). Re-reads if the store updates. */
export function getAppThemeFromStore() {
  const raw = useStore.getState().settings.colorTheme;
  return buildAppTheme(normalizeColorThemeId(raw));
}
