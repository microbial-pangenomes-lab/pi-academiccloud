/**
 * Academic Cloud Rate Limit Footer Extension
 * 
 * Shows current rate limit usage for Academic Cloud API in the footer.
 * Rate limits are extracted from API response headers and displayed
 * alongside token usage.
 * 
 * This extension is automatically loaded when the package is installed.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface RateLimitState {
  remainingMinute: number | null;
  remainingHour: number | null;
  remainingDay: number | null;
  remainingMonth: number | null;
  limitMinute: number;
  limitHour: number;
  limitDay: number;
  limitMonth: number;
  lastUpdate: number;
  inputTokens: number;
  outputTokens: number;
}

export default function (pi: ExtensionAPI) {
  const state: RateLimitState = {
    remainingMinute: null,
    remainingHour: null,
    remainingDay: null,
    remainingMonth: null,
    limitMinute: 30,
    limitHour: 200,
    limitDay: 1000,
    limitMonth: 3000,
    lastUpdate: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  let footerDispose: (() => void) | undefined;
  let isActive = false;
  let currentTui: any = null;

  function isAcademicCloudModel(model: any): boolean {
    return model?.provider === "academiccloud" || model?.provider === "academiccloud-qwen35" || (model?.baseUrl?.includes("chat-ai.academiccloud.de") ?? false);
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
          
          if (isActive && state.lastUpdate > 0 && state.remainingMinute !== null) {
            if (state.remainingMinute !== null && state.limitMinute) {
              const usedMinute = state.limitMinute - state.remainingMinute;
              const pctMinute = Math.round((usedMinute / state.limitMinute) * 100);
              const color = pctMinute > 80 ? "error" : pctMinute > 50 ? "warning" : "dim";
              rateLimitParts.push(theme.fg(color as any, `min:${usedMinute}/${state.limitMinute}`));
            }
            if (state.remainingHour !== null && state.limitHour) {
              const usedHour = state.limitHour - state.remainingHour;
              const pctHour = Math.round((usedHour / state.limitHour) * 100);
              const color = pctHour > 80 ? "error" : pctHour > 50 ? "warning" : "dim";
              rateLimitParts.push(theme.fg(color as any, `hr:${usedHour}/${state.limitHour}`));
            }
            if (state.remainingDay !== null && state.limitDay) {
              const usedDay = state.limitDay - state.remainingDay;
              const pctDay = Math.round((usedDay / state.limitDay) * 100);
              const color = pctDay > 80 ? "error" : pctDay > 50 ? "warning" : "dim";
              rateLimitParts.push(theme.fg(color as any, `day:${usedDay}/${state.limitDay}`));
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

    const remainingMinute = headers["x-ratelimit-remaining-minute"];
    const remainingHour = headers["x-ratelimit-remaining-hour"];
    const remainingDay = headers["x-ratelimit-remaining-day"];
    const remainingMonth = headers["x-ratelimit-remaining-month"];
    const limitMinute = headers["x-ratelimit-limit-minute"];
    const limitHour = headers["x-ratelimit-limit-hour"];
    const limitDay = headers["x-ratelimit-limit-day"];
    const limitMonth = headers["x-ratelimit-limit-month"];

    if (remainingMinute !== undefined) state.remainingMinute = parseInt(remainingMinute, 10);
    if (remainingHour !== undefined) state.remainingHour = parseInt(remainingHour, 10);
    if (remainingDay !== undefined) state.remainingDay = parseInt(remainingDay, 10);
    if (remainingMonth !== undefined) state.remainingMonth = parseInt(remainingMonth, 10);
    if (limitMinute !== undefined) state.limitMinute = parseInt(limitMinute, 10);
    if (limitHour !== undefined) state.limitHour = parseInt(limitHour, 10);
    if (limitDay !== undefined) state.limitDay = parseInt(limitDay, 10);
    if (limitMonth !== undefined) state.limitMonth = parseInt(limitMonth, 10);

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
  pi.on("session_start", async (_event: any, ctx) => {
    state.remainingMinute = null;
    state.remainingHour = null;
    state.remainingDay = null;
    state.remainingMonth = null;
    state.lastUpdate = 0;
    state.inputTokens = 0;
    state.outputTokens = 0;
  });

  // Reset rate limits on compaction (new session state)
  pi.on("session_compact", async (_event: any, _ctx) => {
    state.remainingMinute = null;
    state.remainingHour = null;
    state.remainingDay = null;
    state.remainingMonth = null;
    state.lastUpdate = 0;
    state.inputTokens = 0;
    state.outputTokens = 0;
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
