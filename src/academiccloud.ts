import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  type Api,
  type AssistantMessage,
  type Context,
  type ImageContent,
  type Model,
  type SimpleStreamOptions,
  type TextContent,
  type ThinkingContent,
  type ToolCall,
  type ToolResultMessage,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";

// =============================================================================
// Tool call parser for Qwen native <tool_call> format
// =============================================================================

function parseQwenToolCalls(
  text: string,
): { name: string; arguments: Record<string, any> }[] {
  const toolCalls: { name: string; arguments: Record<string, any> }[] = [];

  // Format 1: JSON inside <tool_call> — Qwen's native format
  // <tool_call>\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>
  const jsonRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
  let match;
  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name) {
        toolCalls.push({ name: parsed.name, arguments: parsed.arguments ?? parsed.parameters ?? {} });
      }
    } catch {
      // ignore malformed JSON
    }
  }
  if (toolCalls.length > 0) return toolCalls;

  // Format 2: XML parameter format (legacy fallback)
  // <tool_call><function=NAME><parameter=NAME>...</parameter></function></tool_call>
  const xmlRegex =
    /<tool_call>\s*<function=(\w+)>([\s\S]*?)<\/function>\s*<\/tool_call>/g;
  while ((match = xmlRegex.exec(text)) !== null) {
    const funcName = match[1];
    const paramSection = match[2];
    const args: Record<string, any> = {};
    const paramRegex = /<parameter=(\w+)>\s*([\s\S]*?)\s*<\/parameter>/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramSection)) !== null) {
      const value = paramMatch[2].trim();
      try {
        args[paramMatch[1]] = JSON.parse(value);
      } catch {
        args[paramMatch[1]] = value;
      }
    }
    toolCalls.push({ name: funcName, arguments: args });
  }
  return toolCalls;
}

// =============================================================================
// OpenAI message conversion
// =============================================================================

function convertMessages(context: Context): any[] {
  const messages: any[] = [];

  if (context.systemPrompt) {
    messages.push({ role: "system", content: context.systemPrompt });
  }

  for (let i = 0; i < context.messages.length; i++) {
    const msg = context.messages[i];

    if (msg.role === "user") {
      if (typeof msg.content === "string") {
        messages.push({ role: "user", content: msg.content });
      } else {
        const parts = msg.content.map((c) =>
          c.type === "text"
            ? { type: "text", text: (c as TextContent).text }
            : {
                type: "image_url",
                image_url: {
                  url: `data:${(c as ImageContent).mimeType};base64,${(c as ImageContent).data}`,
                },
              },
        );
        messages.push({
          role: "user",
          content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts,
        });
      }
    } else if (msg.role === "assistant") {
      const textParts = msg.content
        .filter((c) => c.type === "text")
        .map((c) => (c as TextContent).text)
        .join("");
      const toolCalls = msg.content
        .filter((c): c is ToolCall => c.type === "toolCall")
        .map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));

      const assistantMsg: any = { role: "assistant" };
      if (textParts) assistantMsg.content = textParts;
      else assistantMsg.content = null;
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      messages.push(assistantMsg);
    } else if (msg.role === "toolResult") {
      const toolMsg = msg as ToolResultMessage;
      messages.push({
        role: "tool",
        tool_call_id: toolMsg.toolCallId,
        content: toolMsg.content
          .map((c) => (c.type === "text" ? (c as TextContent).text : ""))
          .join(""),
      });
    }
  }

  return messages;
}

