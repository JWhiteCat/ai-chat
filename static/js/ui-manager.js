/**
 * UI Manager Module
 */

import { escapeHtml } from './utils.js';
import { loadTheme, saveTheme } from './storage.js';
import { t, getLanguage } from './i18n.js';

export class UIManager {
    constructor(conversationManager, markdownRenderer) {
        this.conversationManager = conversationManager;
        this.markdownRenderer = markdownRenderer;
        this.isStreaming = false;
        this._streamRenderTimer = null;
        this._pendingContent = null;
    }

    init() {
        this.loadTheme();
        this.renderConversations();
        this.renderMessages();
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        const conversations = this.conversationManager.getAll();
        const currentId = this.conversationManager.currentConversationId;

        conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'conversation-item' + (conversation.id === currentId ? ' active' : '');

            item.innerHTML = `
                <span class="conversation-title">${escapeHtml(conversation.title)}</span>
                <button class="conversation-delete" data-id="${conversation.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

            item.querySelector('.conversation-title').addEventListener('click', () => {
                this.conversationManager.switchTo(conversation.id);
                this.renderConversations();
                this.renderMessages();
                this.closeMobileSidebar();
            });

            item.querySelector('.conversation-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.conversationManager.delete(conversation.id)) {
                    this.renderConversations();
                    this.renderMessages();
                }
            });

            container.appendChild(item);
        });
    }

    renderMessages() {
        const conversation = this.conversationManager.getCurrent();
        const container = document.getElementById('messages');
        container.innerHTML = '';

        if (!conversation || conversation.messages.length === 0) {
            document.getElementById('welcomeScreen').classList.remove('hidden');
            return;
        }

        document.getElementById('welcomeScreen').classList.add('hidden');

        conversation.messages.forEach(message => {
            this.appendMessageElement(message);
        });

        this.scrollToBottom();
    }

    appendMessageElement(message) {
        const container = document.getElementById('messages');
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}`;
        messageEl.dataset.messageId = message.id;

        const locale = getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
        const time = new Date(message.timestamp).toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit'
        });

        const isUser = message.role === 'user';

        messageEl.innerHTML = `
            <div class="message-avatar">${isUser ? '👤' : '🤖'}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">${isUser ? t('message.you') : 'Assistant'}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text markdown-body"></div>
            </div>
        `;

        const textEl = messageEl.querySelector('.message-text');
        this.markdownRenderer.render(textEl, message.content);

        container.appendChild(messageEl);
    }

    updateLastMessage(content) {
        this._pendingContent = content;
        if (!this._streamRenderTimer) {
            this._streamRenderTimer = setTimeout(() => {
                this._streamRenderTimer = null;
                if (this._pendingContent !== null) {
                    this.renderLastMessageContent(this._pendingContent, true);
                }
            }, 80);
        }
    }

    finalRenderLastMessage(content) {
        // Clear pending throttled render
        if (this._streamRenderTimer) {
            clearTimeout(this._streamRenderTimer);
            this._streamRenderTimer = null;
        }
        this._pendingContent = null;
        this.markdownRenderer._mermaidCache.clear();
        this.renderLastMessageContent(content, false);
    }

    renderLastMessageContent(content, isStreaming) {
        const container = document.getElementById('messages');
        const lastMessage = container.lastElementChild;

        if (lastMessage) {
            const textEl = lastMessage.querySelector('.message-text');
            this.markdownRenderer.render(textEl, content, isStreaming);
            this.scrollToBottom();
        }
    }

    showTypingIndicator() {
        const container = document.getElementById('messages');
        const template = document.getElementById('typingIndicatorTemplate');
        const indicator = template.content.cloneNode(true);

        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant typing-message';
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content"></div>
        `;

        messageEl.querySelector('.message-content').appendChild(indicator);
        container.appendChild(messageEl);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-message');
        if (indicator) {
            indicator.remove();
        }
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 0);
    }

    updateInputState(isStreaming) {
        this.isStreaming = isStreaming;
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');
        const input = document.getElementById('messageInput');

        sendBtn.style.display = isStreaming ? 'none' : 'flex';
        stopBtn.style.display = isStreaming ? 'flex' : 'none';
        input.disabled = isStreaming;

        if (!isStreaming) {
            input.focus();
        }
    }

    loadTheme() {
        const theme = loadTheme();
        document.documentElement.setAttribute('data-theme', theme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        saveTheme(next);
        this.markdownRenderer.updateMermaidTheme(next);
    }

    showWelcomeScreen() {
        document.getElementById('welcomeScreen').classList.remove('hidden');
    }

    hideWelcomeScreen() {
        document.getElementById('welcomeScreen').classList.add('hidden');
    }

    closeMobileSidebar() {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
        }
    }
}
