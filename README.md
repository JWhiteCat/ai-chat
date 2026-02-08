# AI Chat

[中文文档](README_zh.md)

A lightweight, multi-LLM web chat application. Defaults to Claude (Anthropic), but supports any OpenAI-compatible API.

---

[WebLLM Chat Demo Video](assets/ai-chat-demo.webm)

## Features

- **Multi-LLM Support** — Claude models by default; any OpenAI-compatible API via custom model config
- **Real-time Streaming** — Token-by-token output with progressive rendering
- **Multi-turn Conversations** — Automatic context maintenance with history management (create / switch / delete)
- **Rich Content Rendering** — Markdown, syntax highlighting (10+ languages), one-click code copying
- **Mermaid Diagrams** — Flowcharts, sequence diagrams, class diagrams, etc. with export to image
- **Web Search** — Optional built-in web search toggle
- **Themes** — Dark / Light mode with smooth transitions
- **Bilingual UI** — English and Chinese interface with instant switching
- **Two Connection Modes** — Direct API access or server-proxied requests
- **Mobile Friendly** — Responsive layout, touch-friendly controls, mobile sidebar overlay, safe-area-inset support, XHR streaming for iOS compatibility

---

## Quick Start

### Option 1: Open Directly (Direct Mode)

1. Open `static/index.html` in a browser
2. Enter your API Key and Base URL on first use
3. Start chatting

### Option 2: Python Server

```bash
python web_server.py        # Default port 8080
python web_server.py 3000   # Custom port
```

Then visit http://localhost:8080

---

## Connection Modes

### Direct Mode (Default)

The frontend calls the LLM API directly. Users provide their own API Key.

- API Key is stored in the browser's `localStorage` (per-browser)
- Custom Base URL supported (for third-party proxies)
- Default models: Claude Sonnet 4.5 / Haiku 4.5

### Proxy Mode

The Python server forwards API requests so the API Key stays on the server side.

To enable:

1. Set `api_key` in `config.json`
2. Start `web_server.py`
3. Toggle "Proxy Mode" in the sidebar

```json
{
    "api_key": "sk-ant-your-key-here",
    "base_url": "https://api.anthropic.com",
    "allowed_models": [
        { "id": "claude-sonnet-4-5-20250929", "name": "Sonnet 4.5", "default": true },
        { "id": "claude-haiku-4-5-20251001", "name": "Haiku 4.5" }
    ]
}
```

Proxy mode benefits:

- API Key is never exposed to the frontend
- Server controls which models are available
- Suitable for team sharing or deployment

---

## Custom Models

You can connect to any OpenAI-compatible API provider (SiliconFlow, OpenRouter, etc.) via the custom model feature in settings. The app uses the standard `/chat/completions` endpoint with streaming.

---

## Project Structure

```
├── config.json                     # Server config (API key, allowed models)
├── web_server.py                   # Python web server (static files + API proxy)
├── requirements.txt                # Python dependencies
├── static/
│   ├── index.html                  # Main page
│   ├── styles.css                  # Styles
│   └── js/                         # Modular JavaScript
│       ├── app.js                  # Main app, initialization & event binding
│       ├── api-service.js          # API communication (direct / proxy / OpenAI-compatible)
│       ├── config-manager.js       # Configuration management (mode switching, model selection)
│       ├── conversation-manager.js # Conversation management
│       ├── ui-manager.js           # UI rendering
│       ├── markdown-renderer.js    # Markdown rendering
│       ├── mermaid-renderer.js     # Mermaid diagram rendering
│       ├── storage.js              # localStorage wrapper
│       ├── utils.js                # Utility functions
│       ├── i18n.js                 # Internationalization engine
│       └── translations.js         # Translation strings (en / zh)
```

---

## Reconfigure API

Run in the browser console:

```javascript
// Re-enter API Key
app.configManager.showConfigPrompt()

// Or clear config and reload
localStorage.removeItem('claude_api_config')
location.reload()
```

---

## Default Models

| Model ID | Name | Notes |
|---|---|---|
| `claude-sonnet-4-5-20250929` | Sonnet 4.5 | Balanced performance and cost (recommended) |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | Fast responses, lowest cost |

> You can also add any model from any OpenAI-compatible provider via custom model settings.

---

## Mobile Support

The app is fully optimized for mobile devices:

- Responsive layout that adapts to any screen size
- Touch-friendly controls and tap targets
- Sidebar overlay with swipe-to-close on mobile
- `safe-area-inset` support for notched devices
- XHR-based streaming for reliable performance on iOS (avoids `fetch` streaming issues on Safari)

---

## Tech Stack

**Backend**
- Python 3 with built-in `http.server` (CORS-enabled)
- `urllib` for API proxying with streaming

**Frontend**
- Vanilla JavaScript (ES6 modules, no frameworks)
- [marked.js](https://github.com/markedjs/marked) — Markdown rendering
- [highlight.js](https://github.com/highlightjs/highlight.js) — Syntax highlighting
- [mermaid.js](https://github.com/mermaid-js/mermaid) — Diagram rendering
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) — Markdown styling

---

## License

MIT License
