export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function convertSvgToImage(svg, scale, outputType = 'blob') {
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

export function showButtonFeedback(button, successText, originalHtml, duration = 2000) {
    button.textContent = successText;
    button.classList.add('copied');
    setTimeout(() => {
        button.innerHTML = originalHtml;
        button.classList.remove('copied');
    }, duration);
}

export function getMermaidConfig(theme) {
    return {
        startOnLoad: false,
        theme,
        securityLevel: 'loose',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        logLevel: 'error'
    };
}
