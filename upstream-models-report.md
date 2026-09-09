# Academic Cloud Upstream Models Report

**Generated:** 2026-09-09  
**Upstream URL:** https://chat-ai.academiccloud.de/v1

## Summary

- **Models in upstream:** 16
- **Models in extension:** 15
- **Models only in upstream (missing from extension):** 1
- **Models only in extension (not found upstream):** 0
- **Models in both:** 15

---

## Models Only in Upstream (Add to Extension)

### `glm-5.3-flash`

- **Name:** glm-5.3-flash
- **Owned by:** chat-ai
- **Created:** 2026-09-09T10:11:36.000Z
- **Full model info:**
```json
{
  "owned_by": "chat-ai",
  "id": "glm-5.3-flash",
  "name": "GLM 5.3 Flash",
  "input": [
    "text",
    "image",
    "video"
  ],
  "object": "model",
  "created": 1788948696,
  "demand": 2,
  "status": "ready",
  "output": [
    "text"
  ]
}
```


---

## Models Only in Extension (Not Found Upstream)

*All extension models are present upstream.*

---

## Models in Both (Up to Date)

- `apertus-70b-instruct-2509` - chat-ai
- `meta-llama-3.1-8b-instruct` - chat-ai
- `qwen3-30b-a3b-instruct-2507` - chat-ai
- `glm-4.7` - chat-ai
- `deepseek-v4-flash-0731` - chat-ai
- `mistral-medium-3.5-128b` - chat-ai
- `devstral-2-123b-instruct-2512` - chat-ai
- `qwen3-coder-next` - chat-ai
- `openai-gpt-oss-120b` - chat-ai
- `gemma-4-31b-it` - chat-ai
- `qwen3-omni-30b-a3b-instruct` - chat-ai
- `qwen3.6-35b-a3b` - chat-ai
- `qwen3.8-27b` - chat-ai
- `qwen3.5-122b-a10b` - chat-ai
- `qwen3.5-397b-a17b` - chat-ai

---

## Recommended Actions


### Add New Models to Extension

The following models are available upstream but not configured in the extension.
To add them, update `src/academiccloud.ts` and add entries to the `models` array:

```typescript
{
  id: "<model-id>",
  name: "<Human-readable name>",
  reasoning: false, // or true if it's a reasoning model
  input: ["text"], // or ["text", "image"] for vision models
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: <context_window_size>,
  maxTokens: 8192,
  compat: vllmCompat, // or qwenCompat for Qwen models with reasoning
}
```

**Models to add:**
- [ ] `glm-5.3-flash`




---

## Full Upstream Models List

| Model ID | Owned By | Created |
|----------|----------|---------|
| `apertus-70b-instruct-2509` | chat-ai | 2026-09-09 |
| `devstral-2-123b-instruct-2512` | chat-ai | 2026-09-09 |
| `qwen3.8-27b` | chat-ai | 2026-09-09 |
| `deepseek-v4-flash-0731` | chat-ai | 2026-09-09 |
| `qwen3.5-122b-a10b` | chat-ai | 2026-09-09 |
| `glm-5.3-flash` | chat-ai | 2026-09-09 |
| `qwen3-coder-next` | chat-ai | 2026-09-09 |
| `qwen3-omni-30b-a3b-instruct` | chat-ai | 2026-09-09 |
| `mistral-medium-3.5-128b` | chat-ai | 2026-09-09 |
| `glm-4.7` | chat-ai | 2026-09-09 |
| `qwen3.5-397b-a17b` | chat-ai | 2026-09-09 |
| `gemma-4-31b-it` | chat-ai | 2026-09-09 |
| `qwen3.6-35b-a3b` | chat-ai | 2026-09-09 |
| `meta-llama-3.1-8b-instruct` | chat-ai | 2026-09-09 |
| `openai-gpt-oss-120b` | chat-ai | 2026-09-09 |
| `qwen3-30b-a3b-instruct-2507` | chat-ai | 2026-09-09 |
