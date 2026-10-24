import React, { useState } from 'react';
import { ClientDossier, JournalEntry } from '../../types';
import { SYSCOHADA_ACCOUNTS, registerCustomAccounts } from '../../data/syscohadaPlan';
import { api } from '../../utils/api';
import { ListTree, Plus, Search, Power } from 'lucide-react';

interface ChartOfAccountsProps {
  activeDossier: ClientDossier;
  entries: JournalEntry[];
  canEdit: boolean;
  onChanged: () => void;
  notify: (message: string) => void;
}

const CLASS_LABEL: Record<number, string> = {
  1: 'Ressources durables', 2: 'Actif immobilisé', 3: 'Stocks', 4: 'Tiers',
  5: 'Trésorerie', 6: 'Charges', 7: 'Produits', 8: 'Autres charges et produits (HAO)',
};
const inputCls = 'p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30';

/**
 * Plan comptable du dossier : plan SYSCOHADA standard + sous-comptes propres au dossier
 * (ex. 5211 Banques → 5212 Ecobank, 5213 UBA ; 4111 Clients → 41111 Client X).
 */
export const ChartOfAccounts: React.FC<ChartOfAccountsProps> = ({ activeDossier, entries, canEdit, onChanged, notify }) => {
  const [parentCode, setParentCode] = useState('5211');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const accounts = SYSCOHADA_ACCOUNTS.filter(a => !a.dossierId || a.dossierId === activeDossier.id);
  const usage = new Map<string, number>();
  for (const e of entries) for (const c of [e.debitAccountCode, e.creditAccountCode]) usage.set(c, (usage.get(c) ?? 0) + 1);
  const shown = accounts.filter(a => !search || a.code.startsWith(search) || a.label.toLowerCase().includes(search.toLowerCase()));
  const root = parentCode.slice(0, 3);

  const create = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    try {
      const acc = await api.createAccount({ dossierId: activeDossier.id, parentCode, code: code.trim(), label: label.trim() });
      registerCustomAccounts([acc]);
      onChanged();
      setCode('');
      setLabel('');
      notify(`Compte ${acc.code} - ${acc.label} créé.`);
    } catch (e: any) {
      notify(e?.message || 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (accCode: string, active: boolean) => {
    try {
      registerCustomAccounts([await api.updateAccount(accCode, { active })]);
      onChanged();
    } catch (e: any) {
      notify(e?.message || 'Mise à jour impossible.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs">
        <h3 className="font-heading text-xl font-bold text-[#1E084A] flex items-center gap-2">
          <ListTree className="w-5 h-5 text-[#7024E3]" /> Plan comptable — {activeDossier.name}
        </h3>
        <p className="text-xs text-[#7C709A]">
          Plan SYSCOHADA standard (non modifiable) + sous-comptes propres au dossier. Un sous-compte hérite de la nature de son compte parent.
        </p>

        {canEdit && (
          <form onSubmit={create} className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-end">
            <label className="sm:col-span-4"><span className="font-bold block mb-1">Compte parent</span>
              <select className={`${inputCls} w-full font-mono`} value={parentCode} onChange={e => setParentCode(e.target.value)}>
                {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.label}</option>)}
              </select></label>
            <label className="sm:col-span-2"><span className="font-bold block mb-1">Code</span>
              <input required pattern="[1-9][0-9]{2,11}" placeholder={`${root}…`} className={`${inputCls} w-full font-mono`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
            <label className="sm:col-span-4"><span className="font-bold block mb-1">Libellé</span>
              <input required placeholder="Ex. Ecobank" className={`${inputCls} w-full`} value={label} onChange={e => setLabel(e.target.value)} /></label>
            <button disabled={busy || !code.startsWith(root) || code === parentCode} className="sm:col-span-2 px-4 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-40">
              <Plus className="w-4 h-4" /> Créer
            </button>
            <p className="sm:col-span-12 text-[10.5px] text-[#7C709A]">Le code doit commencer par {root} (même compte principal que {parentCode}).</p>
          </form>
        )}
      </div>

      <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3 border-b border-[#EDE9FE] relative">
          <input placeholder="Rechercher un code ou un libellé…" className={`${inputCls} w-full pl-8 text-xs`} value={search} onChange={e => setSearch(e.target.value)} />
          <Search className="w-3.5 h-3.5 text-[#7C709A] absolute left-5 top-5" />
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#1E084A] text-white uppercase font-mono text-[11px]">
              <th className="p-3">Code</th><th className="p-3">Libellé</th><th className="p-3">Classe</th>
              <th className="p-3 text-center">Écritures</th><th className="p-3 text-center">Type</th><th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EDE9FE]">
            {shown.map(a => (
              <tr key={a.code} className={`hover:bg-[#F5F3FF] ${a.active === false ? 'opacity-50' : ''}`}>
                <td className="p-3 font-mono font-bold text-[#7024E3]" style={{ paddingLeft: a.parentCode ? 28 : 12 }}>{a.code}</td>
                <td className="p-3 text-[#1E084A]">{a.label}{a.parentCode && <span className="text-[#7C709A]"> ← {a.parentCode}</span>}</td>
                <td className="p-3 text-[#7C709A]">{a.classNumber} - {CLASS_LABEL[a.classNumber] ?? ''}</td>
                <td className="p-3 text-center font-mono">{usage.get(a.code) ?? 0}</td>
                <td className="p-3 text-center">
                  {a.dossierId
                    ? <span className="px-2 py-0.5 rounded-full bg-[#F5F3FF] text-[#7024E3] border border-[#DDD6FE] font-bold">Dossier</span>
                    : <span className="text-[#7C709A]">Standard</span>}
                </td>
                <td className="p-3 text-right">
                  {canEdit && a.dossierId && (
                    <button onClick={() => toggle(a.code, a.active === false)} className="inline-flex items-center gap-1 font-bold text-[#1E084A] hover:text-[#7024E3]"
                      title={a.active === false ? 'Réactiver' : 'Désactiver (le compte reste dans l\'historique)'}>
                      <Power className="w-3.5 h-3.5" /> {a.active === false ? 'Réactiver' : 'Désactiver'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
