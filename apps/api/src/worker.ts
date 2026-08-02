import { app } from "./app";
import { cleanupExpired } from "./services/scan-store";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, executionContext);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupExpired(env));
  },
} satisfies ExportedHandler<Env>;