function convertTools(tools: Context["tools"]): any[] {
  if (!tools) return [];
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// =============================================================================
// Custom handler for Qwen 3.5 models with broken server-side tool call parsing.
// The vLLM backend for these models emits tool calls as <tool_call> text in the
// content field instead of proper OpenAI tool_calls. Worse, in streaming mode
// the server strips the <tool_call> tokens entirely. We work around this by
// using non-streaming requests and parsing tool calls from the text content.
// =============================================================================

function streamQwen35ToolFix(
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) {
  const eventStream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    try {
      const apiKey = options?.apiKey ?? "";
      const messages = convertMessages(context);

      const params: any = {
        model: model.id,
        messages,
        stream: false,
        max_tokens: options?.maxTokens || model.maxTokens,
      };

      if (context.tools && context.tools.length > 0) {
        params.tools = convertTools(context.tools);
      }

      if (model.reasoning && options?.reasoning) {
        params.enable_thinking = true;
      } else {
        params.enable_thinking = false;
      }

      if (options?.temperature !== undefined) {
        params.temperature = options.temperature;
      }

      const response = await fetch(`${model.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(params),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(
          `API error: ${response.status} ${await response.text()}`,
        );
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      // Parse usage
      if (data.usage) {
        output.usage.input = data.usage.prompt_tokens || 0;
        output.usage.output = data.usage.completion_tokens || 0;
        output.usage.totalTokens = data.usage.total_tokens || 0;
      }

      eventStream.push({ type: "start", partial: output });

      // Check for proper tool_calls from the API first
      const apiToolCalls = message?.tool_calls;
      if (apiToolCalls && apiToolCalls.length > 0) {
        // Emit reasoning as thinking before tool calls if present
        const preCallReasoning = message?.reasoning_content ?? message?.reasoning;
        if (preCallReasoning && preCallReasoning.trim()) {
          const thinkText = preCallReasoning.trim();
          output.content.push({ type: "thinking", thinking: thinkText } as ThinkingContent);
          const idx = output.content.length - 1;
          eventStream.push({ type: "thinking_start", contentIndex: idx, partial: output });
          eventStream.push({ type: "thinking_delta", contentIndex: idx, delta: thinkText, partial: output });
          eventStream.push({ type: "thinking_end", contentIndex: idx, content: thinkText, partial: output });
        }
        for (const tc of apiToolCalls) {
          let args: Record<string, any> = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const toolCall: ToolCall = {
            type: "toolCall",
            id: tc.id || `toolcall-${crypto.randomUUID()}`,
            name: tc.function?.name || "",
            arguments: args,
          };
          output.content.push(toolCall);
          const idx = output.content.length - 1;
          eventStream.push({ type: "toolcall_start", contentIndex: idx, partial: output });
          eventStream.push({ type: "toolcall_delta", contentIndex: idx, delta: tc.function?.arguments || "{}", partial: output });
          eventStream.push({ type: "toolcall_end", contentIndex: idx, toolCall, partial: output });
        }
        output.stopReason = "toolUse";
        eventStream.push({ type: "done", reason: "toolUse", message: output });
      } else {
        // Check for reasoning field (Qwen 3.5/3.6 models put response in reasoning when content is null)
        const reasoning = message?.reasoning_content ?? message?.reasoning;
        const content = message?.content;

        if (reasoning && !content) {
          // Response is in reasoning field - need to extract actual response from thinking process
          // The reasoning typically contains "Thinking Process:\n\n...\n\n**Final Output:** or **Output:** <actual response>"
          // or just ends with the actual response after the thinking
          
          // Try to extract the actual response from the reasoning
          let actualResponse: string | null = null;
          let thinkingPart: string | null = null;

          const finalOutputMatch = reasoning.match(/\*\*Final (?:Output|Response|Decision):\*\*\s*\n?\s*"?([^"\n]+)"?/i);
          const outputMatch = reasoning.match(/\*\*Output:\*\*\s*\n?\s*"?([^"\n]+)"?/i);
          const decidedMatch = reasoning.match(/\(Decided\)\s*\n?\s*"?([^"\n]+)"?/i);

          if (finalOutputMatch) {
            thinkingPart = reasoning.substring(0, finalOutputMatch.index);
            actualResponse = finalOutputMatch[1].trim();
          } else if (outputMatch) {
            thinkingPart = reasoning.substring(0, outputMatch.index);
            actualResponse = outputMatch[1].trim();
          } else if (decidedMatch) {
            thinkingPart = reasoning.substring(0, decidedMatch.index);
            actualResponse = decidedMatch[1].trim();
          } else {
            // Check if the reasoning ends with a quoted response
            const quotedResponseMatch = reasoning.match(/"([^"]+)"\s*$/);
            if (quotedResponseMatch && reasoning.length - quotedResponseMatch.index! > 100) {
              actualResponse = quotedResponseMatch[1].trim();
              thinkingPart = reasoning.substring(0, quotedResponseMatch.index);
            } else {
              // Can't separate thinking from response — emit everything as text only.
              // Emitting as both thinking AND text would duplicate the same content.
              actualResponse = reasoning;
              thinkingPart = null;
            }
          }

          // Emit thinking (only when we found a clear separator)
          if (thinkingPart && thinkingPart.trim()) {
            output.content.push({ type: "thinking", thinking: thinkingPart.trim() } as ThinkingContent);
            const idx = output.content.length - 1;
            eventStream.push({ type: "thinking_start", contentIndex: idx, partial: output });
            eventStream.push({ type: "thinking_delta", contentIndex: idx, delta: thinkingPart.trim(), partial: output });
            eventStream.push({ type: "thinking_end", contentIndex: idx, content: thinkingPart.trim(), partial: output });
          }

          // Emit actual response as text
          if (actualResponse && actualResponse.trim()) {
            output.content.push({ type: "text", text: actualResponse.trim() } as TextContent);
            const idx = output.content.length - 1;
            eventStream.push({ type: "text_start", contentIndex: idx, partial: output });
            eventStream.push({ type: "text_delta", contentIndex: idx, delta: actualResponse.trim(), partial: output });
            eventStream.push({ type: "text_end", contentIndex: idx, content: actualResponse.trim(), partial: output });
          }
          
          output.stopReason = "stop";
          eventStream.push({ type: "done", reason: "stop", message: output });
        } else if (content) {
          // Regular content field response
          // Emit thinking content if present and non-empty
          if (reasoning && reasoning.trim()) {
            output.content.push({ type: "thinking", thinking: reasoning.trim() } as ThinkingContent);
            const idx = output.content.length - 1;
            eventStream.push({ type: "thinking_start", contentIndex: idx, partial: output });
            eventStream.push({ type: "thinking_delta", contentIndex: idx, delta: reasoning.trim(), partial: output });
            eventStream.push({ type: "thinking_end", contentIndex: idx, content: reasoning.trim(), partial: output });
          }

          // Parse <tool_call> blocks from text content
          const parsedToolCalls = parseQwenToolCalls(content);

          if (parsedToolCalls.length > 0) {
            for (const tc of parsedToolCalls) {
              const toolCall: ToolCall = {
                type: "toolCall",
                id: `toolcall-${crypto.randomUUID()}`,
                name: tc.name,
                arguments: tc.arguments,
              };
              output.content.push(toolCall);
              const idx = output.content.length - 1;
              eventStream.push({ type: "toolcall_start", contentIndex: idx, partial: output });
              eventStream.push({ type: "toolcall_delta", contentIndex: idx, delta: JSON.stringify(tc.arguments), partial: output });
              eventStream.push({ type: "toolcall_end", contentIndex: idx, toolCall, partial: output });
            }
            output.stopReason = "toolUse";
            eventStream.push({ type: "done", reason: "toolUse", message: output });
          } else {
            // Regular text response - strip leading whitespace artifacts
            const text = content.replace(/^\s+/, "");
            if (text) {
              output.content.push({ type: "text", text } as TextContent);
              const idx = output.content.length - 1;
              eventStream.push({ type: "text_start", contentIndex: idx, partial: output });
              eventStream.push({ type: "text_delta", contentIndex: idx, delta: text, partial: output });
              eventStream.push({ type: "text_end", contentIndex: idx, content: text, partial: output });
            }
            output.stopReason = "stop";
            eventStream.push({ type: "done", reason: "stop", message: output });
          }
        } else {
          output.stopReason = "stop";
          eventStream.push({ type: "done", reason: "stop", message: output });
        }
      }

      eventStream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      eventStream.push({
        type: "error",
        reason: output.stopReason,
        error: output,
      });
      eventStream.end();
    }
  })();

  return eventStream;
}

// =============================================================================
// Extension Entry Point
// =============================================================================

export default function (pi: ExtensionAPI) {
  const vllmCompat = {
    supportsDeveloperRole: false,
    supportsStore: false,
    supportsReasoningEffort: false,
    maxTokensField: "max_tokens" as const,
    supportsStrictMode: false,
  };

  const qwenCompat = {
    supportsDeveloperRole: false,
    supportsStore: false,
    supportsReasoningEffort: false,
    maxTokensField: "max_tokens" as const,
    supportsStrictMode: true,
    thinkingFormat: "qwen" as const,
  };

  // Register provider with models from Chat AI Academic Cloud
  pi.registerProvider("academiccloud", {
    baseUrl: "https://chat-ai.academiccloud.de/v1",
    apiKey: "$ACADEMICCLOUD_API_KEY",
    api: "openai-completions",
    models: [
      // Text models
      {
        id: "apertus-70b-instruct-2509",
        name: "Apertus 70B Instruct 2509",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 65536,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "meta-llama-3.1-8b-instruct",
        name: "Llama 3.1 8B Instruct",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      // Not in HTML documentation
      // {
      //   id: "llama-3.1-sauerkrautlm-70b-instruct",
      //   name: "Llama 3.1 SauerkrautLM 70B (German)",
      //   reasoning: false,
      //   input: ["text"],
      //   cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      //   contextWindow: 128000,
      //   maxTokens: 8192,
      //   compat: vllmCompat,
      // },
      {
        id: "qwen3-30b-a3b-instruct-2507",
        name: "Qwen 3 30B A3B Instruct 2507",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },

      {
        id: "glm-4.7",
        name: "GLM-4.7",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "teuken-7b-instruct-research",
        name: "Teuken 7B Instruct Research (European Languages)",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      // Reasoning models
      {
        id: "deepseek-r1-distill-llama-70b",
        name: "DeepSeek R1 Distill Llama 70B",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 8192,
        compat: vllmCompat,
      },

      // Coding models
      {
        id: "devstral-2-123b-instruct-2512",
        name: "Devstral 2 123B Instruct 2512 (Coding)",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "qwen3-coder-30b-a3b-instruct",
        name: "Qwen 3 Coder 30B A3B Instruct",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
      {
        id: "openai-gpt-oss-120b",
        name: "OpenAI GPT OSS 120B",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      // Vision models (text + image)
      {
        id: "gemma-3-27b-it",
        name: "Gemma 3 27B Instruct (Vision)",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "gemma-4-31b-it",
        name: "Gemma 4 31B Instruct (Vision)",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "internvl3.5-30b-a3b",
        name: "InternVL 3.5 30B A3B (Vision)",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 40960,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "medgemma-27b-it",
        name: "MedGemma 27B Instruct (Medical, Vision)",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 8192,
        compat: vllmCompat,
      },
      {
        id: "mistral-large-3-675b-instruct-2512",
        name: "Mistral Large 3 675B Instruct 2512 (Vision)",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 294912,
        maxTokens: 8192,
        compat: vllmCompat,
      },

      {
        id: "qwen3-omni-30b-a3b-instruct",
        name: "Qwen 3 Omni 30B A3B Instruct (Multimodal)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 65536,
        maxTokens: 8192,
        compat: qwenCompat,
      },
      {
        id: "qwen3.5-27b",
        name: "Qwen 3.5 27B (Vision)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
      {
        id: "qwen3.5-35b-a3b",
        name: "Qwen 3.5 35B A3B (Vision)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
      {
        id: "qwen3.6-35b-a3b",
        name: "Qwen 3.6 35B A3B (Vision)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
    ]
  });

  // Separate provider for Qwen 3.5 models with broken server-side tool call
  // parsing. The vLLM backend emits tool calls as <tool_call> text in the
  // content field instead of proper OpenAI tool_calls, and strips them entirely
  // in streaming mode. The custom streamSimple handler works around this by
  // using non-streaming requests and parsing tool calls from the text content.
  pi.registerProvider("academiccloud-qwen35", {
    baseUrl: "https://chat-ai.academiccloud.de/v1",
    apiKey: "$ACADEMICCLOUD_API_KEY",
    api: "academiccloud-qwen35-tool-fix",
    streamSimple: streamQwen35ToolFix,
    models: [
      {
        id: "qwen3.5-122b-a10b",
        name: "Qwen 3.5 122B A10B (Vision)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
      {
        id: "qwen3.5-397b-a17b",
        name: "Qwen 3.5 397B A17B (Vision)",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 8192,
        compat: qwenCompat,
      },
    ]
  });
}
