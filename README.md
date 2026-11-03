# Pi Academic Cloud Extension

A [Pi](https://github.com/earendil-works/pi/tree/main/packages/coding-agent) extension that provides access to Academic Cloud AI models.

## Installation

### From GitHub (recommended)

```bash
pi install https://github.com/microbial-pangenomes-lab/pi-academiccloud
```

### Manual installation

1. Clone this repository:
```bash
git clone https://github.com/microbial-pangenomes-lab/pi-academiccloud.git
```

2. Install it as a local package (Pi loads the TypeScript sources directly, no build step needed):
```bash
pi install ./pi-academiccloud
```

### Development

`npm install` pulls in TypeScript and the Pi packages as dev dependencies for type-checking (`npm run typecheck`). They are not installed when Pi installs the extension, since Pi provides them at runtime.

## Configuration

Set the following environment variable:

```bash
export ACADEMICCLOUD_API_KEY="your-api-key"
```

Or add it to your shell configuration file (`.bashrc`, `.zshrc`, etc.).

API keys are managed in the Saia API key dashboard at https://saia.gwdg.de.

## Rate Limits

Since the migration to the Saia 2 platform (November 2026) the default limits, shared between the API and the Chat-AI web interface, are:

- 2 requests per 10 seconds
- 200 requests per hour
- 400 requests per day
- 3000 requests per month

Every model call counts as a request, including each step of an agent's tool-use loop, so the daily limit can be reached quickly. While an Academic Cloud model is active, the footer shows usage for each window (`10s:1/2 hr:12/200 day:40/400 mo:350/3000`), read from the `x-ratelimit-*` response headers; an exhausted window also shows the time until it resets. Contact support@gwdg.de if you need higher limits.

## Providers

This extension registers three providers, all pointed at the same Academic Cloud endpoint and API key:

- `academiccloud` — most models.
- `academiccloud-gemma4` — Gemma 4 31B Instruct only.
- `academiccloud-qwen35` — Qwen 3.5 397B A17B only.

Gemma 4 and Qwen 3.5 397B get their own provider because their vLLM backend has broken server-side tool-call parsing; each needs a custom `streamSimple` handler that reparses tool calls from the raw response text. Pi only wires up a provider's custom `streamSimple` for models registered under that *same* provider, so each workaround needs its own dedicated provider rather than living alongside the regular models under `academiccloud`. This is otherwise transparent to the user beyond selecting the model — e.g. `pi --provider academiccloud-gemma4 --model gemma-4-31b-it`.

## Available Models

**Note: this list is updated as of 2026-11-03**

- Llama 3.1 8B Instruct
- Qwen 3 30B A3B Instruct 2507
- EuroLLM 22B Instruct 2512 (no tool calls — use with `pi --no-tools`)
- DeepSeek V4 Flash 0731 (Reasoning)
- DeepSeek V4.1 Flash 1017 (Reasoning)
- GLM 5.3 (Reasoning; always reasons, thinking level has no effect)
- Mistral Large 4 1T A52B (Vision, Reasoning; always reasons, effort low/medium/high)
- Qwen 3 Coder Next (Coding)
- GLM 5.3 Flash (Multimodal, Reasoning)
- Gemma 4 31B Instruct (Vision, Reasoning, custom tool-call handler)
- Qwen 3 Omni 30B A3B Instruct (Multimodal)
- Qwen 3.6 35B A3B (Vision, Reasoning)
- Qwen 3.8 27B (Reasoning)
- Qwen 3.5 397B A17B (Vision, Reasoning, custom tool-call handler)

### Checking for Model Updates

To check if new models are available upstream and generate a report:

```bash
npm run check-upstream
```

This creates `upstream-models-report.md` with a comparison of upstream vs extension models. The script automatically uses the API key from `~/.pi/agent/auth.json` or the `ACADEMICCLOUD_API_KEY` environment variable.

## License

MIT
