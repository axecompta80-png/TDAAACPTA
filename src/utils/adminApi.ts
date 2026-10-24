export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COMPTABLE';
  createdAt: string;
  organizationName?: string;
}

/**
 * Client d'administration. Mutations émises en POST avec suffixe descriptif
 * (/role, /delete) : aucune méthode PATCH ou DELETE n'est utilisée.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur API (${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export interface NewUserInput {
  email: string;
  name: string;
  password: string;
  role: ManagedUser['role'];
}

export const adminApi = {
  listUsers: () => request<ManagedUser[]>('/users'),
  createUser: (data: NewUserInput) =>
    request<ManagedUser>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, role: ManagedUser['role']) =>
    request<ManagedUser>(`/users/${id}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  resetPassword: (id: string, password: string) =>
    request<ManagedUser>(`/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  deleteUser: (id: string) => request<void>(`/users/${id}/delete`, { method: 'POST' }),
};
