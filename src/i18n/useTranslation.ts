import { useStore } from '../store';
import { DEFAULT_LANGUAGE, t as translate, type Language } from './index';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

export const useTranslation = () => {
  const { settings } = useStore();
  const language = (settings.language || DEFAULT_LANGUAGE) as Language;
  dayjs.locale(language);

  return {
    language,
    t: (key: Parameters<typeof translate>[0]) => translate(key, language),
  };
};
