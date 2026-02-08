import { t } from './i18n.js';

export class APIService {
    constructor(configManager) {
        this.configManager = configManager;
        this._xhr = null;
    }

    async streamMessage(messages, onChunk, onComplete) {
        const config = this.configManager.getConfig();
        const useProxy = this.configManager.useProxy();
        const customModel = this.configManager.getCustomModelConfig();

        if (!useProxy && !config.apiKey && !customModel) {
            throw new Error(t('error.noApiKey'));
        }

        if (customModel) {
            return this._streamXHR({
                url: `${customModel.base_url}/chat/completions`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customModel.api_key}`
                },
                body: { model: customModel.model.id, messages, stream: true },
                parseChunk: this._parseOpenAIChunk
            }, onChunk, onComplete);
        }

        const url = useProxy ? '/api/messages' : `${config.baseUrl}/v1/messages`;
        const headers = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        };
        if (!useProxy) {
            headers['x-api-key'] = config.apiKey;
        }

        const body = {
            model: config.model,
            max_tokens: 64000,
            messages,
            stream: true
        };
        if (config.webSearchEnabled) {
            body.tools = [{ type: "web_search_20250305", max_uses: 5 }];
        }

        return this._streamXHR({
            url,
            headers,
            body,
            parseChunk: this._parseChunk
        }, onChunk, onComplete);
    }

    _streamXHR({ url, headers, body, parseChunk }, onChunk, onComplete) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this._xhr = xhr;

            let fullContent = '';
            let processedLength = 0;

            const extractDeltas = (text) => {
                const lines = text.split('\n');
                const deltas = [];
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    const delta = parseChunk(data);
                    if (delta) deltas.push(delta);
                }
                return deltas;
            };

            xhr.open('POST', url);
            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }

            const processNewData = () => {
                try {
                    const text = xhr.responseText;
                    if (text.length <= processedLength) return;
                    const newText = text.substring(processedLength);
                    processedLength = text.length;

                    for (const delta of extractDeltas(newText)) {
                        fullContent += delta;
                        if (onChunk) onChunk(delta, fullContent);
                    }
                } catch (e) {
                }
            };

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 3) processNewData();
            };
            xhr.onprogress = processNewData;

            xhr.onload = () => {
                this._xhr = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    const remaining = xhr.responseText.substring(processedLength);
                    if (remaining) {
                        for (const delta of extractDeltas(remaining)) {
                            fullContent += delta;
                        }
                    }
                    if (onComplete) onComplete(fullContent);
                    resolve(fullContent);
                } else {
                    let errorMsg = t('error.requestFailed');
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMsg = errorData.error?.message || errorMsg;
                    } catch (e) {
                    }
                    reject(new Error(errorMsg));
                }
            };

            xhr.onerror = () => {
                this._xhr = null;
                reject(new Error(t('error.requestFailed')));
            };

            xhr.onabort = () => {
                this._xhr = null;
                const err = new Error(t('error.aborted'));
                err.name = 'AbortError';
                reject(err);
            };

            xhr.send(JSON.stringify(body));
        });
    }

    _parseOpenAIChunk(data) {
        try {
            const json = JSON.parse(data);
            return json.choices?.[0]?.delta?.content || '';
        } catch (e) {
            return '';
        }
    }

    _parseChunk(data) {
        try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
                return json.delta.text;
            }
        } catch (e) {
        }
        return '';
    }

    abort() {
        if (this._xhr) {
            this._xhr.abort();
        }
    }

    isRequesting() {
        return this._xhr !== null;
    }
}
