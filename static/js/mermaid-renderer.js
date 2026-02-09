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

            const id = 'mermaid-' + Math.random().toString(36).slice(2, 11);

            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            tempDiv.id = id;
            document.body.appendChild(tempDiv);

            const { svg } = await mermaid.render(id + '-svg', code);

            tempDiv.remove();

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.innerHTML = svg;
            mermaidDiv.dataset.originalCode = code;

            wrapper.append(mermaidDiv);
            pre.replaceWith(wrapper);

            this.addActions(wrapper, code);
            this.addDoubleClickPreview(wrapper);
        } catch (e) {
            console.error('Mermaid render failed:', e);
            this.showError(pre, e, code);
        }
    }

    showError(pre, error, code) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mermaid-error';
        Object.assign(errorDiv.style, {
            padding: '16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
        });
        errorDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">⚠️ ${t('mermaid.renderFailed')}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 12px;">${error.message}</div>
            <details style="font-size: 12px;">
                <summary style="cursor: pointer; color: var(--accent-color);">${t('mermaid.viewCode')}</summary>
                <pre style="margin-top: 8px; padding: 8px; background: var(--bg-primary); border-radius: 4px; overflow-x: auto;"><code>${escapeHtml(code)}</code></pre>
            </details>
        `;

        pre.replaceWith(errorDiv);
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
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;

        if (!isMobile) {
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
            actions.append(copyImageBtn);
        }

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

        const copyCodeBtn = this.createActionButton(t('mermaid.copyCode'), async () => {
            try {
                await navigator.clipboard.writeText(code);
                showButtonFeedback(copyCodeBtn, t('mermaid.copiedCode'), t('mermaid.copyCode'));
            } catch (e) {
                console.error('Copy code failed:', e);
            }
        });

        actions.append(downloadBtn, copyCodeBtn);
        wrapper.append(actions);
    }

    addDoubleClickPreview(wrapper) {
        const mermaidDiv = wrapper.querySelector('.mermaid');
        if (!mermaidDiv) return;

        mermaidDiv.style.cursor = 'pointer';
        mermaidDiv.title = t('mermaid.dblClickHint');

        mermaidDiv.addEventListener('dblclick', () => this.openPreview(wrapper));
    }

    async openPreview(wrapper) {
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

        if (!this._zoomInitialized) {
            this.setupZoom(modal, modalImg);
            this._zoomInitialized = true;
        } else {
            // Reset zoom state for new image
            modalImg.style.transform = '';
            this._resetZoom?.();
        }
    }

    setupZoom(modal, modalImg) {
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        const MIN_SCALE = 0.5;
        const MAX_SCALE = 10;

        const applyTransform = () => {
            modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            modalImg.style.cursor = scale > 1 ? 'grab' : 'default';
        };

        const resetZoom = () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
        };

        // Reset on modal open
        resetZoom();
        this._resetZoom = resetZoom;

        // Double-click to reset zoom
        modalImg.ondblclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (scale !== 1) {
                resetZoom();
            } else {
                scale = 2;
                applyTransform();
            }
        };

        // PC: Mouse wheel zoom
        const modalBody = modal.querySelector('.image-modal-body');
        modalBody.onwheel = (e) => {
            e.preventDefault();
            const rect = modalImg.getBoundingClientRect();
            const offsetX = e.clientX - rect.left - rect.width / 2;
            const offsetY = e.clientY - rect.top - rect.height / 2;

            const oldScale = scale;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));

            const ratio = scale / oldScale;
            translateX -= offsetX * (ratio - 1);
            translateY -= offsetY * (ratio - 1);

            applyTransform();
        };

        // PC: Mouse drag to pan
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        modalImg.onmousedown = (e) => {
            if (scale <= 1) return;
            e.preventDefault();
            isDragging = true;
            dragStartX = e.clientX - translateX;
            dragStartY = e.clientY - translateY;
            modalImg.style.cursor = 'grabbing';
        };

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !modal.classList.contains('active')) return;
            translateX = e.clientX - dragStartX;
            translateY = e.clientY - dragStartY;
            applyTransform();
            modalImg.style.cursor = 'grabbing';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            modalImg.style.cursor = scale > 1 ? 'grab' : 'default';
        });

        // Mobile: Pinch-to-zoom and drag
        let lastTouchDist = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let isTouchDragging = false;

        modalBody.ontouchstart = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                lastTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            } else if (e.touches.length === 1 && scale > 1) {
                isTouchDragging = true;
                lastTouchX = e.touches[0].clientX - translateX;
                lastTouchY = e.touches[0].clientY - translateY;
            }
        };

        modalBody.ontouchmove = (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const rect = modalImg.getBoundingClientRect();
                const offsetX = midX - rect.left - rect.width / 2;
                const offsetY = midY - rect.top - rect.height / 2;

                const oldScale = scale;
                scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (dist / lastTouchDist)));

                const ratio = scale / oldScale;
                translateX -= offsetX * (ratio - 1);
                translateY -= offsetY * (ratio - 1);

                // Also pan with two fingers
                translateX += midX - lastTouchX;
                translateY += midY - lastTouchY;

                lastTouchDist = dist;
                lastTouchX = midX;
                lastTouchY = midY;
                applyTransform();
            } else if (e.touches.length === 1 && isTouchDragging) {
                e.preventDefault();
                translateX = e.touches[0].clientX - lastTouchX;
                translateY = e.touches[0].clientY - lastTouchY;
                applyTransform();
            }
        };

        modalBody.ontouchend = (e) => {
            if (e.touches.length < 2) {
                lastTouchDist = 0;
            }
            if (e.touches.length === 0) {
                isTouchDragging = false;
            }
        };

        // Reset zoom when modal closes
        const observer = new MutationObserver(() => {
            if (!modal.classList.contains('active')) {
                resetZoom();
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
}
