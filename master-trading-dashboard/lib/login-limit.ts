// One bounded bucket for this single-user, single-web-container deployment.
// Use a shared store before horizontally scaling the web service.
export function createLoginLimiter(limit = 10, windowMs = 15 * 60 * 1000) {
  let started = 0;
  let attempts = 0;
  return {
    consume(now = Date.now()): boolean {
      if (now >= started + windowMs) { started = now; attempts = 0; }
      if (attempts >= limit) return false;
      attempts++;
      return true;
    },
  };
}

const globalLimiter = globalThis as unknown as { __gimmLoginLimiter?: ReturnType<typeof createLoginLimiter> };
export const loginLimiter = globalLimiter.__gimmLoginLimiter ??= createLoginLimiter();
