const STORAGE_KEYS = {
    CONVERSATIONS: 'ai_chat_conversations',
    API_CONFIG: 'ai_chat_api_config',
    THEME: 'ai_chat_theme',
    DEV_MODE: 'ai_chat_dev_mode',
    LANGUAGE: 'ai_chat_language',
    CUSTOM_MODELS: 'ai_chat_custom_models'
};

function loadJSON(key, fallback) {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
}

function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadConversations() {
    return loadJSON(STORAGE_KEYS.CONVERSATIONS, []);
}

export function saveConversations(conversations) {
    saveJSON(STORAGE_KEYS.CONVERSATIONS, conversations);
}

export function loadAPIConfig() {
    return loadJSON(STORAGE_KEYS.API_CONFIG, null);
}

export function saveAPIConfig(config) {
    saveJSON(STORAGE_KEYS.API_CONFIG, config);
}

export function loadTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
}

export function saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

export function loadDevMode() {
    return localStorage.getItem(STORAGE_KEYS.DEV_MODE) === 'true';
}

export function saveDevMode(enabled) {
    localStorage.setItem(STORAGE_KEYS.DEV_MODE, String(enabled));
}

export function loadLanguage() {
    return localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'en';
}

export function saveLanguage(lang) {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
}

export function loadCustomModels() {
    return loadJSON(STORAGE_KEYS.CUSTOM_MODELS, []);
}

export function saveCustomModels(models) {
    saveJSON(STORAGE_KEYS.CUSTOM_MODELS, models);
}
