#!/usr/bin/env node
/**
 * Script to check which models are available upstream (in Academic Cloud)
 * and generate a markdown report comparing them with the extension's models.
 * 
 * The script automatically reads the API key from:
 *   1. ACADEMICCLOUD_API_KEY environment variable (highest priority)
 *   2. ~/.pi/agent/auth.json (pi's default auth file)
 * 
 * Usage:
 *   npm run check-upstream
 * 
 * Or:
 *   npx tsx scripts/check-upstream-models.ts
 * 
 * Output:
 *   Creates upstream-models-report.md in the project root
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACADEMICCLOUD_BASE_URL = "https://chat-ai.academiccloud.de/v1";
const OUTPUT_FILE = path.join(__dirname, "../upstream-models-report.md");

// Models currently defined in the extension (from academiccloud.ts)
const EXTENSION_MODELS = [
  "apertus-70b-instruct-2509",
  "meta-llama-3.1-8b-instruct",
  "llama-3.3-70b-instruct",
  "qwen3-30b-a3b-instruct-2507",
  "glm-4.7",
  "teuken-7b-instruct-research",
  "deepseek-r1-distill-llama-70b",
  "devstral-2-123b-instruct-2512",
  "qwen3-coder-30b-a3b-instruct",
  "openai-gpt-oss-120b",
  "gemma-3-27b-it",
  "gemma-4-31b-it",
  "internvl3.5-30b-a3b",
  "medgemma-27b-it",
  "mistral-large-3-675b-instruct-2512",
  "qwen3-omni-30b-a3b-instruct",
  "qwen3.5-27b",
  "qwen3.5-35b-a3b",
  "qwen3.6-35b-a3b",
  "qwen3.5-122b-a10b",
  "qwen3.5-397b-a17b",
];

interface UpstreamModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  [key: string]: any;
}

function getApiKey(): string | null {
  // Priority 1: Environment variable
  if (process.env.ACADEMICCLOUD_API_KEY) {
    return process.env.ACADEMICCLOUD_API_KEY;
  }

  // Priority 2: Read from pi's auth.json
  try {
    const authPath = path.join(process.env.HOME || "", ".pi", "agent", "auth.json");
    if (fs.existsSync(authPath)) {
      const authData = JSON.parse(fs.readFileSync(authPath, "utf-8"));
      // Check for academiccloud key
      if (authData.academiccloud?.key) {
        return authData.academiccloud.key;
      }
      if (authData["academiccloud-qwen35"]?.key) {
        return authData["academiccloud-qwen35"].key;
      }
    }
  } catch (error) {
    console.warn("Warning: Could not read pi auth.json:", error);
  }

  return null;
}

async function fetchUpstreamModels(): Promise<UpstreamModel[]> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("Warning: No API key found.");
    console.warn("Please set ACADEMICCLOUD_API_KEY or ensure ~/.pi/agent/auth.json contains the key.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(`${ACADEMICCLOUD_BASE_URL}/models`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      console.error("Unexpected response format:", JSON.stringify(data, null, 2));
      return [];
    }
  } catch (error) {
    console.error("Error fetching upstream models:", error);
    throw error;
  }
}

function generateMarkdownReport(
  upstreamModels: UpstreamModel[],
  extensionModels: string[]
): string {
  const upstreamIds = new Set(upstreamModels.map((m) => m.id));
  const extensionSet = new Set(extensionModels);

  const modelsOnlyInUpstream = upstreamModels.filter(
    (m) => !extensionSet.has(m.id)
  );
  const modelsOnlyInExtension = extensionModels.filter(
    (id) => !upstreamIds.has(id)
  );
  const modelsInBoth = extensionModels.filter((id) => upstreamIds.has(id));

  const reportDate = new Date().toISOString().split("T")[0];

  let markdown = `# Academic Cloud Upstream Models Report

**Generated:** ${reportDate}  
**Upstream URL:** ${ACADEMICCLOUD_BASE_URL}

## Summary

- **Models in upstream:** ${upstreamModels.length}
- **Models in extension:** ${extensionModels.length}
- **Models only in upstream (missing from extension):** ${modelsOnlyInUpstream.length}
- **Models only in extension (not found upstream):** ${modelsOnlyInExtension.length}
- **Models in both:** ${modelsInBoth.length}

---

## Models Only in Upstream (Add to Extension)

${modelsOnlyInUpstream.length > 0 ? modelsOnlyInUpstream.map((model) => {
  return `### \`${model.id}\`

- **Name:** ${model.id}
- **Owned by:** ${model.owned_by || "unknown"}
- **Created:** ${model.created ? new Date(model.created * 1000).toISOString() : "unknown"}
- **Full model info:**
\`\`\`json
${JSON.stringify(model, null, 2)}
\`\`\`
`;
}).join("\n---\n\n") : "*No models found only in upstream.*"}

---

## Models Only in Extension (Not Found Upstream)

${modelsOnlyInExtension.length > 0 ? modelsOnlyInExtension.map((id) => {
  return `- \`${id}\``;
}).join("\n") : "*All extension models are present upstream.*"}

---

## Models in Both (Up to Date)

${modelsInBoth.length > 0 ? modelsInBoth.map((id) => {
  const upstreamModel = upstreamModels.find((m) => m.id === id);
  return `- \`${id}\` - ${upstreamModel?.owned_by || "unknown"}`;
}).join("\n") : "*No models in common.*"}

---

## Recommended Actions

${modelsOnlyInUpstream.length > 0 ? `
### Add New Models to Extension

The following models are available upstream but not configured in the extension.
To add them, update \`src/academiccloud.ts\` and add entries to the \`models\` array:

\`\`\`typescript
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
\`\`\`

**Models to add:**
${modelsOnlyInUpstream.map((m) => `- [ ] \`${m.id}\``).join("\n")}
` : "All upstream models are already configured in the extension."}

${modelsOnlyInExtension.length > 0 ? `
### Remove or Update Missing Models

The following models are configured in the extension but not found upstream.
They may have been removed or renamed. Consider removing them or updating their IDs:

${modelsOnlyInExtension.map((id) => `- [ ] \`${id}\``).join("\n")}
` : ""}

---

## Full Upstream Models List

| Model ID | Owned By | Created |
|----------|----------|---------|
${upstreamModels.map((m) => `| \`${m.id}\` | ${m.owned_by || "unknown"} | ${m.created ? new Date(m.created * 1000).toISOString().split("T")[0] : "unknown"} |`).join("\n")}
`;

  return markdown;
}

async function main() {
  console.log("Fetching models from Academic Cloud upstream...");
  console.log(`Base URL: ${ACADEMICCLOUD_BASE_URL}`);
  console.log("");
  console.log("Note: Set ACADEMICCLOUD_API_KEY environment variable to access all models.");
  console.log("");

  try {
    let upstreamModels: UpstreamModel[];
    try {
      upstreamModels = await fetchUpstreamModels();
    } catch (fetchError) {
      console.error("Failed to fetch from API:", fetchError);
      console.error("");
      console.error("Please ensure ACADEMICCLOUD_API_KEY is set correctly.");
      console.error("");
      console.error("Example:");
      console.error("  export ACADEMICCLOUD_API_KEY=\"your-api-key\"");
      console.error("  npm run check-upstream");
      console.error("");
      process.exit(1);
    }
    
    console.log(`Found ${upstreamModels.length} models upstream`);
    console.log(`Extension has ${EXTENSION_MODELS.length} models configured`);
    console.log("");

    const report = generateMarkdownReport(upstreamModels, EXTENSION_MODELS);

    fs.writeFileSync(OUTPUT_FILE, report, "utf-8");
    console.log(`Report written to: ${OUTPUT_FILE}`);
    console.log("");

    // Also print a summary to stdout
    const upstreamIds = new Set(upstreamModels.map((m) => m.id));
    const extensionSet = new Set(EXTENSION_MODELS);
    
    const onlyUpstream = upstreamModels.filter((m) => !extensionSet.has(m.id));
    const onlyExtension = EXTENSION_MODELS.filter((id) => !upstreamIds.has(id));

    if (onlyUpstream.length > 0) {
      console.log("Models only in upstream (not in extension):");
      onlyUpstream.forEach((m) => console.log(`  - ${m.id}`));
      console.log("");
    }

    if (onlyExtension.length > 0) {
      console.log("Models only in extension (not upstream):");
      onlyExtension.forEach((id) => console.log(`  - ${id}`));
      console.log("");
    }

    if (onlyUpstream.length === 0 && onlyExtension.length === 0) {
      console.log("✓ Extension models are in sync with upstream!");
    }
  } catch (error) {
    console.error("Failed to generate report:", error);
    process.exit(1);
  }
}

main();
