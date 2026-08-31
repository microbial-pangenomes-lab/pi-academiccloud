# Academic Cloud Upstream Models Report

**Generated:** 2026-08-31  
**Upstream URL:** https://chat-ai.academiccloud.de/v1

## Summary

- **Models in upstream:** 15
- **Models in extension:** 16
- **Models only in upstream (missing from extension):** 2
- **Models only in extension (not found upstream):** 3
- **Models in both:** 13

---

## Models Only in Upstream (Add to Extension)

### `deepseek-v4-flash-0731`

- **Name:** deepseek-v4-flash-0731
- **Owned by:** chat-ai
- **Created:** 2026-08-31T08:46:51.000Z
- **Full model info:**
```json
{
  "owned_by": "chat-ai",
  "id": "deepseek-v4-flash-0731",
  "name": "DeepSeek V4 Flash 0731",
  "input": [
    "text"
  ],
  "object": "model",
  "created": 1788166011,
  "demand": 1,
  "status": "ready",
  "output": [
    "text"
  ]
}
```

---

### `qwen3.8-27b`

- **Name:** qwen3.8-27b
- **Owned by:** chat-ai
- **Created:** 2026-08-31T08:46:51.000Z
- **Full model info:**
```json
{
  "owned_by": "chat-ai",
  "id": "qwen3.8-27b",
  "name": "Qwen 3.8 27B",
  "input": [
    "text"
  ],
  "object": "model",
  "created": 1788166011,
  "demand": 13,
  "status": "ready",
  "output": [
    "text"
  ]
}
```


---

## Models Only in Extension (Not Found Upstream)

- `deepseek-v4-flash`
- `medgemma-27b-it`
- `qwen3.6-27b`

---

## Models in Both (Up to Date)

- `apertus-70b-instruct-2509` - chat-ai
- `meta-llama-3.1-8b-instruct` - chat-ai
- `qwen3-30b-a3b-instruct-2507` - chat-ai
- `glm-4.7` - chat-ai
- `mistral-medium-3.5-128b` - chat-ai
- `devstral-2-123b-instruct-2512` - chat-ai
- `qwen3-coder-next` - chat-ai
- `openai-gpt-oss-120b` - chat-ai
- `gemma-4-31b-it` - chat-ai
- `qwen3-omni-30b-a3b-instruct` - chat-ai
- `qwen3.6-35b-a3b` - chat-ai
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
- [ ] `deepseek-v4-flash-0731`
- [ ] `qwen3.8-27b`



### Remove or Update Missing Models

The following models are configured in the extension but not found upstream.
They may have been removed or renamed. Consider removing them or updating their IDs:

- [ ] `deepseek-v4-flash`
- [ ] `medgemma-27b-it`
- [ ] `qwen3.6-27b`


---

## Full Upstream Models List

| Model ID | Owned By | Created |
|----------|----------|---------|
| `apertus-70b-instruct-2509` | chat-ai | 2026-08-31 |
| `deepseek-v4-flash-0731` | chat-ai | 2026-08-31 |
| `qwen3.5-122b-a10b` | chat-ai | 2026-08-31 |
| `glm-4.7` | chat-ai | 2026-08-31 |
| `devstral-2-123b-instruct-2512` | chat-ai | 2026-08-31 |
| `qwen3-omni-30b-a3b-instruct` | chat-ai | 2026-08-31 |
| `qwen3-coder-next` | chat-ai | 2026-08-31 |
| `mistral-medium-3.5-128b` | chat-ai | 2026-08-31 |
| `qwen3.6-35b-a3b` | chat-ai | 2026-08-31 |
| `qwen3.8-27b` | chat-ai | 2026-08-31 |
| `qwen3.5-397b-a17b` | chat-ai | 2026-08-31 |
| `gemma-4-31b-it` | chat-ai | 2026-08-31 |
| `meta-llama-3.1-8b-instruct` | chat-ai | 2026-08-31 |
| `openai-gpt-oss-120b` | chat-ai | 2026-08-31 |
| `qwen3-30b-a3b-instruct-2507` | chat-ai | 2026-08-31 |
