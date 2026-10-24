export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COMPTABLE';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

export const authApi = {
  me: () => request<CurrentUser>('/me'),
  login: (email: string, password: string) =>
    request<CurrentUser>('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (email: string, name: string, password: string) =>
    request<CurrentUser>('/signup', { method: 'POST', body: JSON.stringify({ email, name, password }) }),
  logout: () => request<void>('/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};
