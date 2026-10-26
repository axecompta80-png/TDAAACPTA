import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import { ClientDossier } from '../types';
import { api } from '../utils/api';

interface AddDossierModalProps {
  onClose: () => void;
  onCreated: (dossier: ClientDossier) => void;
}

const field = 'w-full px-3 py-2.5 rounded-lg border border-[#DDD6FE] dark:border-[#35225E] bg-white dark:bg-[#150A2A] text-sm text-[#1E084A] dark:text-[#F3EFFF] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30';
const label = 'text-xs font-bold text-[#534674] dark:text-[#C4B5FD] mb-1 block';

/**
 * « Ajouter un Dossier » (compte principal) : nom du dossier + compte de son propriétaire.
 * Le propriétaire se connecte avec cet email et ce mot de passe et n'accède qu'à ce dossier.
 */
export const AddDossierModal: React.FC<AddDossierModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ name: '', ownerName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    setBusy(true);
    try {
      onCreated(await api.createDossier(form));
    } catch (err: any) {
      setError(err?.message || 'Création impossible pour le moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#180C30] border border-[#DDD6FE] dark:border-[#3B2068] rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-black text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-[#7024E3]" /> Ajouter un Dossier
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1.5 rounded-lg text-[#7C709A] hover:bg-[#EDE9FE] dark:hover:bg-[#2D1A54]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#7C709A] dark:text-[#A594C9]">
          Ce dossier a sa propre comptabilité. Son propriétaire se connecte avec l'email et le mot de passe ci-dessous
          et n'a accès qu'à ce dossier. Les informations fiscales et les paramètres de l'entreprise y sont recopiés.
        </p>

        <div>
          <label className={label}>Nom du dossier *</label>
          <input required className={field} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="ex : Boutique Plateau" />
        </div>
        <div>
          <label className={label}>Nom du propriétaire *</label>
          <input required className={field} value={form.ownerName} onChange={e => set({ ownerName: e.target.value })} placeholder="ex : Awa Koné" />
        </div>
        <div>
          <label className={label}>Email du propriétaire *</label>
          <input required type="email" autoComplete="off" className={field} value={form.email} onChange={e => set({ email: e.target.value })} />
        </div>
        <div>
          <label className={label}>Mot de passe *</label>
          <input required type="password" minLength={8} autoComplete="new-password" className={field} value={form.password} onChange={e => set({ password: e.target.value })} placeholder="8 caractères minimum" />
        </div>

        {error && <div className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{error}</div>}

        <button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-60">
          {busy ? 'Création…' : 'Créer le dossier'}
        </button>
      </form>
    </div>
  );
};
