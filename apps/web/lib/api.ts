'use client';

import { env } from './env';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ligma:token');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
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

export const api = {
  signup: (data: { name: string; email: string; password: string }) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  createRoom: (name: string) =>
    request<{ room: { id: string; name: string } }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  getRoom: (id: string) =>
    request<{ room: { id: string; name: string }; members: { id: string; name: string; role: string }[] }>(
      `/rooms/${id}`,
    ),

  classifyIntent: (text: string) =>
    request<{ label: string; confidence: number }>('/intent', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};

export function saveAuth(token: string, user: AuthUser): void {
  localStorage.setItem('ligma:token', token);
  localStorage.setItem('ligma:authorId', user.id);
  localStorage.setItem('ligma:authorName', user.name);
  localStorage.setItem('ligma:color', user.color);
}

export function clearAuth(): void {
  localStorage.removeItem('ligma:token');
  localStorage.removeItem('ligma:authorId');
  localStorage.removeItem('ligma:authorName');
  localStorage.removeItem('ligma:color');
}

export function isLoggedIn(): boolean {
  return typeof window !== 'undefined' && !!localStorage.getItem('ligma:token');
}
