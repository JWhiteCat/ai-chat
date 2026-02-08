class ChatApp {
    constructor() {
        this.conversations = this.loadConversations();
        this.currentConversationId = null;
        this.isStreaming = false;
        this.abortController = null;
        this.apiConfig = {
            apiKey: '',
            baseUrl: '',
            model: 'claude-sonnet-4-5-20250929',
            webSearchEnabled: false
        };

        this.init();
    }

    init() {
        this.loadAPIConfig();
        this.setupEventListeners();
        this.setupMarkdown();
        this.loadTheme();

        if (this.conversations.length === 0) {
            this.createNewConversation();
        } else {
            this.currentConversationId = this.conversations[0].id;
        }

        this.renderConversations();
        this.renderMessages();
    }

    loadAPIConfig() {
        const savedConfig = localStorage.getItem('ai_chat_api_config');
        if (savedConfig) {
            this.apiConfig = JSON.parse(savedConfig);
            const webSearchToggle = document.getElementById('webSearchToggle');
            if (webSearchToggle) {
                webSearchToggle.checked = this.apiConfig.webSearchEnabled || false;
            }
            const modelSelector = document.getElementById('modelSelector');
            if (modelSelector && this.apiConfig.model) {
                modelSelector.value = this.apiConfig.model;
            }
        } else {
            this.showConfigPrompt();
        }
    }

    showConfigPrompt() {
        const apiKey = prompt('Enter your API Key:\n(Get one at https://console.anthropic.com/settings/keys)');
        const baseUrl = prompt('Enter API Base URL (optional, press Enter for default):\nDefault: https://api.anthropic.com', 'https://api.anthropic.com');

        if (apiKey) {
            this.apiConfig.apiKey = apiKey;
            this.apiConfig.baseUrl = baseUrl || 'https://api.anthropic.com';
            this.saveAPIConfig();
        } else {
            alert('No API Key configured. Chat will be unavailable.\nYou can reconfigure later via browser console: app.showConfigPrompt()');
        }
    }

    saveAPIConfig() {
        localStorage.setItem('ai_chat_api_config', JSON.stringify(this.apiConfig));
    }

    loadConversations() {
        const saved = localStorage.getItem('ai_chat_conversations');
        return saved ? JSON.parse(saved) : [];
    }

    saveConversations() {
        localStorage.setItem('ai_chat_conversations', JSON.stringify(this.conversations));
    }

    createNewConversation() {
        const now = new Date().toISOString();
        const conversation = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            createdAt: now,
            updatedAt: now
        };

        this.conversations.unshift(conversation);
        this.currentConversationId = conversation.id;
        this.saveConversations();
        this.renderConversations();
        this.renderMessages();

        document.getElementById('welcomeScreen').classList.remove('hidden');
    }

    deleteConversation(id) {
        if (this.conversations.length === 1) {
            alert('At least one conversation must be kept');
            return;
        }

        if (!confirm('Are you sure you want to delete this conversation?')) return;

        this.conversations = this.conversations.filter(c => c.id !== id);

        if (this.currentConversationId === id) {
            this.currentConversationId = this.conversations[0].id;
            this.renderMessages();
        }

        this.saveConversations();
        this.renderConversations();
    }

    switchConversation(id) {
        this.currentConversationId = id;
        this.renderConversations();
        this.renderMessages();
    }

    getCurrentConversation() {
        return this.conversations.find(c => c.id === this.currentConversationId);
    }

    updateConversationTitle(id, firstMessage) {
        const conversation = this.conversations.find(c => c.id === id);
        if (conversation && conversation.title === 'New Chat') {
            conversation.title = firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
            this.saveConversations();
            this.renderConversations();
        }
    }

    addMessage(role, content) {
        const conversation = this.getCurrentConversation();
        const message = {
            id: Date.now().toString(),
            role,
            content,
            timestamp: new Date().toISOString()
        };

        conversation.messages.push(message);
        conversation.updatedAt = new Date().toISOString();

        if (role === 'user' && conversation.messages.length === 1) {
            this.updateConversationTitle(conversation.id, content);
        }

        this.saveConversations();
        return message;
    }

    async sendMessage(content) {
        if (!this.apiConfig.apiKey) {
            alert('Please configure API Key first');
            this.showConfigPrompt();
            return;
        }

        this.addMessage('user', content);
        this.renderMessages();

        document.getElementById('welcomeScreen').classList.add('hidden');
        this.showTypingIndicator();

        this.isStreaming = true;
        this.updateInputState();

        try {
            const conversation = this.getCurrentConversation();
            const messages = conversation.messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            this.abortController = new AbortController();
            await this.streamResponse(messages);
        } catch (error) {
            console.error('Failed to send message:', error);
            this.hideTypingIndicator();

            if (error.name === 'AbortError') {
                this.addMessage('assistant', 'Generation stopped');
            } else {
                this.addMessage('assistant', `Error: ${error.message}`);
            }

            this.renderMessages();
        } finally {
            this.isStreaming = false;
            this.abortController = null;
            this.updateInputState();
        }
    }

    async streamResponse(messages) {
        const url = `${this.apiConfig.baseUrl}/v1/messages`;

        const requestBody = {
            model: this.apiConfig.model,
            max_tokens: 64000,
            messages: messages,
            stream: true
        };

        if (this.apiConfig.webSearchEnabled) {
            requestBody.tools = [{ type: "web_search_20250305", max_uses: 5 }];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiConfig.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody),
            signal: this.abortController.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Request failed');
        }

        this.hideTypingIndicator();

        const conversation = this.getCurrentConversation();
        const assistantMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString()
        };
        conversation.messages.push(assistantMessage);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);

                    if (json.type === 'content_block_delta' && json.delta?.text) {
                        assistantMessage.content += json.delta.text;
                        this.updateLastMessage(assistantMessage.content);
                    }

                    if (json.type === 'message_delta' && json.delta?.stop_reason) {
                        console.log('Message completed:', json.delta.stop_reason);
                    }

                    if (json.type === 'content_block_start' && json.content_block?.type === 'tool_use') {
                        console.log('Tool use started:', json.content_block.name);
                    }
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                }
            }
        }

        this.saveConversations();
    }

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        this.conversations.forEach(conversation => {
            const item = document.createElement('div');
            item.className = 'conversation-item' + (conversation.id === this.currentConversationId ? ' active' : '');

            item.innerHTML = `
                <span class="conversation-title">${this.escapeHtml(conversation.title)}</span>
                <button class="conversation-delete" data-id="${conversation.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

            item.querySelector('.conversation-title').addEventListener('click', () => {
                this.switchConversation(conversation.id);
            });

            item.querySelector('.conversation-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteConversation(conversation.id);
            });

            container.appendChild(item);
        });
    }

    renderMessages() {
        const conversation = this.getCurrentConversation();
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

        const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const isUser = message.role === 'user';
        const avatar = isUser ? '👤' : '🤖';
        const roleName = isUser ? 'You' : 'Assistant';

        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-role">${roleName}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text markdown-body"></div>
            </div>
        `;

        const textEl = messageEl.querySelector('.message-text');
        this.renderMarkdown(textEl, message.content);

        container.appendChild(messageEl);
    }

    updateLastMessage(content) {
        const container = document.getElementById('messages');
        const lastMessage = container.lastElementChild;

        if (lastMessage) {
            const textEl = lastMessage.querySelector('.message-text');
            this.renderMarkdown(textEl, content);
            this.scrollToBottom();
        }
    }

    showTypingIndicator() {
        const container = document.getElementById('messages');
        const template = document.getElementById('typingIndicatorTemplate');

        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant typing-message';
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content"></div>
        `;

        messageEl.querySelector('.message-content').appendChild(template.content.cloneNode(true));
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

    setupMarkdown() {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error(e);
                    }
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });

        if (typeof mermaid !== 'undefined') {
            const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
            mermaid.initialize(this.getMermaidConfig(theme));
        }
    }

    renderMarkdown(element, content) {
        element.innerHTML = marked.parse(content);

        element.querySelectorAll('pre code').forEach((block) => {
            const className = block.className || '';
            const lang = className.match(/language-(\w+)/)?.[1] || '';
            const code = block.textContent;

            const isMermaid = lang === 'mermaid' ||
                code.trim().match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)/i);

            if (isMermaid) {
                this.renderMermaidDiagram(block.parentElement, code);
            } else {
                this.addCopyButton(block.parentElement);
            }
        });
    }

    async renderMermaidDiagram(pre, code) {
        if (typeof mermaid === 'undefined') {
            console.error('Mermaid not loaded');
            pre.innerHTML = '<div style="padding: 16px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c33;">⚠️ Mermaid library not loaded, cannot render chart</div>';
            return;
        }

        try {
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-wrapper';

            const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);

            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            tempDiv.id = id;
            tempDiv.textContent = code;
            document.body.appendChild(tempDiv);

            const { svg } = await mermaid.render(id + '-svg', code);

            document.body.removeChild(tempDiv);

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.innerHTML = svg;
            mermaidDiv.setAttribute('data-original-code', code);

            wrapper.appendChild(mermaidDiv);

            pre.parentNode.insertBefore(wrapper, pre);
            pre.remove();

            this.addMermaidActions(wrapper, code);
            this.addDoubleClickPreview(wrapper, code);
        } catch (e) {
            console.error('Mermaid render failed:', e);

            const errorDiv = document.createElement('div');
            errorDiv.className = 'mermaid-error';
            errorDiv.style.padding = '16px';
            errorDiv.style.background = 'var(--bg-secondary)';
            errorDiv.style.border = '1px solid var(--border-color)';
            errorDiv.style.borderRadius = '8px';
            errorDiv.style.color = 'var(--text-primary)';
            errorDiv.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px;">⚠️ Chart rendering failed</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">${e.message}</div>
                <details style="font-size: 12px;">
                    <summary style="cursor: pointer; color: var(--accent-color);">View Code</summary>
                    <pre style="margin-top: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px; overflow-x: auto;"><code>${this.escapeHtml(code)}</code></pre>
                </details>
            `;

            pre.parentNode.insertBefore(errorDiv, pre);
            pre.remove();
        }
    }

    addMermaidActions(wrapper, code) {
        const actions = document.createElement('div');
        actions.className = 'mermaid-actions';

        const copyImageBtn = document.createElement('button');
        copyImageBtn.className = 'mermaid-btn';
        copyImageBtn.innerHTML = '📷 Copy Image';
        copyImageBtn.addEventListener('click', async () => {
            const svg = wrapper.querySelector('svg');
            if (!svg) return;

            try {
                const blob = await this.convertSvgToImage(svg, 3, 'blob');
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                this.showButtonFeedback(copyImageBtn, '✅ Copied Image', '📷 Copy Image');
            } catch (e) {
                console.error('Copy image failed:', e);
                alert('Copy image failed. Try right-click to save.');
            }
        });

        const copyCodeBtn = document.createElement('button');
        copyCodeBtn.className = 'mermaid-btn';
        copyCodeBtn.innerHTML = '📋 Copy Code';
        copyCodeBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code);
                this.showButtonFeedback(copyCodeBtn, '✅ Copied Code', '📋 Copy Code');
            } catch (e) {
                console.error('Copy code failed:', e);
            }
        });

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'mermaid-btn';
        downloadBtn.innerHTML = '💾 Download Image';
        downloadBtn.addEventListener('click', async () => {
            const svg = wrapper.querySelector('svg');
            if (!svg) return;

            try {
                const blob = await this.convertSvgToImage(svg, 4, 'blob');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mermaid-diagram-' + Date.now() + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                this.showButtonFeedback(downloadBtn, '✅ Downloaded', '💾 Download Image');
            } catch (e) {
                console.error('Download failed:', e);
                alert('Download failed: ' + e.message);
            }
        });

        actions.appendChild(copyImageBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(copyCodeBtn);
        wrapper.appendChild(actions);
    }

    addCopyButton(pre) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const button = document.createElement('button');
        button.className = 'code-copy-btn';
        button.textContent = 'Copy';

        button.addEventListener('click', async () => {
            const code = pre.querySelector('code').textContent;
            try {
                await navigator.clipboard.writeText(code);
                this.showButtonFeedback(button, 'Copied!', 'Copy');
            } catch (e) {
                console.error('Copy failed:', e);
            }
        });

        wrapper.appendChild(button);
    }

    setupEventListeners() {
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.createNewConversation();
        });

        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('modelSelector').addEventListener('change', (e) => {
            this.apiConfig.model = e.target.value;
            this.saveAPIConfig();
        });

        document.getElementById('webSearchToggle').addEventListener('change', (e) => {
            this.apiConfig.webSearchEnabled = e.target.checked;
            this.saveAPIConfig();
        });

        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');
        const charCount = document.getElementById('charCount');

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
            charCount.textContent = input.value.length;
            sendBtn.disabled = !input.value.trim() || this.isStreaming;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.value.trim() && !this.isStreaming) {
                    this.handleSend();
                }
            }
        });

        sendBtn.addEventListener('click', () => {
            this.handleSend();
        });

        stopBtn.addEventListener('click', () => {
            this.stopGeneration();
        });

        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                input.value = card.dataset.prompt;
                input.dispatchEvent(new Event('input'));
                input.focus();
            });
        });
    }

    handleSend() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || this.isStreaming) return;

        input.value = '';
        input.style.height = 'auto';
        input.dispatchEvent(new Event('input'));

        this.sendMessage(content);
    }

    updateInputState() {
        const sendBtn = document.getElementById('sendBtn');
        const stopBtn = document.getElementById('stopBtn');
        const input = document.getElementById('messageInput');

        if (this.isStreaming) {
            sendBtn.style.display = 'none';
            stopBtn.style.display = 'flex';
            input.disabled = true;
        } else {
            sendBtn.style.display = 'flex';
            stopBtn.style.display = 'none';
            input.disabled = false;
            input.focus();
        }
    }

    loadTheme() {
        const theme = localStorage.getItem('ai_chat_theme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('ai_chat_theme', next);

        if (typeof mermaid !== 'undefined') {
            const mermaidTheme = next === 'dark' ? 'dark' : 'default';
            mermaid.initialize(this.getMermaidConfig(mermaidTheme));

            document.querySelectorAll('.mermaid-wrapper').forEach(async (wrapper) => {
                const mermaidDiv = wrapper.querySelector('.mermaid');
                const code = mermaidDiv?.getAttribute('data-original-code');

                if (code && mermaidDiv) {
                    try {
                        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
                        const { svg } = await mermaid.render(id + '-svg', code);
                        mermaidDiv.innerHTML = svg;
                    } catch (e) {
                        console.error('Failed to re-render mermaid:', e);
                    }
                }
            });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    convertSvgToImage(svg, scale, outputType = 'blob') {
        return new Promise((resolve, reject) => {
            const svgRect = svg.getBoundingClientRect();
            const svgWidth = svg.width.baseVal.value || svgRect.width;
            const svgHeight = svg.height.baseVal.value || svgRect.height;

            const svgClone = svg.cloneNode(true);
            svgClone.setAttribute('width', svgWidth);
            svgClone.setAttribute('height', svgHeight);

            const svgData = new XMLSerializer().serializeToString(svgClone);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = svgWidth * scale;
            canvas.height = svgHeight * scale;

            const img = new Image();

            img.onload = () => {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

                if (outputType === 'dataUrl') {
                    resolve(canvas.toDataURL('image/png'));
                } else {
                    canvas.toBlob((blob) => resolve(blob), 'image/png');
                }
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
    }

    showButtonFeedback(button, successText, originalHtml, duration = 2000) {
        button.textContent = successText;
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = originalHtml;
            button.classList.remove('copied');
        }, duration);
    }

    getMermaidConfig(theme) {
        return {
            startOnLoad: false,
            theme: theme,
            securityLevel: 'loose',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            logLevel: 'error'
        };
    }

    addDoubleClickPreview(wrapper, code) {
        const mermaidDiv = wrapper.querySelector('.mermaid');
        if (!mermaidDiv) return;

        mermaidDiv.style.cursor = 'pointer';
        mermaidDiv.title = 'Double-click to preview';

        mermaidDiv.addEventListener('dblclick', () => {
            this.openImagePreview(wrapper, code);
        });
    }

    async openImagePreview(wrapper, code) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('imageModalImg');
        const modalClose = document.getElementById('imageModalClose');
        const modalDownloadBtn = document.getElementById('modalDownloadBtn');
        const modalCopyBtn = document.getElementById('modalCopyBtn');

        if (!modal || !modalImg) return;

        const svg = wrapper.querySelector('svg');
        if (!svg) return;

        try {
            const dataUrl = await this.convertSvgToImage(svg, 5, 'dataUrl');

            modalImg.src = dataUrl;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            modal.dataset.imageUrl = dataUrl;
            modal.dataset.imageName = 'mermaid-diagram-' + Date.now() + '.png';
        } catch (e) {
            console.error('Failed to open preview:', e);
            alert('Failed to open preview: ' + e.message);
            return;
        }

        const copyBtnOriginalHtml = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy Image
        `;

        modalClose.onclick = () => this.closeImagePreview();
        modal.querySelector('.image-modal-backdrop').onclick = () => this.closeImagePreview();

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeImagePreview();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        modalDownloadBtn.onclick = () => {
            const url = modal.dataset.imageUrl;
            const name = modal.dataset.imageName;
            if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = name;
                a.click();
            }
        };

        modalCopyBtn.onclick = async () => {
            const url = modal.dataset.imageUrl;
            if (!url) return;

            try {
                const response = await fetch(url);
                const blob = await response.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                this.showButtonFeedback(modalCopyBtn, '✅ Copied', copyBtnOriginalHtml);
            } catch (e) {
                console.error('Copy failed:', e);
                alert('Copy failed, try downloading instead');
            }
        };

        let isZoomed = false;
        modalImg.onclick = () => {
            isZoomed = !isZoomed;
            modalImg.classList.toggle('zoomed', isZoomed);
        };
    }

    closeImagePreview() {
        const modal = document.getElementById('imageModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
}

let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new ChatApp();
    window.app = app;
});
