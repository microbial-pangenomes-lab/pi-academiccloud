/**
 * Academic Cloud Rate Limit Footer Extension
 * 
 * Shows current rate limit usage for Academic Cloud API in the footer.
 * Rate limits are extracted from API response headers and displayed
 * alongside token usage.
 * 
 * This extension is automatically loaded when placed in .pi/extensions/
 * or ~/.pi/agent/extensions/
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
  };

  let footerDispose: (() => void) | undefined;
  let isActive = false;

  function isAcademicCloudModel(ctx: ExtensionContext): boolean {
    return ctx.model?.baseUrl?.includes("chat-ai.academiccloud.de") ?? false;
  }

  function setupRateLimitFooter(ctx: ExtensionContext) {
    footerDispose = ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // Compute tokens from ctx
          let input = 0,
            output = 0,
            cost = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              const m = e.message as AssistantMessage;
              input += m.usage.input;
              output += m.usage.output;
              cost += m.usage.cost.total;
            }
          }

          const branch = footerData.getGitBranch();
          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          // Build rate limit display (only show when Academic Cloud model is active)
          const rateLimitParts: string[] = [];
          
          if (isActive && state.lastUpdate > 0) {
            if (state.remainingMinute !== null && state.limitMinute) {
              const usedMinute = state.limitMinute - state.remainingMinute;
              const pctMinute = Math.round((usedMinute / state.limitMinute) * 100);
              const color = pctMinute > 80 ? "red" : pctMinute > 50 ? "yellow" : "dim";
              rateLimitParts.push(theme.fg(color, `min:${usedMinute}/${state.limitMinute}`));
            }
            if (state.remainingHour !== null && state.limitHour) {
              const usedHour = state.limitHour - state.remainingHour;
              const pctHour = Math.round((usedHour / state.limitHour) * 100);
              const color = pctHour > 80 ? "red" : pctHour > 50 ? "yellow" : "dim";
              rateLimitParts.push(theme.fg(color, `hr:${usedHour}/${state.limitHour}`));
            }
            if (state.remainingDay !== null && state.limitDay) {
              const usedDay = state.limitDay - state.remainingDay;
              const pctDay = Math.round((usedDay / state.limitDay) * 100);
              const color = pctDay > 80 ? "red" : pctDay > 50 ? "yellow" : "dim";
              rateLimitParts.push(theme.fg(color, `day:${usedDay}/${state.limitDay}`));
            }
          }

          const tokenStr = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);
          const rateLimitStr = rateLimitParts.length > 0 ? rateLimitParts.join(" ") : "";
          const branchStr = branch ? theme.fg("dim", `(${branch})`) : "";
          const modelStr = theme.fg("dim", ctx.model?.id || "no-model");

          const left = `${tokenStr}${rateLimitStr ? " | " + rateLimitStr : ""}`;
          const right = `${modelStr}${branchStr ? " " + branchStr : ""}`;

          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          return [truncateToWidth(left + pad + right, width)];
        },
      };
    });
  }

  // Track rate limits from Academic Cloud API responses
  pi.on("after_provider_response", async (event, ctx) => {
    if (!ctx.model?.baseUrl?.includes("chat-ai.academiccloud.de")) {
      return;
    }

    const headers = event.responseHeaders;
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

    // Update footer
    if (footerDispose) {
      footerDispose();
      setupRateLimitFooter(ctx);
    }
  });

  // Reset state on session start
  pi.on("session_start", async (_event, ctx) => {
    state.remainingMinute = null;
    state.remainingHour = null;
    state.remainingDay = null;
    state.remainingMonth = null;
    state.lastUpdate = 0;
  });

  // Auto-enable footer when using Academic Cloud models
  pi.on("model_change", async (_event, ctx) => {
    const wasActive = isActive;
    isActive = isAcademicCloudModel(ctx);
    
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
