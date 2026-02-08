import { loadConversations, saveConversations } from './storage.js';
import { t } from './i18n.js';

const TITLE_MAX_LENGTH = 30;
const DEFAULT_TITLES = new Set(['新对话', 'New Chat']);

export class ConversationManager {
    constructor() {
        this.conversations = loadConversations();
        this.currentConversationId = null;

        if (this.conversations.length === 0) {
            this.createNew();
        } else {
            this.currentConversationId = this.conversations[0].id;
        }
    }

    createNew() {
        const now = new Date().toISOString();
        const conversation = {
            id: Date.now().toString(),
            title: t('sidebar.newChat'),
            messages: [],
            createdAt: now,
            updatedAt: now
        };

        this.conversations.unshift(conversation);
        this.currentConversationId = conversation.id;
        this.save();

        return conversation;
    }

    delete(id) {
        if (this.conversations.length === 1) {
            alert(t('confirm.keepOne'));
            return false;
        }

        if (!confirm(t('confirm.delete'))) {
            return false;
        }

        this.conversations = this.conversations.filter(c => c.id !== id);

        if (this.currentConversationId === id) {
            this.currentConversationId = this.conversations[0].id;
        }

        this.save();
        return true;
    }

    switchTo(id) {
        this.currentConversationId = id;
    }

    getCurrent() {
        return this.conversations.find(c => c.id === this.currentConversationId);
    }

    getAll() {
        return this.conversations;
    }

    addMessage(role, content) {
        const conversation = this.getCurrent();
        const now = new Date().toISOString();
        const message = {
            id: Date.now().toString(),
            role,
            content,
            timestamp: now
        };

        conversation.messages.push(message);
        conversation.updatedAt = now;

        const isFirstUserMessage = role === 'user' && conversation.messages.length === 1;
        if (isFirstUserMessage && DEFAULT_TITLES.has(conversation.title)) {
            conversation.title = content.length > TITLE_MAX_LENGTH
                ? content.substring(0, TITLE_MAX_LENGTH) + '...'
                : content;
        }

        this.save();
        return message;
    }

    getMessages() {
        const conversation = this.getCurrent();
        return conversation ? conversation.messages : [];
    }

    save() {
        saveConversations(this.conversations);
    }
}
