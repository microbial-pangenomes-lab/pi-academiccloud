# Academic Cloud Upstream Models Report

**Generated:** 2026-11-03  
**Upstream URL:** https://chat-ai.academiccloud.de/v1

## Summary

- **Models in upstream:** 14
- **Models in extension:** 13
- **Models only in upstream (missing from extension):** 1
- **Models only in extension (not found upstream):** 0
- **Models in both:** 13

---

## Models Only in Upstream (Add to Extension)

### `glm-5.3`

- **Name:** glm-5.3
- **Owned by:** chat-ai
- **Created:** 2026-10-26T16:22:46.000Z
- **Full model info:**
```json
{
  "id": "glm-5.3",
  "object": "model",
  "owned_by": "chat-ai",
  "created": 1793031766,
  "name": "GLM 5.3",
  "status": "ready",
  "demand": 0,
  "input": [
    "text"
  ],
  "output": [
    "text",
    "thought"
  ]
}
```


---

## Models Only in Extension (Not Found Upstream)

*All extension models are present upstream.*

---

## Models in Both (Up to Date)

- `meta-llama-3.1-8b-instruct` - chat-ai
- `qwen3-30b-a3b-instruct-2507` - chat-ai
- `eurollm-22b-instruct-2512` - chat-ai
- `deepseek-v4-flash-0731` - chat-ai
- `deepseek-v4.1-flash-1017` - chat-ai
- `mistral-large-4-1t-a52b` - chat-ai
- `qwen3-coder-next` - chat-ai
- `glm-5.3-flash` - chat-ai
- `qwen3-omni-30b-a3b-instruct` - chat-ai
- `qwen3.6-35b-a3b` - chat-ai
- `qwen3.8-27b` - chat-ai
- `gemma-4-31b-it` - chat-ai
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
- [ ] `glm-5.3`




---

## Full Upstream Models List

| Model ID | Owned By | Created |
|----------|----------|---------|
| `deepseek-v4-flash-0731` | chat-ai | 2026-07-01 |
| `deepseek-v4.1-flash-1017` | chat-ai | 2026-10-26 |
| `eurollm-22b-instruct-2512` | chat-ai | 2026-07-31 |
| `gemma-4-31b-it` | chat-ai | 2026-05-05 |
| `glm-5.3` | chat-ai | 2026-10-26 |
| `glm-5.3-flash` | chat-ai | 2026-08-28 |
| `meta-llama-3.1-8b-instruct` | chat-ai | 2026-03-05 |
| `mistral-large-4-1t-a52b` | chat-ai | 2026-10-30 |
| `qwen3-30b-a3b-instruct-2507` | chat-ai | 2026-03-05 |
| `qwen3-coder-next` | chat-ai | 2026-07-01 |
| `qwen3-omni-30b-a3b-instruct` | chat-ai | 2026-03-05 |
| `qwen3.5-397b-a17b` | chat-ai | 2026-04-22 |
| `qwen3.6-35b-a3b` | chat-ai | 2026-05-05 |
| `qwen3.8-27b` | chat-ai | 2026-08-27 |
