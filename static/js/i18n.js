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

export function applyToDOM() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('page.title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    document.querySelectorAll('[data-i18n-prompt]').forEach(el => {
        el.dataset.prompt = t(el.getAttribute('data-i18n-prompt'));
    });

    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
        el.alt = t(el.getAttribute('data-i18n-alt'));
    });

    // Remove anti-flicker hiding
    document.documentElement.style.visibility = '';
}
