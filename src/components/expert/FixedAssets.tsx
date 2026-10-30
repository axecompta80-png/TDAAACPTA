import React, { useState } from 'react';
import { ClientDossier, FixedAsset, JournalEntry } from '../../types';
import { accountsForDossier, formatSYSCOHADALabel } from '../../data/syscohadaPlan';
import { depreciationSchedule } from '../../utils/assets';
import { isLocked } from '../../utils/entryLines';
import { api } from '../../utils/api';
import { Factory, Plus, Trash2, Calculator, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  assets: FixedAsset[];
  activeDossier: ClientDossier;
  onAssetsChange: (assets: FixedAsset[]) => void;
  onEntriesAdded: (entries: JournalEntry[]) => void;
  /** Ouvre le formulaire d'écriture pré-rempli (achat de l'immobilisation). */
  onRecordPurchase: (prefill: Partial<JournalEntry>) => void;
  onToast: (message: string) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
const frDate = (d: string) => d.split('-').reverse().join('/');
const input = 'w-full px-3 py-2 border border-[#DDD6FE] rounded-lg text-xs';

export const FixedAssets: React.FC<Props> = ({ assets, activeDossier, onAssetsChange, onEntriesAdded, onRecordPurchase, onToast }) => {
  const mine = assets.filter(a => a.clientDossierId === activeDossier.id);
  const [year, setYear] = useState(new Date().getFullYear());
  const [open, setOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ label: '', accountCode: '244', acquisitionDate: today, cost: '', durationYears: '5', depreciatedThrough: '' });
  const assetAccounts = accountsForDossier(activeDossier.id).filter(a => /^2[1-7]/.test(a.code));

  const rows = mine.map(a => {
    const schedule = depreciationSchedule(a);
    const upTo = schedule.filter(r => r.year <= year);
    const cumulative = upTo.at(-1)?.cumulative ?? 0;
    return { a, schedule, dotation: schedule.find(r => r.year === year)?.amount ?? 0, cumulative, net: a.cost - cumulative };
  });
  const dueThisYear = rows.filter(r => r.schedule.some(s => s.year <= year && s.amount > 0 && s.year > (r.a.depreciatedThrough ?? 0)));
  const total = (k: 'dotation' | 'cumulative' | 'net') => rows.reduce((s, r) => s + r[k], 0);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Opération impossible.'); } finally { setBusy(false); }
  };

  const create = () => run(async () => {
    const created = await api.createAsset({
      clientDossierId: activeDossier.id, label: form.label, accountCode: form.accountCode, acquisitionDate: form.acquisitionDate,
      cost: Number(form.cost.replace(/\s/g, '').replace(',', '.')), durationYears: Number(form.durationYears),
      depreciatedThrough: form.depreciatedThrough ? Number(form.depreciatedThrough) : undefined,
    });
    onAssetsChange([...assets, created]);
    setShowForm(false);
    setForm({ ...form, label: '', cost: '', depreciatedThrough: '' });
    onToast(`« ${created.label} » ajouté au registre.`);
  });

  const depreciate = () => run(async () => {
    const res = await api.depreciateAssets(activeDossier.id, year);
    onAssetsChange([...assets.filter(a => a.clientDossierId !== activeDossier.id), ...res.assets]);
    onEntriesAdded(res.entries);
    onToast(res.entries.length ? `${res.entries.length} écriture(s) de dotation passée(s) au 31/12.` : 'Aucune dotation à passer.');
  });

  const remove = (a: FixedAsset) => run(async () => {
    await api.deleteAsset(a.id);
    onAssetsChange(assets.filter(x => x.id !== a.id));
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-[#DDD6FE] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-black text-[#1E084A] flex items-center gap-2"><Factory className="w-5 h-5 text-[#7024E3]" /> Immobilisations & amortissements</h2>
          <p className="text-xs text-[#7C709A] mt-1">Amortissement linéaire, prorata temporis la première année. Les dotations sont passées au 31/12 (D 6811 / C 28…).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 border border-[#DDD6FE] rounded-lg font-bold">
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => <option key={y} value={y}>Exercice {y}</option>)}
          </select>
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 font-bold border border-[#DDD6FE] text-[#7024E3] rounded-lg">
            <Plus className="w-4 h-4" /> Ajouter une immobilisation
          </button>
          <button disabled={busy || dueThisYear.length === 0 || isLocked(`${year}-12-31`, activeDossier.lockedUntil)} onClick={depreciate}
            title={isLocked(`${year}-12-31`, activeDossier.lockedUntil) ? 'Exercice clôturé' : undefined}
            className="flex items-center gap-1.5 px-3 py-2 font-bold text-white bg-[#7024E3] rounded-lg disabled:opacity-40">
            <Calculator className="w-4 h-4" /> Passer les dotations {year} ({dueThisYear.length})
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl p-5 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <label className="space-y-1 col-span-2 md:col-span-1"><span className="font-bold text-[#534674]">Désignation</span>
            <input className={input} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="ex : Ordinateur portable HP" /></label>
          <label className="space-y-1"><span className="font-bold text-[#534674]">Compte</span>
            <select className={input} value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value })}>
              {assetAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.label}</option>)}
            </select></label>
          <label className="space-y-1"><span className="font-bold text-[#534674]">Date d'acquisition (mise en service)</span>
            <input type="date" className={input} value={form.acquisitionDate} onChange={e => setForm({ ...form, acquisitionDate: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-bold text-[#534674]">Coût d'acquisition HT</span>
            <input inputMode="decimal" className={`${input} text-right font-mono`} value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-bold text-[#534674]">Durée (années)</span>
            <input type="number" min={1} max={50} className={input} value={form.durationYears} onChange={e => setForm({ ...form, durationYears: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-bold text-[#534674]">Dotations déjà comptabilisées jusqu'à (bien ancien)</span>
            <input type="number" placeholder="ex : 2025" className={input} value={form.depreciatedThrough} onChange={e => setForm({ ...form, depreciatedThrough: e.target.value })} /></label>
          <div className="col-span-2 md:col-span-3 flex flex-wrap justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 font-bold border border-[#DDD6FE] rounded-lg">Fermer</button>
            <button disabled={busy || !form.label || !form.cost} onClick={create} className="px-4 py-2 font-bold text-white bg-[#7024E3] rounded-lg disabled:opacity-40">Ajouter au registre</button>
          </div>
        </div>
      )}

      {error && <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs rounded-xl">{error}</div>}

      <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#1E084A] text-white font-mono text-[11px] uppercase">
            <tr>
              <th className="p-2 w-6"></th>
              <th className="p-2 text-left">Immobilisation</th>
              <th className="p-2 text-left">Acquise le</th>
              <th className="p-2 text-right">Coût</th>
              <th className="p-2 text-right">Durée</th>
              <th className="p-2 text-right">Dotation {year}</th>
              <th className="p-2 text-right">Amort. cumulés</th>
              <th className="p-2 text-right">Valeur nette</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-[#7C709A]">Aucune immobilisation. Ajoutez vos véhicules, ordinateurs, mobilier, bâtiments…</td></tr>
            )}
            {rows.map(({ a, schedule, dotation, cumulative, net }) => (
              <React.Fragment key={a.id}>
                <tr className="border-t border-[#EDE9FE] hover:bg-[#FAF8FF]">
                  <td className="p-2">
                    <button onClick={() => setOpen(open === a.id ? null : a.id)} title="Plan d'amortissement">
                      {open === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="p-2"><div className="font-bold text-[#1E084A]">{a.label}</div><div className="text-[10.5px] text-[#7C709A]">{formatSYSCOHADALabel(a.accountCode)}</div></td>
                  <td className="p-2 font-mono">{frDate(a.acquisitionDate)}</td>
                  <td className="p-2 text-right font-mono">{fmt(a.cost)}</td>
                  <td className="p-2 text-right">{a.durationYears} ans</td>
                  <td className="p-2 text-right font-mono">{dotation ? fmt(dotation) : '—'}</td>
                  <td className="p-2 text-right font-mono">{fmt(cumulative)}</td>
                  <td className="p-2 text-right font-mono font-bold">{fmt(net)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <button onClick={() => onRecordPurchase({
                      journal: 'AC', date: a.acquisitionDate, label: `Acquisition ${a.label}`,
                      lines: [{ accountCode: a.accountCode, debit: a.cost, credit: 0 }, { accountCode: '4812', debit: 0, credit: a.cost }],
                    })} className="text-[11px] font-bold text-[#7024E3] hover:underline mr-2" title="Saisir l'écriture d'achat (à ajuster : TVA, paiement)">Écriture d'achat</button>
                    {a.depreciatedThrough === undefined && (
                      <button onClick={() => remove(a)} disabled={busy} title="Retirer du registre" className="p-1 text-[#DC2626] hover:bg-[#FEE2E2] rounded"><Trash2 className="w-3.5 h-3.5 inline" /></button>
                    )}
                  </td>
                </tr>
                {open === a.id && (
                  <tr className="bg-[#FAF8FF]">
                    <td></td>
                    <td colSpan={8} className="p-3">
                      <table className="text-[11.5px] font-mono">
                        <thead><tr className="text-[#7C709A]"><th className="pr-6 text-left">Exercice</th><th className="pr-6 text-right">Dotation</th><th className="pr-6 text-right">Cumul</th><th className="pr-6 text-right">Valeur nette</th><th className="text-left">État</th></tr></thead>
                        <tbody>
                          {schedule.map(r => (
                            <tr key={r.year}>
                              <td className="pr-6">{r.year}</td>
                              <td className="pr-6 text-right">{fmt(r.amount)}</td>
                              <td className="pr-6 text-right">{fmt(r.cumulative)}</td>
                              <td className="pr-6 text-right">{fmt(r.net)}</td>
                              <td>{a.depreciatedThrough !== undefined && r.year <= a.depreciatedThrough ? 'comptabilisée' : 'à passer'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-[#F5F3FF] font-bold">
              <tr>
                <td colSpan={3} className="p-2">Total</td>
                <td className="p-2 text-right font-mono">{fmt(rows.reduce((s, r) => s + r.a.cost, 0))}</td>
                <td></td>
                <td className="p-2 text-right font-mono">{fmt(total('dotation'))}</td>
                <td className="p-2 text-right font-mono">{fmt(total('cumulative'))}</td>
                <td className="p-2 text-right font-mono">{fmt(total('net'))}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
