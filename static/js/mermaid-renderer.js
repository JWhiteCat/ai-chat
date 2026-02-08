import { escapeHtml, convertSvgToImage, showButtonFeedback } from './utils.js';
import { t } from './i18n.js';

export class MermaidRenderer {
    async render(pre, code) {
        if (typeof mermaid === 'undefined') {
            console.error('Mermaid not loaded');
            pre.innerHTML = `<div style="padding: 16px; background: #fee; border: 1px solid #fcc; border-radius: 8px; color: #c33;">⚠️ ${t('mermaid.notLoaded')}</div>`;
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

            this.addActions(wrapper, code);
            this.addDoubleClickPreview(wrapper, code);
        } catch (e) {
            console.error('Mermaid render failed:', e);
            this.showError(pre, e, code);
        }
    }

    showError(pre, error, code) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mermaid-error';
        errorDiv.style.padding = '16px';
        errorDiv.style.background = 'var(--bg-secondary)';
        errorDiv.style.border = '1px solid var(--border-color)';
        errorDiv.style.borderRadius = '8px';
        errorDiv.style.color = 'var(--text-primary)';
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">⚠️ ${t('mermaid.renderFailed')}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">${error.message}</div>
            <details style="font-size: 12px;">
                <summary style="cursor: pointer; color: var(--accent-color);">${t('mermaid.viewCode')}</summary>
                <pre style="margin-top: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(code)}</code></pre>
            </details>
        `;

        pre.parentNode.insertBefore(errorDiv, pre);
        pre.remove();
    }

    createActionButton(label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'mermaid-btn';
        btn.innerHTML = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    addActions(wrapper, code) {
        const actions = document.createElement('div');
        actions.className = 'mermaid-actions';

        const getSvg = () => wrapper.querySelector('svg');

        const copyImageBtn = this.createActionButton(t('mermaid.copyImage'), async () => {
            const svg = getSvg();
            if (!svg) return;
            try {
                const blob = await convertSvgToImage(svg, 3, 'blob');
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                showButtonFeedback(copyImageBtn, t('mermaid.copiedImage'), t('mermaid.copyImage'));
            } catch (e) {
                console.error('Copy image failed:', e);
                alert(t('mermaid.copyImageFail'));
            }
        });

        const copyCodeBtn = this.createActionButton(t('mermaid.copyCode'), async () => {
            try {
                await navigator.clipboard.writeText(code);
                showButtonFeedback(copyCodeBtn, t('mermaid.copiedCode'), t('mermaid.copyCode'));
            } catch (e) {
                console.error('Copy code failed:', e);
            }
        });

        const downloadBtn = this.createActionButton(t('mermaid.downloadImage'), async () => {
            const svg = getSvg();
            if (!svg) return;
            try {
                const blob = await convertSvgToImage(svg, 4, 'blob');
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'mermaid-diagram-' + Date.now() + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showButtonFeedback(downloadBtn, t('mermaid.downloaded'), t('mermaid.downloadImage'));
            } catch (e) {
                console.error('Download failed:', e);
                alert(t('mermaid.downloadFail') + e.message);
            }
        });

        actions.appendChild(copyImageBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(copyCodeBtn);
        wrapper.appendChild(actions);
    }

    addDoubleClickPreview(wrapper, code) {
        const mermaidDiv = wrapper.querySelector('.mermaid');
        if (!mermaidDiv) return;

        mermaidDiv.style.cursor = 'pointer';
        mermaidDiv.title = t('mermaid.dblClickHint');

        mermaidDiv.addEventListener('dblclick', () => {
            this.openPreview(wrapper, code);
        });
    }

    async openPreview(wrapper, code) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('imageModalImg');
        const modalClose = document.getElementById('imageModalClose');
        const modalDownloadBtn = document.getElementById('modalDownloadBtn');
        const modalCopyBtn = document.getElementById('modalCopyBtn');

        if (!modal || !modalImg) return;

        const svg = wrapper.querySelector('svg');
        if (!svg) return;

        try {
            const dataUrl = await convertSvgToImage(svg, 5, 'dataUrl');

            modalImg.src = dataUrl;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            modal.dataset.imageUrl = dataUrl;
            modal.dataset.imageName = 'mermaid-diagram-' + Date.now() + '.png';
        } catch (e) {
            console.error('Failed to open preview:', e);
            alert(t('mermaid.previewFail') + e.message);
            return;
        }

        const copyBtnOriginalHtml = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            ${t('modal.copyImage')}
        `;

        const closePreview = () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };

        modalClose.onclick = closePreview;
        modal.querySelector('.image-modal-backdrop').onclick = closePreview;

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closePreview();
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
                showButtonFeedback(modalCopyBtn, t('mermaid.copied'), copyBtnOriginalHtml);
            } catch (e) {
                console.error('Copy failed:', e);
                alert(t('mermaid.copyFailDownload'));
            }
        };

        let isZoomed = false;
        modalImg.onclick = () => {
            isZoomed = !isZoomed;
            modalImg.classList.toggle('zoomed', isZoomed);
        };
    }
}
