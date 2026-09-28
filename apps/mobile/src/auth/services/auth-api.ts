import type {
  ApplicationUser,
  AuthAuditEvent,
  AuthBootstrapResponse,
} from '@recipe/contracts';

import { apiClient, unwrapData } from '@/services/api-client';

export type BootstrapBody = {
  username?: string;
  displayName?: string;
};

export type ProfileBody = {
  displayName?: string;
  photoURL?: string | null;
};

export type AuthEventBody = {
  event: AuthAuditEvent;
  provider?: string;
  reason?: string;
};

export interface AuthApi {
  bootstrap(body?: BootstrapBody): Promise<AuthBootstrapResponse>;
  me(): Promise<ApplicationUser>;
  updateProfile(body: ProfileBody): Promise<ApplicationUser>;
  checkUsername(username: string): Promise<{ available: boolean }>;
  claimUsername(username: string): Promise<ApplicationUser>;
  deleteAccount(): Promise<void>;
  recordEvent(body: AuthEventBody): Promise<void>;
  phoneChallenge(body: { phoneNumber: string }): Promise<void>;
  requestPasswordReset(body: { email: string }): Promise<void>;
}

type HttpClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
};

function withoutUid<T>(body: T): T {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!('uid' in body)) return body;
  const clone = { ...(body as Record<string, unknown>) };
  delete clone.uid;
  return clone as T;
}

export function createAuthApi(http: HttpClient): AuthApi {
  return {
    async bootstrap(body) {
      const parsed = await http.post<unknown>(
        '/auth/bootstrap',
        withoutUid(body ?? {}),
      );
      return unwrapData<AuthBootstrapResponse>(parsed);
    },
    async me() {
      const parsed = await http.get<unknown>('/auth/me');
      return unwrapData<ApplicationUser>(parsed);
    },
    async updateProfile(body) {
      const parsed = await http.patch<unknown>(
        '/auth/profile',
        withoutUid(body),
      );
      return unwrapData<ApplicationUser>(parsed);
    },
    async checkUsername(username) {
      const parsed = await http.get<unknown>(
        `/auth/username/check?username=${encodeURIComponent(username)}`,
      );
      return unwrapData<{ available: boolean }>(parsed);
    },
    async claimUsername(username) {
      const parsed = await http.post<unknown>(
        '/auth/username/claim',
        withoutUid({ username }),
      );
      return unwrapData<ApplicationUser>(parsed);
    },
    async deleteAccount() {
      await http.post<unknown>(
        '/auth/account/delete',
        withoutUid({ confirmation: 'DELETE' as const }),
      );
    },
    async recordEvent(body) {
      await http.post<unknown>('/auth/events', withoutUid(body));
    },
    async phoneChallenge(body) {
      await http.post<unknown>('/auth/phone/challenge', withoutUid(body));
    },
    async requestPasswordReset(body) {
      await http.post<unknown>('/auth/password-reset', withoutUid(body));
    },
  };
}

export const authApi = createAuthApi(apiClient);
