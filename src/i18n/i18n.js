import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translations
import enTranslation from './locales/en/index';
import koTranslation from './locales/ko/index';
import viTranslation from './locales/vi/index';

// Configure i18next
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslation
      },
      ko: {
        translation: koTranslation
      },
      vi: {
        translation: viTranslation
      }
    },
    lng: localStorage.getItem('preferred_language') || 'vi', // use stored preference or default to Vietnamese
    fallbackLng: 'en', // fallback language
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;