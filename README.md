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

## Models

This extension provides two providers:

### `academiccloud`

Standard provider with OpenAI-compatible API for most models.

### `academiccloud-qwen35`

Special provider for Qwen 3.5 models (122B and 397B) with custom tool call parsing to work around server-side limitations.

## Available Models

**Note: this list is updated as of 2026/05/29**

- Apertus 70B Instruct 2509
- Llama 3.1 8B Instruct
- Llama 3.3 70B Instruct
- Qwen 3 30B A3B Instruct 2507
- GLM-4.7
- Teuken 7B Instruct Research
- DeepSeek R1 Distill Llama 70B
- Devstral 2 123B Instruct 2512 (Coding)
- Qwen 3 Coder 30B A3B Instruct
- OpenAI GPT OSS 120B
- Gemma 3 27B Instruct (Vision)
- Gemma 4 31B Instruct (Vision)
- InternVL 3.5 30B A3B (Vision)
- MedGemma 27B Instruct (Medical, Vision)
- Mistral Large 3 675B Instruct 2512 (Vision)
- Qwen 3 Omni 30B A3B Instruct (Multimodal)
- Qwen 3.5 27B/35B/3.6 35B (Vision)
- Qwen 3.5 122B A10B / 397B A17B (via academiccloud-qwen35 provider)

## License

MIT
