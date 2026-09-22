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

2. Install dependencies and build:
```bash
cd pi-academiccloud
npm install
npm run build
```

3. Copy the built extension to your Pi extensions directory:
```bash
cp dist/academiccloud.js ~/.pi/agent/extensions/
```

## Configuration

Set the following environment variable:

```bash
export ACADEMICCLOUD_API_KEY="your-api-key"
```

Or add it to your shell configuration file (`.bashrc`, `.zshrc`, etc.).

## Providers

This extension registers three providers, all pointed at the same Academic Cloud endpoint and API key:

- `academiccloud` — most models.
- `academiccloud-gemma4` — Gemma 4 31B Instruct only.
- `academiccloud-qwen35` — Qwen 3.5 397B A17B only.

Gemma 4 and Qwen 3.5 397B get their own provider because their vLLM backend has broken server-side tool-call parsing; each needs a custom `streamSimple` handler that reparses tool calls from the raw response text. Pi only wires up a provider's custom `streamSimple` for models registered under that *same* provider, so each workaround needs its own dedicated provider rather than living alongside the regular models under `academiccloud`. This is otherwise transparent to the user beyond selecting the model — e.g. `pi --provider academiccloud-gemma4 --model gemma-4-31b-it`.

## Available Models

**Note: this list is updated as of 2026-09-21**

- Apertus 70B Instruct 2509
- Llama 3.1 8B Instruct
- Qwen 3 30B A3B Instruct 2507
- DeepSeek V4 Flash 0731
- Mistral Medium 3.5 128B
- Devstral 2 123B Instruct 2512 (Coding)
- Qwen 3 Coder Next (Coding, Reasoning)
- OpenAI GPT OSS 120B
- GLM 5.3 Flash (Multimodal)
- Gemma 4 31B Instruct (Vision)
- Qwen 3 Omni 30B A3B Instruct (Multimodal, Reasoning)
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
