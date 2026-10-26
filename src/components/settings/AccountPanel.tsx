import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { authApi } from '../../utils/authApi';

const field = 'w-full px-3 py-2 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs text-[#1E084A] dark:text-[#F3EFFF] focus:outline-hidden focus:border-[#7024E3]';
const card = 'p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-white dark:bg-[#160B2E] space-y-3';
const title = 'text-sm font-black font-heading text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-2';
const primary = 'px-4 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white rounded-xl text-xs font-bold disabled:opacity-50';

/** Paramètres du compte : changement de son propre mot de passe. */
export const AccountPanel: React.FC = () => {
  // --- Mot de passe ---
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.next.length < 8) return setPwdMsg({ ok: false, text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    if (pwd.next !== pwd.confirm) return setPwdMsg({ ok: false, text: 'La confirmation ne correspond pas au nouveau mot de passe.' });
    setPwdBusy(true);
    try {
      await authApi.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      setPwdMsg({ ok: true, text: 'Mot de passe modifié.' });
    } catch (err: any) {
      setPwdMsg({ ok: false, text: err?.message || 'Modification impossible.' });
    } finally {
      setPwdBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={changePassword} className={card}>
        <h3 className={title}><KeyRound className="w-4 h-4 text-[#7024E3]" /> Changer mon mot de passe</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="password" autoComplete="current-password" required placeholder="Mot de passe actuel" className={field}
            value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} />
          <input type="password" autoComplete="new-password" required minLength={8} placeholder="Nouveau (8 caractères min.)" className={field}
            value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} />
          <input type="password" autoComplete="new-password" required placeholder="Confirmation" className={field}
            value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} />
        </div>
        {pwdMsg && <p className={`text-xs font-bold ${pwdMsg.ok ? 'text-[#10B981]' : 'text-red-600'}`}>{pwdMsg.text}</p>}
        <button type="submit" disabled={pwdBusy} className={primary}>{pwdBusy ? 'Modification…' : 'Modifier le mot de passe'}</button>
      </form>
    </div>
  );
};
