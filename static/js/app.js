/**
 * Chat Application - Main Application File
 * Integrates all modules, handles initialization and event binding
 */

import { ConfigManager } from './config-manager.js';
import { ConversationManager } from './conversation-manager.js';
import { APIService } from './api-service.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { UIManager } from './ui-manager.js';
import { escapeHtml } from './utils.js';
import { applyToDOM, setLanguage, getLanguage, t } from './i18n.js';

class ChatApp {
    constructor() {
        this.configManager = new ConfigManager();
        this.conversationManager = new ConversationManager();
        this.markdownRenderer = new MarkdownRenderer();
        this.uiManager = new UIManager(this.conversationManager, this.markdownRenderer);
        this.apiService = new APIService(this.configManager);

        this.init();
    }

    async init() {
        this.uiManager.init();
        applyToDOM();
        this.setupEventListeners();
        await this.configManager.load();
    }

    setupEventListeners() {
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.conversationManager.createNew();
            this.uiManager.renderConversations();
            this.uiManager.renderMessages();
            this.uiManager.showWelcomeScreen();
            this.closeSidebar();
        });

        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebarOverlay').addEventListener('click', () => this.closeSidebar());

        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('settingsModalClose').addEventListener('click', () => this.closeSettings());
        document.querySelector('.settings-modal-backdrop').addEventListener('click', () => this.closeSettings());

        document.getElementById('langToggleGroup').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-lang]');
            if (!btn) return;
            setLanguage(btn.dataset.lang);
            this.updateSettingsUI();
        });

        document.getElementById('themeToggleGroup').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-theme]');
            if (!btn) return;
            const theme = btn.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            import('./storage.js').then(m => m.saveTheme(theme));
            this.markdownRenderer.updateMermaidTheme(theme);
            this.updateSettingsUI();
        });

        document.getElementById('addModelBtn').addEventListener('click', () => this.showModelForm());
        document.getElementById('cancelModelBtn').addEventListener('click', () => this.hideModelForm());
        document.getElementById('saveModelBtn').addEventListener('click', () => this.saveCustomModel());

        document.getElementById('modelSelector').addEventListener('change', (e) => {
            this.configManager.updateModel(e.target.value);
        });

        document.getElementById('webSearchToggle').addEventListener('change', (e) => {
            this.configManager.toggleWebSearch(e.target.checked);
        });

        document.getElementById('devModeToggle').addEventListener('change', (e) => {
            this.configManager.toggleDevMode(e.target.checked);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSettings();
        });

        this.setupInputHandlers();
        this.setupSuggestionCards();
    }

    setupInputHandlers() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');
        const charCount = document.getElementById('charCount');

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
            charCount.textContent = input.value.length;
            sendBtn.disabled = !input.value.trim() || this.apiService.isRequesting();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.value.trim() && !this.apiService.isRequesting()) {
                    this.handleSend();
                }
            }
        });

        sendBtn.addEventListener('click', () => this.handleSend());
        stopBtn.addEventListener('click', () => this.apiService.abort());
    }

    setupSuggestionCards() {
        const input = document.getElementById('messageInput');
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                input.value = card.dataset.prompt;
                input.dispatchEvent(new Event('input'));
                input.focus();
            });
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (window.innerWidth <= 768) {
            const opening = !sidebar.classList.contains('open');
            sidebar.classList.toggle('open', opening);
            overlay.classList.toggle('active', opening);
        } else {
            sidebar.classList.toggle('collapsed');
        }
    }

    closeSidebar() {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
        }
    }

    openSettings() {
        this.updateSettingsUI();
        document.getElementById('settingsModal').classList.add('active');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    updateSettingsUI() {
        const lang = getLanguage();
        document.querySelectorAll('#langToggleGroup .settings-toggle-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        document.querySelectorAll('#themeToggleGroup .settings-toggle-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });

        this.renderCustomModelsList();
    }

    renderCustomModelsList() {
        const container = document.getElementById('customModelsList');
        const models = this.configManager.getCustomModels();

        if (!models.length) {
            container.innerHTML = `<div class="custom-models-empty" data-i18n="settings.noCustomModels">${t('settings.noCustomModels')}</div>`;
            return;
        }

        container.innerHTML = models.map(cm => `
            <div class="custom-model-card" data-model-id="${escapeHtml(cm.model.id)}">
                <div class="custom-model-info">
                    <div class="custom-model-name">${escapeHtml(cm.model.name)}</div>
                    <div class="custom-model-meta">${escapeHtml(cm.provider)} · ${escapeHtml(cm.model.id)}</div>
                </div>
                <div class="custom-model-actions">
                    <button class="edit-model-btn">${t('settings.editModel')}</button>
                    <button class="delete-model-btn">${t('settings.deleteModel')}</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.edit-model-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modelId = btn.closest('.custom-model-card').dataset.modelId;
                this.editCustomModel(modelId);
            });
        });

        container.querySelectorAll('.delete-model-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modelId = btn.closest('.custom-model-card').dataset.modelId;
                this.configManager.removeCustomModel(modelId);
                this.renderCustomModelsList();
            });
        });
    }

    showModelForm(editModel = null) {
        const form = document.getElementById('customModelForm');
        form.style.display = 'block';

        document.getElementById('modelFormTitle').textContent = t(editModel ? 'settings.editModel' : 'settings.addModel');
        document.getElementById('cmProvider').value = editModel?.provider || '';
        document.getElementById('cmBaseUrl').value = editModel?.base_url || '';
        document.getElementById('cmApiKey').value = editModel?.api_key || '';
        document.getElementById('cmModelId').value = editModel?.model.id || '';
        document.getElementById('cmModelName').value = editModel?.model.name || '';

        if (editModel) {
            form.dataset.editingId = editModel.model.id;
        } else {
            delete form.dataset.editingId;
        }
    }

    hideModelForm() {
        document.getElementById('customModelForm').style.display = 'none';
    }

    editCustomModel(modelId) {
        const model = this.configManager.getCustomModels().find(m => m.model.id === modelId);
        if (model) this.showModelForm(model);
    }

    saveCustomModel() {
        const provider = document.getElementById('cmProvider').value.trim();
        const baseUrl = document.getElementById('cmBaseUrl').value.trim();
        const apiKey = document.getElementById('cmApiKey').value.trim();
        const modelId = document.getElementById('cmModelId').value.trim();
        const modelName = document.getElementById('cmModelName').value.trim();

        if (!baseUrl || !apiKey || !modelId || !modelName) {
            alert(t('settings.modelRequired'));
            return;
        }

        const modelConfig = {
            provider: provider || 'custom',
            base_url: baseUrl,
            api: 'openai-completions',
            api_key: apiKey,
            model: { id: modelId, name: modelName }
        };

        this.configManager.addCustomModel(modelConfig);
        this.hideModelForm();
        this.renderCustomModelsList();
        applyToDOM();
    }

    handleSend() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || this.apiService.isRequesting()) return;

        input.value = '';
        input.style.height = 'auto';
        input.dispatchEvent(new Event('input'));

        this.sendMessage(content);
    }

    async sendMessage(content) {
        if (!this.configManager.hasAPIKey()) {
            alert(t('error.noApiKey'));
            this.configManager.showConfigPrompt();
            return;
        }

        this.conversationManager.addMessage('user', content);
        this.uiManager.renderMessages();
        this.uiManager.hideWelcomeScreen();
        this.uiManager.showTypingIndicator();
        this.uiManager.updateInputState(true);

        try {
            const conversation = this.conversationManager.getCurrent();
            const messages = conversation.messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const assistantMessage = this.conversationManager.addMessage('assistant', '');
            let firstChunk = true;

            await this.apiService.streamMessage(
                messages,
                (chunk, fullContent) => {
                    if (firstChunk) {
                        firstChunk = false;
                        this.uiManager.hideTypingIndicator();
                        this.uiManager.appendMessageElement(assistantMessage);
                    }
                    assistantMessage.content = fullContent;
                    this.uiManager.updateLastMessage(fullContent);
                },
                (fullContent) => {
                    if (firstChunk) {
                        this.uiManager.hideTypingIndicator();
                        this.uiManager.appendMessageElement(assistantMessage);
                    }
                    assistantMessage.content = fullContent;
                    this.uiManager.finalRenderLastMessage(fullContent);
                    this.conversationManager.save();
                }
            );

        } catch (error) {
            console.error('Failed to send message:', error);
            this.uiManager.hideTypingIndicator();

            const errorContent = error.name === 'AbortError'
                ? t('error.aborted')
                : t('error.prefix') + error.message;
            this.conversationManager.addMessage('assistant', errorContent);
            this.uiManager.renderMessages();
        } finally {
            this.uiManager.updateInputState(false);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatApp();
});

export default ChatApp;
