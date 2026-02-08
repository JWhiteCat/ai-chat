/**
 * API Configuration Manager Module
 */

import { loadAPIConfig, saveAPIConfig, loadDevMode, saveDevMode, loadCustomModels, saveCustomModels } from './storage.js';
import { t } from './i18n.js';

const DEFAULT_MODELS = [
    { id: 'claude-opus-4-6', name: 'Opus 4.6' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', default: true },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' }
];

export class ConfigManager {
    constructor() {
        this.config = {
            apiKey: '',
            baseUrl: '',
            model: 'claude-sonnet-4-5-20250929',
            webSearchEnabled: false
        };
        this.serverConfig = null;
        this.devMode = loadDevMode();
        this.customModels = loadCustomModels();
    }

    async load() {
        await this.loadServerConfig();

        const savedConfig = loadAPIConfig();

        if (this.serverConfig) {
            if (this.serverConfig.base_url) {
                this.config.baseUrl = this.serverConfig.base_url;
            }

            const models = this.useProxy()
                ? (this.serverConfig.allowed_models || [])
                : DEFAULT_MODELS;
            const defaultModel = models.find(m => m.default);
            if (defaultModel) {
                this.config.model = defaultModel.id;
            }

            this.renderModelSelector(models);
        } else {
            this.renderModelSelector(DEFAULT_MODELS);
        }

        if (savedConfig) {
            if (savedConfig.apiKey) this.config.apiKey = savedConfig.apiKey;
            if (savedConfig.baseUrl) this.config.baseUrl = savedConfig.baseUrl;
            if (savedConfig.model && this.isModelAllowed(savedConfig.model)) {
                this.config.model = savedConfig.model;
            }
            if (savedConfig.webSearchEnabled !== undefined) {
                this.config.webSearchEnabled = savedConfig.webSearchEnabled;
            }
        }

        this.updateUI();

        if (!this.useProxy() && !this.config.apiKey && !this.customModels.length) {
            this.showConfigPrompt();
        }
    }

    async loadServerConfig() {
        try {
            const resp = await fetch('/api/config');
            if (resp.ok) {
                this.serverConfig = await resp.json();
            }
        } catch (e) {
            console.warn('Unable to fetch server config:', e);
        }
    }

    isModelAllowed(modelId) {
        if (this.customModels.some(m => m.model.id === modelId)) return true;
        if (this.useProxy() && this.serverConfig?.allowed_models?.length) {
            return this.serverConfig.allowed_models.some(m => m.id === modelId);
        }
        return DEFAULT_MODELS.some(m => m.id === modelId);
    }

    renderModelSelector(models) {
        const selector = document.getElementById('modelSelector');
        if (!selector) return;

        selector.innerHTML = '';

        // Built-in models
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            if (model.default) option.selected = true;
            selector.appendChild(option);
        });

        // Custom models
        if (this.customModels.length) {
            const group = document.createElement('optgroup');
            group.label = t('settings.customModelsGroup');
            this.customModels.forEach(cm => {
                const option = document.createElement('option');
                option.value = cm.model.id;
                option.textContent = cm.model.name;
                group.appendChild(option);
            });
            selector.appendChild(group);
        }
    }

    save() {
        saveAPIConfig(this.config);
    }

    showConfigPrompt() {
        const apiKey = prompt(t('config.apiKeyPrompt'));
        const baseUrl = prompt(t('config.baseUrlPrompt'), 'https://api.anthropic.com');

        if (apiKey) {
            this.config.apiKey = apiKey;
            this.config.baseUrl = baseUrl || 'https://api.anthropic.com';
            this.save();
        } else {
            alert(t('config.noKeyAlert'));
        }
    }

    updateUI() {
        const webSearchToggle = document.getElementById('webSearchToggle');
        if (webSearchToggle) {
            webSearchToggle.checked = this.config.webSearchEnabled;
        }

        const modelSelector = document.getElementById('modelSelector');
        if (modelSelector && this.config.model) {
            modelSelector.value = this.config.model;
        }

        const devModeToggle = document.getElementById('devModeToggle');
        if (devModeToggle) {
            devModeToggle.checked = this.devMode;
            const devModeContainer = devModeToggle.closest('.dev-mode-toggle');
            if (devModeContainer) {
                devModeContainer.style.display = this.serverConfig?.has_server_key ? '' : 'none';
            }
        }
    }

    updateModel(model) {
        this.config.model = model;
        this.save();
    }

    toggleWebSearch(enabled) {
        this.config.webSearchEnabled = enabled;
        this.save();
        console.log(`Web search ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Whether to use server proxy mode
     * Only uses proxy when dev mode is on and server has a key
     */
    useProxy() {
        return this.devMode && !!this.serverConfig?.has_server_key;
    }

    toggleDevMode(enabled) {
        this.devMode = enabled;
        saveDevMode(enabled);
        console.log(`Developer mode ${enabled ? 'enabled (using server proxy)' : 'disabled (using direct connection)'}`);
    }

    getConfig() {
        return { ...this.config };
    }

    hasAPIKey() {
        return !!this.config.apiKey || this.useProxy() || !!this.getCustomModelConfig();
    }

    /**
     * Get the currently selected custom model config (if any)
     */
    getCustomModelConfig() {
        return this.customModels.find(m => m.model.id === this.config.model) || null;
    }

    addCustomModel(modelConfig) {
        // Deduplicate
        this.customModels = this.customModels.filter(m => m.model.id !== modelConfig.model.id);
        this.customModels.push(modelConfig);
        saveCustomModels(this.customModels);
        this.refreshModelSelector();
    }

    removeCustomModel(modelId) {
        this.customModels = this.customModels.filter(m => m.model.id !== modelId);
        saveCustomModels(this.customModels);
        // If the deleted model was selected, switch back to default
        if (this.config.model === modelId) {
            const defaultModel = DEFAULT_MODELS.find(m => m.default) || DEFAULT_MODELS[0];
            this.config.model = defaultModel.id;
            this.save();
        }
        this.refreshModelSelector();
    }

    getCustomModels() {
        return [...this.customModels];
    }

    refreshModelSelector() {
        const models = this.useProxy()
            ? (this.serverConfig?.allowed_models || [])
            : DEFAULT_MODELS;
        this.renderModelSelector(models);
        this.updateUI();
    }
}
