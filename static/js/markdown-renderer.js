import { MermaidRenderer } from './mermaid-renderer.js';
import { escapeHtml, showButtonFeedback, getMermaidConfig } from './utils.js';
import { t } from './i18n.js';

const MERMAID_KEYWORDS = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)/i;

export class MarkdownRenderer {
    constructor() {
        this.mermaidRenderer = new MermaidRenderer();
        this._mermaidCache = new Map();
        this.setup();
    }

    setup() {
        marked.setOptions({
            highlight: (code, lang) => {
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
            mermaid.initialize(getMermaidConfig(theme));
        }
    }

    render(element, content, isStreaming = false) {
        // Detect which mermaid code blocks are complete (have closing fence)
        const completedMermaidCodes = isStreaming ? this._findCompletedMermaidBlocks(content) : null;

        element.innerHTML = marked.parse(content);

        element.querySelectorAll('pre code').forEach((block) => {
            const lang = (block.className || '').match(/language-(\w+)/)?.[1] || '';
            const codeText = block.textContent.trim();
            const isMermaid = lang === 'mermaid' || MERMAID_KEYWORDS.test(codeText);

            if (!isMermaid) {
                this.addCopyButton(block.parentElement);
                return;
            }

            if (!isStreaming || completedMermaidCodes?.has(codeText)) {
                const cached = this._mermaidCache.get(codeText);
                if (cached) {
                    const clone = cached.cloneNode(true);
                    block.parentElement.parentNode.insertBefore(clone, block.parentElement);
                    block.parentElement.remove();
                    this.mermaidRenderer.addActions(clone, codeText);
                    this.mermaidRenderer.addDoubleClickPreview(clone);
                } else {
                    this._renderAndCacheMermaid(block.parentElement, codeText);
                }
            } else {
                this.showMermaidPlaceholder(block.parentElement, block.textContent);
            }
        });
    }

    _findCompletedMermaidBlocks(content) {
        const completed = new Set();
        const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
        let match;
        while ((match = fenceRegex.exec(content)) !== null) {
            const lang = match[1];
            const code = match[2].trim();
            if (lang === 'mermaid' || MERMAID_KEYWORDS.test(code)) {
                completed.add(code);
            }
        }
        return completed;
    }

    async _renderAndCacheMermaid(pre, code) {
        const parent = pre.parentNode;
        await this.mermaidRenderer.render(pre, code);

        if (!parent) return;

        const wrappers = parent.querySelectorAll('.mermaid-wrapper');
        for (const wrapper of wrappers) {
            const mermaidDiv = wrapper.querySelector('.mermaid');
            if (mermaidDiv && mermaidDiv.getAttribute('data-original-code') === code) {
                const cacheClone = wrapper.cloneNode(true);
                const actions = cacheClone.querySelector('.mermaid-actions');
                if (actions) actions.remove();
                this._mermaidCache.set(code, cacheClone);
                break;
            }
        }
    }

    showMermaidPlaceholder(pre, code) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-placeholder';
        wrapper.innerHTML = `
            <div style="padding: 12px 16px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">
                    <span class="mermaid-loading-dots">${t('mermaid.loading')}</span>
                </div>
                <pre style="margin: 0; padding: 8px; background: var(--bg-primary); border-radius: 4px; overflow-x: auto; font-size: 12px;"><code>${escapeHtml(code)}</code></pre>
            </div>
        `;
        pre.parentNode.insertBefore(wrapper, pre);
        pre.remove();
    }

    addCopyButton(pre) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const button = document.createElement('button');
        button.className = 'code-copy-btn';
        button.textContent = t('code.copy');

        button.addEventListener('click', async () => {
            const code = pre.querySelector('code').textContent;
            try {
                await navigator.clipboard.writeText(code);
                showButtonFeedback(button, t('code.copied'), t('code.copy'));
            } catch (e) {
                console.error('Copy failed:', e);
            }
        });

        wrapper.appendChild(button);
    }

    async updateMermaidTheme(theme) {
        if (typeof mermaid === 'undefined') return;

        this._mermaidCache.clear();
        const mermaidTheme = theme === 'dark' ? 'dark' : 'default';
        mermaid.initialize(getMermaidConfig(mermaidTheme));

        document.querySelectorAll('.mermaid-wrapper').forEach(async (wrapper) => {
            const mermaidDiv = wrapper.querySelector('.mermaid');
            const code = mermaidDiv?.getAttribute('data-original-code');

            if (code && mermaidDiv) {
                try {
                    const id = 'mermaid-' + Math.random().toString(36).substring(2, 11);
                    const { svg } = await mermaid.render(id + '-svg', code);
                    mermaidDiv.innerHTML = svg;
                } catch (e) {
                    console.error('Failed to re-render mermaid:', e);
                }
            }
        });
    }
}
