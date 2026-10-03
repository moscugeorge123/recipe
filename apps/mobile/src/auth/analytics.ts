import type { AuthAnalyticsEvent } from '@recipe/contracts';

export type AuthTrackPayload = {
  provider?: string;
  reason?: string;
};

export type AuthTrackEntry = {
  event: AuthAnalyticsEvent;
  payload: AuthTrackPayload;
  at: number;
};

const MAX_EVENTS = 50;
const buffer: AuthTrackEntry[] = [];

function safeBit(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes('@') || value.length > 80) return undefined;
  if (/^\+?\d{7,}$/.test(value)) return undefined;
  return value;
}

/** In-memory funnel events. Never records email, phone, token, or password. */
export function trackAuth(
  event: AuthAnalyticsEvent,
  payload: AuthTrackPayload = {},
): void {
  const safe: AuthTrackPayload = {};
  const provider = safeBit(payload.provider);
  const reason = safeBit(payload.reason);
  if (provider) safe.provider = provider;
  if (reason) safe.reason = reason;
  buffer.push({ event, payload: safe, at: Date.now() });
  if (buffer.length > MAX_EVENTS) buffer.shift();
}

export function getAuthAnalyticsBuffer(): readonly AuthTrackEntry[] {
  return buffer.slice();
}

export function clearAuthAnalyticsBuffer(): void {
  buffer.length = 0;
}
