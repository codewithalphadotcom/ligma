'use client';

import { getSession } from 'next-auth/react';
import { env } from './env';

/**
 * Returns the Express-issued JWT stored inside the NextAuth session, or
 * `null` if the user is not signed in. The session lookup is cached by
 * NextAuth so repeated calls are cheap.
 */
async function getApiToken(): Promise<string | null> {
  const session = await getSession();
  return session?.apiToken ?? null;
}

/**
 * Throwable error type for non-2xx API responses. Carries the HTTP status
 * and the parsed body so callers can branch on specific failure modes
 * (e.g. login → `email_not_verified` → bounce to /verify-email).
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)) {
      const e = (body as { error?: unknown }).error;
      if (typeof e === 'string') this.code = e;
    }
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getApiToken();
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      typeof (body as { error?: unknown }).error === 'string'
        ? ((body as { error: string }).error)
        : res.statusText;
    throw new ApiError(res.status, message, body);
  }
  return res.json() as Promise<T>;
}

interface AuthUser {
  id: string;
  name: string;
  color: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface SignupResponse {
  requiresVerification: true;
  email: string;
  expiresInMinutes: number;
}

export const api = {
  /**
   * Creates an unverified account and emails an OTP. The caller should
   * navigate to `/verify-email?email=...` and let the user enter the code.
   */
  signup: (data: { name: string; email: string; password: string }) =>
    request<SignupResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  /**
   * Completes the email-verification step. Returns a fresh Express JWT.
   */
  verifyEmail: (data: { email: string; code: string }) =>
    request<AuthResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Re-issues a verification OTP for an unverified account. */
  resendVerification: (data: { email: string }) =>
    request<{ ok: true; expiresInMinutes: number }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Sends a password-reset OTP. Always succeeds (no enumeration). */
  forgotPassword: (data: { email: string }) =>
    request<{ ok: true; expiresInMinutes: number }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Validates the reset OTP and rotates the password. */
  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    request<AuthResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Direct Express login. UI should prefer `signIn('credentials')` so the
   * NextAuth session cookie is set; this is exported for completeness.
   */
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  createRoom: (name: string) =>
    request<{ room: { id: string; name: string } }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getRoom: (id: string) =>
    request<{
      room: { id: string; name: string };
      members: { id: string; name: string; email: string; color: string; role: 'lead' | 'contributor' | 'viewer' }[];
    }>(`/rooms/${id}`),

  /**
   * Idempotently join the caller as a contributor. Safe to call on every
   * room visit — preserves the existing role for current members.
   */
  joinRoom: (id: string) =>
    request<{ room: { id: string; name: string }; role: 'lead' | 'contributor' | 'viewer' }>(
      `/rooms/${id}/join`,
      { method: 'POST' },
    ),

  listRooms: () =>
    request<{ rooms: { id: string; name: string; ownerId: string; createdAt: string; role: string }[] }>(
      '/rooms',
    ),

  setMemberRole: (roomId: string, userId: string, role: 'lead' | 'contributor' | 'viewer') =>
    request<{ ok: true }>(`/rooms/${roomId}/members`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, role }),
    }),

  classifyIntent: (text: string) =>
    request<{ label: string; confidence: number }>('/intent', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

/**
 * Public helper to look up the current API token (Express JWT) from the
 * NextAuth session. The WS provider needs this synchronously at connect
 * time, so callers resolve it once at mount and pass it down.
 */
export { getApiToken };
