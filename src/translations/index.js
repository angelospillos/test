import i18n from 'i18next';
import detector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
    },
    lng: 'en',
    fallbackLng: 'en',
    react: {
      transSupportBasicHtmlNodes: true,
    },
  });

export default i18n;
