import React, { useEffect, useState } from 'react';
import { KeyRound, Users, UserPlus, Trash2, Link2, X } from 'lucide-react';
import { ClientDossier } from '../../types';
import { CurrentUser, authApi } from '../../utils/authApi';
import { api, TeamMember } from '../../utils/api';

interface AccountTeamPanelProps {
  currentUser: CurrentUser;
  dossiers: ClientDossier[];
  onDossierChanged: (dossier: ClientDossier) => void;
}

const field = 'w-full px-3 py-2 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs text-[#1E084A] dark:text-[#F3EFFF] focus:outline-hidden focus:border-[#7024E3]';
const card = 'p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-white dark:bg-[#160B2E] space-y-3';
const title = 'text-sm font-black font-heading text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-2';
const primary = 'px-4 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white rounded-xl text-xs font-bold disabled:opacity-50';

/** Paramètres du compte : mot de passe, comptables de l'entreprise, attribution des dossiers. */
export const AccountTeamPanel: React.FC<AccountTeamPanelProps> = ({ currentUser, dossiers, onDossierChanged }) => {
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

  // --- Équipe ---
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.getTeam()
      .then(t => { setOrgName(t.organizationName); setMembers(t.members); })
      .catch(e => setTeamError(e?.message || 'Équipe indisponible.'));
  }, []);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError(null);
    setAdding(true);
    try {
      const m = await api.createTeamMember(newMember);
      setMembers(prev => [...prev, m]);
      setNewMember({ name: '', email: '', password: '' });
    } catch (err: any) {
      setTeamError(err?.message || 'Ajout impossible.');
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (m: TeamMember) => {
    if (!window.confirm(`Retirer ${m.name} ? Les dossiers qu'il a créés vous seront transférés.`)) return;
    try {
      await api.deleteTeamMember(m.id);
      setMembers(prev => prev.filter(x => x.id !== m.id));
      // Les dossiers transférés et les attributions changent : on recharge pour repartir d'un état exact.
      window.location.reload();
    } catch (err: any) {
      setTeamError(err?.message || 'Retrait impossible.');
    }
  };

  // --- Attributions (dossiers créés par l'utilisateur) ---
  const myDossiers = dossiers.filter(d => d.ownerId === currentUser.id);
  const colleagues = members.filter(m => m.id !== currentUser.id);
  const [assignError, setAssignError] = useState<string | null>(null);

  const toggleAssignment = async (dossier: ClientDossier, userId: string, assigned: boolean) => {
    setAssignError(null);
    try {
      onDossierChanged(assigned ? await api.unassignDossier(dossier.id, userId) : await api.assignDossier(dossier.id, userId));
    } catch (err: any) {
      setAssignError(err?.message || 'Attribution impossible.');
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

      <div className={card}>
        <h3 className={title}><Users className="w-4 h-4 text-[#7024E3]" /> Comptables de l'entreprise {orgName && `« ${orgName} »`}</h3>
        <p className="text-xs text-[#7C709A] dark:text-[#A594C9]">
          Chaque comptable a accès à toutes les fonctionnalités, mais ne voit que les dossiers qu'il a créés ou qui lui ont été attribués.
        </p>
        <ul className="divide-y divide-[#EDE9FE] dark:divide-[#2D1A54]">
          {members.map(m => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <div className="font-bold text-[#1E084A] dark:text-[#F3EFFF] truncate">
                  {m.name} {m.id === currentUser.id && <span className="ml-1 px-1.5 py-0.5 text-[10px] uppercase bg-[#EDE9FE] dark:bg-[#2A164F] text-[#7024E3] dark:text-[#C4B5FD] rounded">Vous</span>}
                </div>
                <div className="text-[#7C709A] dark:text-[#A594C9] font-mono truncate">{m.email}</div>
              </div>
              {m.createdById === currentUser.id && (
                <button onClick={() => removeMember(m)} title="Retirer ce comptable"
                  className="p-2 rounded-xl border border-[#FEE2E2] dark:border-[#4B1924] text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-[#4B1924]">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={addMember} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-[#EDE9FE] dark:border-[#2D1A54]">
          <input required placeholder="Nom" className={field} value={newMember.name} onChange={e => setNewMember({ ...newMember, name: e.target.value })} />
          <input required type="email" placeholder="Email" className={field} value={newMember.email} onChange={e => setNewMember({ ...newMember, email: e.target.value })} />
          <input required minLength={8} type="password" autoComplete="new-password" placeholder="Mot de passe initial" className={field}
            value={newMember.password} onChange={e => setNewMember({ ...newMember, password: e.target.value })} />
          <button type="submit" disabled={adding} className={`${primary} flex items-center justify-center gap-1.5`}>
            <UserPlus className="w-4 h-4" /> {adding ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
        {teamError && <p className="text-xs font-bold text-red-600">{teamError}</p>}
      </div>

      <div className={card}>
        <h3 className={title}><Link2 className="w-4 h-4 text-[#7024E3]" /> Attribution de mes dossiers</h3>
        {myDossiers.length === 0 || colleagues.length === 0 ? (
          <p className="text-xs text-[#7C709A] dark:text-[#A594C9]">
            {myDossiers.length === 0 ? "Vous n'avez créé aucun dossier." : 'Ajoutez un comptable pour pouvoir lui attribuer vos dossiers.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {myDossiers.map(d => (
              <li key={d.id} className="text-xs">
                <div className="font-bold text-[#1E084A] dark:text-[#F3EFFF] mb-1.5">{d.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {colleagues.map(m => {
                    const assigned = (d.assignees ?? []).some(a => a.id === m.id);
                    return (
                      <button key={m.id} onClick={() => toggleAssignment(d, m.id, assigned)}
                        title={assigned ? "Retirer l'attribution" : 'Attribuer ce dossier'}
                        className={`px-2.5 py-1 rounded-full border font-bold flex items-center gap-1 transition-colors ${assigned
                          ? 'bg-[#7024E3] border-[#7024E3] text-white'
                          : 'border-[#DDD6FE] dark:border-[#35225E] text-[#534674] dark:text-[#C4B5FD] hover:bg-[#F5F3FF] dark:hover:bg-[#231444]'}`}>
                        {m.name} {assigned && <X className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        {assignError && <p className="text-xs font-bold text-red-600">{assignError}</p>}
      </div>
    </div>
  );
};
