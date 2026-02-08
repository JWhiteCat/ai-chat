import { translations } from './translations.js';
import { loadLanguage, saveLanguage } from './storage.js';

let currentLang = loadLanguage();

export function t(key) {
    return translations[currentLang]?.[key] ?? translations['en']?.[key] ?? key;
}

export function getLanguage() {
    return currentLang;
}

export function setLanguage(lang) {
    if (lang !== 'zh' && lang !== 'en') return;
    currentLang = lang;
    saveLanguage(lang);
    applyToDOM();
}

export function toggleLanguage() {
    setLanguage(currentLang === 'zh' ? 'en' : 'zh');
}

const I18N_ATTR_MAP = {
    'data-i18n': 'textContent',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-alt': 'alt',
};

export function applyToDOM() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('page.title');

    for (const [attr, prop] of Object.entries(I18N_ATTR_MAP)) {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
            el[prop] = t(el.getAttribute(attr));
        });
    }

    document.querySelectorAll('[data-i18n-prompt]').forEach(el => {
        el.dataset.prompt = t(el.getAttribute('data-i18n-prompt'));
    });

    // Remove anti-flicker hiding
    document.documentElement.style.visibility = '';
}
