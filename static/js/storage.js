const STORAGE_KEYS = {
    CONVERSATIONS: 'ai_chat_conversations',
    API_CONFIG: 'ai_chat_api_config',
    THEME: 'ai_chat_theme',
    DEV_MODE: 'ai_chat_dev_mode',
    LANGUAGE: 'ai_chat_language',
    CUSTOM_MODELS: 'ai_chat_custom_models'
};

export function loadConversations() {
    const saved = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    return saved ? JSON.parse(saved) : [];
}

export function saveConversations(conversations) {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export function loadAPIConfig() {
    const saved = localStorage.getItem(STORAGE_KEYS.API_CONFIG);
    return saved ? JSON.parse(saved) : null;
}

export function saveAPIConfig(config) {
    localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(config));
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
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_MODELS);
    return saved ? JSON.parse(saved) : [];
}

export function saveCustomModels(models) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_MODELS, JSON.stringify(models));
}
