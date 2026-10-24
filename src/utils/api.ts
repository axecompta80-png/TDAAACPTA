import type { ClientDossier, JournalEntry, AppNotification, PlatformSettings, SYSCOHADAAccount, Invoice, InvoiceInput } from '../types';

export interface BootstrapData {
  dossiers: ClientDossier[];
  entries: JournalEntry[];
  notifications: AppNotification[];
  settings: PlatformSettings;
  accounts: SYSCOHADAAccount[];
  invoices: Invoice[];
}

export interface BatchValidateResult {
  validated: JournalEntry[];
  refused: { id: string; reason: string }[];
}
export interface InvoiceWithEntries { invoice: Invoice; entries: JournalEntry[] }
const post = (body?: unknown): RequestInit => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

/**
 * Client API AxeCompta.
 *
 * Politique de sécurité : toutes les mutations sont émises en POST avec un suffixe
 * descriptif (/update, /delete, /read, /clear). Aucune méthode PUT, PATCH ou DELETE
 * n'est jamais utilisée (alignement sur la politique CORS stricte du serveur).
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
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

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COMPTABLE';
  createdById: string | null;
  createdAt: string;
}

export const api = {
  getBootstrap: () => request<BootstrapData>('/bootstrap'),

  // Dossiers comptables
  createDossier: (data: Omit<ClientDossier, 'id' | 'ownerId' | 'ownerName'>) =>
    request<ClientDossier>('/dossiers', { method: 'POST', body: JSON.stringify(data) }),
  updateDossier: (dossier: ClientDossier) =>
    request<ClientDossier>(`/dossiers/${dossier.id}/update`, { method: 'POST', body: JSON.stringify(dossier) }),
  deleteDossier: (id: string) => request<void>(`/dossiers/${id}/delete`, { method: 'POST' }),

  // Écritures comptables
  createEntry: (entry: JournalEntry) =>
    request<JournalEntry>('/entries', { method: 'POST', body: JSON.stringify(entry) }),
  importEntries: (entries: JournalEntry[]) =>
    request<JournalEntry[]>('/entries/import', { method: 'POST', body: JSON.stringify({ entries }) }),
  updateEntry: (entry: JournalEntry) =>
    request<JournalEntry>(`/entries/${entry.id}/update`, { method: 'POST', body: JSON.stringify(entry) }),
  batchValidateEntries: (ids: string[]) => request<BatchValidateResult>('/entries/batch-validate', post({ ids })),
  submitEntry: (id: string) => request<JournalEntry>(`/entries/${id}/submit`, post({})),
  unvalidateEntry: (id: string, reason?: string) => request<JournalEntry>(`/entries/${id}/unvalidate`, post({ reason })),
  cancelEntry: (id: string, reason?: string) => request<JournalEntry>(`/entries/${id}/cancel`, post({ reason })),

  // Plan comptable (sous-comptes propres à un dossier)
  createAccount: (a: { dossierId: string; parentCode: string; code: string; label: string }) =>
    request<SYSCOHADAAccount>('/accounts', post(a)),
  updateAccount: (code: string, data: { label?: string; active?: boolean }) =>
    request<SYSCOHADAAccount>(`/accounts/${code}/update`, post(data)),

  // Factures & lettrage
  createInvoice: (dossierId: string, input: InvoiceInput, submit: boolean) =>
    request<Invoice>('/invoices', post({ ...input, clientDossierId: dossierId, submit })),
  updateInvoice: (id: string, input: InvoiceInput, submit: boolean) =>
    request<Invoice>(`/invoices/${id}/update`, post({ ...input, submit })),
  submitInvoice: (id: string) => request<Invoice>(`/invoices/${id}/submit`, post({})),
  validateInvoice: (id: string) => request<InvoiceWithEntries>(`/invoices/${id}/validate`, post({})),
  cancelInvoice: (id: string, reason?: string) => request<InvoiceWithEntries>(`/invoices/${id}/cancel`, post({ reason })),
  letterPayment: (invoiceId: string, body: { entryId: string; amount?: number } | { newPayment: { date: string; amount: number; paymentMethod: string } }) =>
    request<{ invoice: Invoice; entry: JournalEntry }>(`/invoices/${invoiceId}/payments`, post(body)),
  unletterPayment: (paymentId: string) => request<Invoice>(`/invoice-payments/${paymentId}/delete`, post({})),

  // Notifications
  createNotification: (notification: AppNotification) =>
    request<AppNotification>('/notifications', { method: 'POST', body: JSON.stringify(notification) }),
  markNotificationRead: (id: string) => request<AppNotification>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<void>('/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => request<void>(`/notifications/${id}/delete`, { method: 'POST' }),
  clearAllNotifications: () => request<void>('/notifications/clear', { method: 'POST' }),

  // Réglages de la plateforme
  updateSettings: (settings: PlatformSettings) =>
    request<PlatformSettings>('/settings/update', { method: 'POST', body: JSON.stringify(settings) }),

  // Équipe de l'entreprise et attribution des dossiers
  getTeam: () => request<{ organizationName: string; members: TeamMember[] }>('/team'),
  createTeamMember: (data: { name: string; email: string; password: string }) => request<TeamMember>('/team', post(data)),
  deleteTeamMember: (id: string) => request<void>(`/team/${id}/delete`, post()),
  assignDossier: (dossierId: string, userId: string) => request<ClientDossier>(`/dossiers/${dossierId}/assignments`, post({ userId })),
  unassignDossier: (dossierId: string, userId: string) => request<ClientDossier>(`/dossiers/${dossierId}/assignments/${userId}/delete`, post()),

  // Sauvegarde / restauration (périmètre de l'utilisateur connecté)
  importBackup: (backup: { settings?: PlatformSettings; dossiers?: ClientDossier[]; entries?: JournalEntry[] }) =>
    request<BootstrapData>('/import-backup', { method: 'POST', body: JSON.stringify(backup) }),
};
