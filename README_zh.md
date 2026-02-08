# AI Chat

[English](README.md)

一个轻量级、支持多种大语言模型的 Web 聊天应用。默认使用 Claude（Anthropic），同时支持任何 OpenAI 兼容 API。

---

## 功能特性

- **多模型支持** — 默认 Claude 模型，可通过自定义模型接入任何 OpenAI 兼容 API
- **实时流式输出** — 逐 token 输出，渐进式渲染
- **多轮对话** — 自动维护上下文，支持对话管理（新建 / 切换 / 删除）
- **富文本渲染** — Markdown、代码高亮（10+ 语言）、一键复制代码块
- **Mermaid 图表** — 流程图、序列图、类图等，支持导出为图片
- **联网搜索** — 可选的内置联网搜索功能
- **主题切换** — 暗色 / 亮色主题，平滑过渡
- **双语界面** — 中英文界面即时切换
- **两种连接模式** — 直连 API 或通过服务器代理
- **移动端适配** — 响应式布局、触控友好、移动端侧边栏浮层、安全区域适配、XHR 流式传输兼容 iOS

---

## 快速开始

### 方式一：直接打开（直连模式）

1. 用浏览器打开 `static/index.html`
2. 首次使用会提示输入 API Key 和 Base URL
3. 开始对话

### 方式二：通过 Python 服务器

```bash
python web_server.py        # 默认端口 8080
python web_server.py 3000   # 指定端口
```

打开浏览器访问 http://localhost:8080

---

## 连接模式

### 直连模式（默认）

前端直接调用 LLM API，需要用户自己提供 API Key。

- API Key 存储在浏览器 `localStorage` 中，每个浏览器独立
- 支持自定义 Base URL（用于第三方代理）
- 默认可选模型：Claude Sonnet 4.5 / Haiku 4.5

### 代理模式

通过 Python 服务器转发 API 请求，API Key 配置在服务端，不暴露给浏览器。

启用方式：

1. 在 `config.json` 中配置 `api_key`
2. 启动 `web_server.py`
3. 在侧边栏开启「代理模式」

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

代理模式特点：

- API Key 不暴露给前端
- 服务端可限制允许使用的模型
- 适合团队共享或部署场景

---

## 自定义模型

可在设置中通过自定义模型功能接入任意 OpenAI 兼容 API（SiliconFlow、OpenRouter 等）。应用使用标准的 `/chat/completions` 端点进行流式通信。

---

## 项目结构

```
├── config.json                     # 服务端配置（API Key、允许模型等）
├── web_server.py                   # Python Web 服务器（静态文件 + API 代理）
├── requirements.txt                # Python 依赖
├── static/
│   ├── index.html                  # 主页面
│   ├── styles.css                  # 样式
│   └── js/                         # 模块化 JavaScript
│       ├── app.js                  # 主应用，初始化与事件绑定
│       ├── api-service.js          # API 通信（直连 / 代理 / OpenAI 兼容）
│       ├── config-manager.js       # 配置管理（模式切换、模型选择）
│       ├── conversation-manager.js # 对话管理
│       ├── ui-manager.js           # UI 渲染
│       ├── markdown-renderer.js    # Markdown 渲染
│       ├── mermaid-renderer.js     # Mermaid 图表渲染
│       ├── storage.js              # localStorage 封装
│       ├── utils.js                # 工具函数
│       ├── i18n.js                 # 国际化引擎
│       └── translations.js         # 翻译文本（中 / 英）
```

---

## 重新配置 API

浏览器控制台执行：

```javascript
// 重新输入 API Key
app.configManager.showConfigPrompt()

// 或清除配置重来
localStorage.removeItem('claude_api_config')
location.reload()
```

---

## 默认模型

| Model ID | 名称 | 说明 |
|---|---|---|
| `claude-sonnet-4-5-20250929` | Sonnet 4.5 | 平衡性能和成本（推荐） |
| `claude-haiku-4-5-20251001` | Haiku 4.5 | 快速响应，成本最低 |

> 也可通过自定义模型设置接入任何 OpenAI 兼容服务商的模型。

---

## 移动端适配

应用针对移动设备做了全面优化：

- 响应式布局，自适应各种屏幕尺寸
- 触控友好的交互控件
- 移动端侧边栏浮层，支持滑动关闭
- `safe-area-inset` 安全区域适配（刘海屏等）
- 基于 XHR 的流式传输，确保 iOS Safari 上的稳定性（规避 `fetch` 流式兼容问题）

---

## 技术栈

**后端**
- Python 3，使用内置 `http.server`（已启用 CORS）
- `urllib` 实现 API 代理与流式转发

**前端**
- 原生 JavaScript（ES6 模块，无框架依赖）
- [marked.js](https://github.com/markedjs/marked) — Markdown 渲染
- [highlight.js](https://github.com/highlightjs/highlight.js) — 代码高亮
- [mermaid.js](https://github.com/mermaid-js/mermaid) — 图表渲染
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css) — Markdown 样式

---

## 许可证

MIT License
