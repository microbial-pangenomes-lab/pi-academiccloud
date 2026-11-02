/**
 * Academic Cloud Rate Limit Footer Extension
 *
 * Shows current rate limit usage for Academic Cloud API in the footer.
 * Rate limits are extracted from API response headers and displayed
 * alongside token usage.
 *
 * Since the migration to the Saia 2 platform (2026-11) the API reports four
 * request windows via headers of the form
 *   x-ratelimit-{limit,remaining,reset}-requests-{10s,hour,day,month}
 * where `reset` is the number of seconds until the window resets.
 *
 * This extension is automatically loaded when the package is installed.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

type WindowKey = "10s" | "hour" | "day" | "month";

interface RateLimitWindow {
  /** Short label shown in the footer */
  label: string;
  limit: number;
  remaining: number | null;
  /** Epoch ms at which the window resets (null if unknown) */
  resetAt: number | null;
}

interface RateLimitState {
  windows: Record<WindowKey, RateLimitWindow>;
  lastUpdate: number;
  inputTokens: number;
  outputTokens: number;
}

// Default limits (Saia 2, 2026-11): 2 req/10s, 200/hour, 400/day, 3000/month.
// The values from the response headers take precedence.
const WINDOW_DEFAULTS: Record<WindowKey, { label: string; limit: number }> = {
  "10s": { label: "10s", limit: 2 },
  hour: { label: "hr", limit: 200 },
  day: { label: "day", limit: 400 },
  month: { label: "mo", limit: 3000 },
};

const WINDOW_KEYS = Object.keys(WINDOW_DEFAULTS) as WindowKey[];

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.ceil(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.ceil(h / 24)}d`;
}

export default function (pi: ExtensionAPI) {
  const state: RateLimitState = {
    windows: Object.fromEntries(
      WINDOW_KEYS.map((k) => [
        k,
        { label: WINDOW_DEFAULTS[k].label, limit: WINDOW_DEFAULTS[k].limit, remaining: null, resetAt: null },
      ]),
    ) as Record<WindowKey, RateLimitWindow>,
    lastUpdate: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  function resetState() {
    for (const k of WINDOW_KEYS) {
      state.windows[k].remaining = null;
      state.windows[k].resetAt = null;
    }
    state.lastUpdate = 0;
    state.inputTokens = 0;
    state.outputTokens = 0;
  }

  let footerDispose: (() => void) | undefined;
  let isActive = false;
  let currentTui: any = null;

  function isAcademicCloudModel(model: any): boolean {
    return (
      (typeof model?.provider === "string" && model.provider.startsWith("academiccloud")) ||
      (model?.baseUrl?.includes("chat-ai.academiccloud.de") ?? false)
    );
  }

  function requestFooterRender() {
    if (currentTui) {
      currentTui.requestRender();
    }
  }

  function setupRateLimitFooter(ctx: ExtensionContext) {
    ctx.ui.setFooter((tui, theme, footerData) => {
      currentTui = tui;
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: () => {
          unsub();
          currentTui = undefined;
        },
        invalidate() {},
        render(width: number): string[] {
          // Compute tokens from state (tracked from API responses)
          const contextUsage = ctx.getContextUsage();
          const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextPercent = contextUsage?.percent;
          const inputTokens = state.inputTokens;
          const outputTokens = state.outputTokens;

          const branch = footerData.getGitBranch();
          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          // Compute context window usage percentage
          let contextPct: string | null = null;
          if (contextPercent !== null && contextPercent !== undefined) {
            const pct = Math.min(100, Math.round(contextPercent));
            contextPct = `${pct}%`;
          }

          // Build rate limit display (only show when Academic Cloud model is active)
          const rateLimitParts: string[] = [];
          
          if (isActive && state.lastUpdate > 0) {
            const now = Date.now();
            for (const k of WINDOW_KEYS) {
              const w = state.windows[k];
              if (w.remaining === null || !w.limit) continue;
              const used = Math.max(0, w.limit - w.remaining);
              const pct = Math.round((used / w.limit) * 100);
              const color = pct > 80 ? "error" : pct > 50 ? "warning" : "dim";
              let text = `${w.label}:${used}/${w.limit}`;
              // When a window is exhausted, show how long until it resets.
              // The 10s window resets too quickly for this to be useful.
              if (w.remaining <= 0 && k !== "10s" && w.resetAt !== null && w.resetAt > now) {
                text += `(${formatDuration(w.resetAt - now)})`;
              }
              rateLimitParts.push(theme.fg(color as any, text));
            }
          }

          // Don't show cost for Academic Cloud (it's free)
          const contextStr = contextPct ? theme.fg("dim", `[${contextPct}]`) : "";
          const tokenStr = theme.fg("dim", `↑${fmt(inputTokens)} ↓${fmt(outputTokens)}${contextStr ? " " + contextStr : ""}`);
          const rateLimitStr = rateLimitParts.length > 0 ? rateLimitParts.join(" ") : "";
          const branchStr = branch ? ` (${branch})` : "";
          const providerStr = isActive ? theme.fg("accent" as any, "(academiccloud)") : "";
          const modelStr = theme.fg("dim", ctx.model?.id || "no-model");

          const left = `${tokenStr}${rateLimitStr ? " | " + rateLimitStr : ""}`;
          const right = `${modelStr}${providerStr ? " " + providerStr : ""}${branchStr}`;

          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          return [truncateToWidth(left + pad + right, width)];
        },
      };
    });
  }

  // Track rate limits from Academic Cloud API responses (headers only)
  pi.on("after_provider_response", async (event: any, ctx) => {
    if (!isAcademicCloudModel(ctx.model)) {
      return;
    }

    const headers = event.headers;
    if (!headers) return;

    const now = Date.now();
    let found = false;
    for (const k of WINDOW_KEYS) {
      const w = state.windows[k];
      const limit = parseInt(headers[`x-ratelimit-limit-requests-${k}`], 10);
      const remaining = parseInt(headers[`x-ratelimit-remaining-requests-${k}`], 10);
      const reset = parseInt(headers[`x-ratelimit-reset-requests-${k}`], 10);
      if (!Number.isNaN(limit)) w.limit = limit;
      if (!Number.isNaN(remaining)) {
        w.remaining = remaining;
        found = true;
      }
      if (!Number.isNaN(reset)) w.resetAt = now + reset * 1000;
    }
    if (!found) return;

    state.lastUpdate = Date.now();

    // Request footer re-render
    requestFooterRender();
  });

  // Track token usage from message_end event
  pi.on("message_end", async (event: any, ctx) => {
    if (!isAcademicCloudModel(ctx.model)) {
      return;
    }

    if (event.message.role === "assistant" && event.message.usage) {
      state.inputTokens = event.message.usage.input || 0;
      state.outputTokens = event.message.usage.output || 0;
      requestFooterRender();
    }
  });

  // Reset state on session start
  pi.on("session_start", async (_event: any, _ctx) => {
    resetState();
  });

  // Reset rate limits on compaction (new session state)
  pi.on("session_compact", async (_event: any, _ctx) => {
    resetState();
    requestFooterRender();
  });

  // Auto-enable footer when using Academic Cloud models
  pi.on("input", async (event: any, ctx) => {
    const wasActive = isActive;
    isActive = isAcademicCloudModel(ctx.model);
    
    if (isActive) {
      if (footerDispose) {
        footerDispose();
      }
      setupRateLimitFooter(ctx);
    } else if (wasActive && footerDispose) {
      // Was active but now switched away - remove footer
      footerDispose();
      footerDispose = undefined;
      ctx.ui.setFooter(undefined);
    }
  });
}
