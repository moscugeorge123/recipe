export interface AbuseHit {
  key: string;
  limit: number;
  windowMs: number;
  /** When set, a second hit inside this gap is refused even if the window still has room. */
  cooldownMs?: number;
}

export interface AbuseDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * In-memory attempt counter. Stores timestamps only — never OTP codes, passwords, or tokens.
 * Counters are per process; pair with the HTTP rate limiter at the edge.
 */
export class AbuseGuard {
  private readonly events = new Map<string, number[]>();

  hit(input: AbuseHit, nowMs = Date.now()): AbuseDecision {
    const current = (this.events.get(input.key) ?? []).filter((ts) => nowMs - ts < input.windowMs);
    const last = current.length > 0 ? current[current.length - 1] : undefined;

    if (
      input.cooldownMs !== undefined &&
      last !== undefined &&
      nowMs - last < input.cooldownMs
    ) {
      this.events.set(input.key, current);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((last + input.cooldownMs - nowMs) / 1000)),
      };
    }

    if (current.length >= input.limit) {
      const oldest = current[0] ?? nowMs;
      this.events.set(input.key, current);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + input.windowMs - nowMs) / 1000)),
      };
    }

    current.push(nowMs);
    this.events.set(input.key, current);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
