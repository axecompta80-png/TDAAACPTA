import React, { useMemo, useState } from 'react';
import { ClientDossier, JournalEntry, JournalLine } from '../../types';
import { formatSYSCOHADALabel } from '../../data/syscohadaPlan';
import { Landmark, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';

interface Props {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  onLinesReconciled: (lineIds: string[], reconciledOn: string | undefined) => void;
  onOpenEntry: (entry: JournalEntry) => void;
  onError: (message: string) => void;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');
const r2 = (n: number) => Math.round(n * 100) / 100;
const frDate = (d: string) => d.split('-').reverse().join('/');

/**
 * Rapprochement bancaire (banque, Mobile Money, caisse) : on pointe les mouvements du compte
 * qui figurent sur le relevé. Solde pointé = solde du relevé quand le rapprochement est juste ;
 * les mouvements non pointés sont les opérations en suspens.
 * ponytail: pointage manuel ; importer le relevé (CSV) pour un pointage automatique si le volume le demande.
 */
export const BankReconciliation: React.FC<Props> = ({ entries, activeDossier, onLinesReconciled, onOpenEntry, onError }) => {
  const validated = useMemo(
    () => entries.filter(e => e.clientDossierId === activeDossier.id && e.status === 'validated'),
    [entries, activeDossier.id],
  );
  const accounts = useMemo(
    () => [...new Set(validated.flatMap(e => e.lines.map(l => l.accountCode)).filter(c => c.startsWith('5')))].sort(),
    [validated],
  );
  const [account, setAccount] = useState('');
  const code = accounts.includes(account) ? account : accounts.find(c => c.startsWith('52')) ?? accounts[0] ?? '';
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const rows = validated
    .flatMap(e => e.lines.filter(l => l.accountCode === code && l.id).map(l => ({ e, l: l as JournalLine & { id: string } })))
    .filter(({ e }) => e.date <= statementDate)
    .sort((a, b) => a.e.date.localeCompare(b.e.date));
  // Pointé sur ce relevé ou un précédent ; pointé sur un relevé ultérieur = encore en suspens à cette date.
  const isDone = (l: JournalLine) => !!l.reconciledOn && l.reconciledOn <= statementDate;
  const done = rows.filter(r => isDone(r.l));
  const pending = rows.filter(r => !isDone(r.l));
  const sum = (list: typeof rows) => r2(list.reduce((s, { l }) => s + l.debit - l.credit, 0));
  const book = sum(rows), pointed = sum(done);
  const target = statementBalance.trim() === '' ? null : Number(statementBalance.replace(/\s/g, '').replace(',', '.'));
  const gap = target === null || Number.isNaN(target) ? null : r2(target - pointed);

  const mark = async (ids: string[], date: string | null) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await api.reconcileLines(activeDossier.id, ids, date);
      onLinesReconciled(res.lineIds, res.reconciledOn);
      setSelected(new Set());
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Pointage impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const table = (list: typeof rows, pointedList: boolean) => (
    <table className="w-full text-xs">
      <thead className="bg-[#1E084A] text-white font-mono text-[11px] uppercase">
        <tr>
          <th className="p-2 w-8"></th>
          <th className="p-2 text-left">Date & pièce</th>
          <th className="p-2 text-left">Libellé</th>
          <th className="p-2 text-right">Entrée (débit)</th>
          <th className="p-2 text-right">Sortie (crédit)</th>
          {pointedList && <th className="p-2 text-right">Relevé du</th>}
        </tr>
      </thead>
      <tbody>
        {list.length === 0 && (
          <tr><td colSpan={6} className="p-4 text-center text-[#7C709A]">{pointedList ? 'Aucun mouvement pointé.' : 'Tous les mouvements sont pointés.'}</td></tr>
        )}
        {list.map(({ e, l }) => (
          <tr key={l.id} className="border-t border-[#EDE9FE] hover:bg-[#FAF8FF]">
            <td className="p-2 text-center">
              {pointedList
                ? <button disabled={busy} onClick={() => mark([l.id], null)} className="text-[11px] font-bold text-[#B91C1C] hover:underline">Dépointer</button>
                : <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />}
            </td>
            <td className="p-2 font-mono">
              <button onClick={() => onOpenEntry(e)} className="text-left hover:underline">{frDate(e.date)}<div className="text-[10.5px] text-[#7C709A]">{e.pieceRef}</div></button>
            </td>
            <td className="p-2">{l.label ?? e.label}</td>
            <td className="p-2 text-right font-mono">{l.debit ? fmt(l.debit) : ''}</td>
            <td className="p-2 text-right font-mono">{l.credit ? fmt(l.credit) : ''}</td>
            {pointedList && <td className="p-2 text-right font-mono">{frDate(l.reconciledOn!)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#DDD6FE] rounded-2xl p-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-black text-[#1E084A] flex items-center gap-2"><Landmark className="w-5 h-5 text-[#7024E3]" /> Rapprochement bancaire</h2>
          <p className="text-xs text-[#7C709A] mt-1">Cochez les mouvements qui figurent sur le relevé de la banque ou de l'opérateur Mobile Money, puis « Pointer ».</p>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="space-y-1">
            <span className="block font-bold text-[#534674]">Compte</span>
            <select value={code} onChange={e => { setAccount(e.target.value); setSelected(new Set()); }} className="px-3 py-2 border border-[#DDD6FE] rounded-lg bg-white">
              {accounts.length === 0 && <option value="">Aucun compte de trésorerie</option>}
              {accounts.map(c => <option key={c} value={c}>{formatSYSCOHADALabel(c)}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block font-bold text-[#534674]">Date du relevé</span>
            <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} className="px-3 py-2 border border-[#DDD6FE] rounded-lg" />
          </label>
          <label className="space-y-1">
            <span className="block font-bold text-[#534674]">Solde du relevé</span>
            <input inputMode="decimal" value={statementBalance} onChange={e => setStatementBalance(e.target.value)} placeholder="ex : 1 250 000" className="w-36 px-3 py-2 border border-[#DDD6FE] rounded-lg text-right font-mono" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ['Solde comptable', book],
          ['Solde pointé', pointed],
          ['En suspens', r2(book - pointed)],
        ].map(([label, v]) => (
          <div key={label as string} className="bg-white border border-[#DDD6FE] rounded-xl p-3">
            <div className="text-[#7C709A] font-bold">{label}</div>
            <div className="font-mono font-black text-base text-[#1E084A]">{fmt(v as number)}</div>
          </div>
        ))}
        <div className={`rounded-xl p-3 border ${gap === null ? 'bg-white border-[#DDD6FE]' : gap === 0 ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'}`}>
          <div className="text-[#7C709A] font-bold">Écart relevé − pointé</div>
          {gap === null
            ? <div className="text-[#7C709A]">Saisissez le solde du relevé</div>
            : gap === 0
              ? <div className="font-black text-[#166534] flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Rapproché</div>
              : <div className="font-mono font-black text-base text-[#B91C1C] flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {fmt(gap)}</div>}
        </div>
      </div>

      <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-[#EDE9FE]">
          <span className="text-xs font-bold text-[#1E084A]">Mouvements non pointés ({pending.length})</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set(pending.map(r => r.l.id)))} className="px-3 py-1.5 text-xs font-bold border border-[#DDD6FE] rounded-lg">Tout cocher</button>
            <button disabled={busy || selected.size === 0} onClick={() => mark([...selected], statementDate)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-[#7024E3] rounded-lg disabled:opacity-40">
              Pointer ({selected.size}) au relevé du {frDate(statementDate)}
            </button>
          </div>
        </div>
        {table(pending, false)}
      </div>

      <details className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden">
        <summary className="p-3 text-xs font-bold text-[#1E084A] cursor-pointer">Mouvements pointés ({done.length})</summary>
        {table(done, true)}
      </details>
    </div>
  );
};
