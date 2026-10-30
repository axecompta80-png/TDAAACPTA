import React, { useMemo, useState } from 'react';
import { ClientDossier, JournalCode, JournalEntry, JournalLine } from '../../types';
import { accountsForDossier } from '../../data/syscohadaPlan';
import { JOURNALS, linesError, totalDebit, totalCredit, defaultJournal, isLocked, TVA_COLLECTED, TVA_DEDUCTIBLE } from '../../utils/entryLines';
import { paymentMethodFromAccountCode } from '../../utils/paymentAccounts';
import { isoDate } from '../../utils/analytics';
import { X, Plus, Trash2, Scale, Lock } from 'lucide-react';

const inputCls = 'w-full p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30';
const fmt = (n: number) => n.toLocaleString('fr-FR');

type FormLine = { accountCode: string; label: string; debit: string; credit: string };
const toForm = (l: JournalLine): FormLine => ({ accountCode: l.accountCode, label: l.label ?? '', debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '' });
const num = (s: string) => Math.round((Number(s.replace(',', '.').replace(/\s/g, '')) || 0) * 100) / 100;

/** Modèles de saisie : comptes pré-remplis, montants à saisir (ou calculés depuis un TTC). */
const TEMPLATES: { key: string; label: string; journal: JournalCode; accounts: [string, 'D' | 'C'][]; ttc?: 'achat' | 'vente' }[] = [
  { key: 'achat', label: 'Facture fournisseur', journal: 'AC', accounts: [['6011', 'D'], [TVA_DEDUCTIBLE, 'D'], ['4011', 'C']], ttc: 'achat' },
  { key: 'vente', label: 'Vente à crédit', journal: 'VT', accounts: [['4111', 'D'], ['7011', 'C'], [TVA_COLLECTED, 'C']], ttc: 'vente' },
  { key: 'encaissement', label: 'Encaissement client', journal: 'BQ', accounts: [['5211', 'D'], ['4111', 'C']] },
  { key: 'paiement', label: 'Paiement fournisseur', journal: 'BQ', accounts: [['4011', 'D'], ['5211', 'C']] },
  { key: 'depense', label: 'Dépense payée en caisse', journal: 'CA', accounts: [['6011', 'D'], ['5711', 'C']] },
  { key: 'od', label: 'Opération diverse', journal: 'OD', accounts: [['', 'D'], ['', 'C']] },
  { key: 'an', label: "Soldes d'ouverture", journal: 'AN', accounts: [['5211', 'D'], ['5711', 'D'], ['101', 'C'], ['', 'C']] },
];

interface Props {
  dossier: ClientDossier;
  /** Écriture à modifier, ou modèle de départ pour une nouvelle écriture (sans id). */
  entry?: Partial<JournalEntry>;
  authorName: string;
  /** `repeatMonthly` : nouvelle écriture à répéter chaque mois à la même date. */
  onSave: (entry: JournalEntry, isNew: boolean, repeatMonthly?: boolean) => Promise<boolean>;
  onClose: () => void;
}

export const EntryFormModal: React.FC<Props> = ({ dossier, entry, authorName, onSave, onClose }) => {
  const isNew = !entry?.id;
  const accounts = useMemo(() => accountsForDossier(dossier.id), [dossier.id]);
  const labelOf = (code: string) => accounts.find(a => a.code === code)?.label;

  const [date, setDate] = useState(entry?.date ?? isoDate(new Date()));
  const [journal, setJournal] = useState<JournalCode | ''>(entry?.journal ?? '');
  const [pieceRef, setPieceRef] = useState(entry?.pieceRef ?? '');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [lines, setLines] = useState<FormLine[]>(entry?.lines?.length ? entry.lines.map(toForm) : [toForm({ accountCode: '', debit: 0, credit: 0 }), toForm({ accountCode: '', debit: 0, credit: 0 })]);
  const [template, setTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [ttc, setTtc] = useState('');
  const [rate, setRate] = useState('18');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const parsed: JournalLine[] = lines
    .map(l => ({ accountCode: l.accountCode.trim(), label: l.label.trim() || undefined, debit: num(l.debit), credit: num(l.credit) }))
    .filter(l => l.accountCode || l.debit || l.credit);
  const filled = parsed.filter(l => l.debit || l.credit);
  const d = totalDebit(filled), c = totalCredit(filled);
  const unknown = filled.filter(l => !labelOf(l.accountCode)).map(l => l.accountCode || '(vide)');
  const locked = isLocked(date, dossier.lockedUntil);
  const problem = locked ? `Période bloquée jusqu'au ${dossier.lockedUntil} : choisissez une date ultérieure.`
    : unknown.length ? `Compte inconnu : ${unknown.join(', ')}.`
    : linesError(filled);

  const setLine = (i: number, patch: Partial<FormLine>) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));

  const applyTemplate = (key: string) => {
    const t = TEMPLATES.find(x => x.key === key) ?? null;
    setTemplate(t);
    if (!t) return;
    setJournal(t.journal);
    setLines(t.accounts.map(([code]) => ({ accountCode: code, label: '', debit: '', credit: '' })));
  };

  /** Remplit HT / TVA / TTC du modèle achat ou vente depuis un montant TTC. */
  const fillFromTtc = () => {
    if (!template?.ttc) return;
    const total = num(ttc);
    const tva = Math.round(total * num(rate) / (100 + num(rate)));
    const ht = total - tva;
    const [a, b, t] = lines;
    setLines(template.ttc === 'achat'
      ? [{ ...a, debit: String(ht), credit: '' }, { ...b, debit: tva ? String(tva) : '', credit: '' }, { ...t, debit: '', credit: String(total) }]
      : [{ ...a, debit: String(total), credit: '' }, { ...b, debit: '', credit: String(ht) }, { ...t, debit: '', credit: tva ? String(tva) : '' }]);
  };

  /** Met l'écart débit / crédit sur la dernière ligne sans montant (ou une nouvelle ligne). */
  const balance = () => {
    const diff = Math.round((d - c) * 100) / 100;
    if (!diff) return;
    const i = lines.findIndex(l => !num(l.debit) && !num(l.credit));
    const patch = diff > 0 ? { debit: '', credit: String(diff) } : { debit: String(-diff), credit: '' };
    if (i >= 0) setLine(i, patch);
    else setLines(ls => [...ls, { accountCode: '', label: '', ...patch }]);
  };

  const save = async (asDraft: boolean) => {
    if (problem) return setError(problem);
    if (!label.trim()) return setError('Libellé requis.');
    setSaving(true);
    setError('');
    const treasury = filled.find(l => l.accountCode.startsWith('5'))?.accountCode;
    const out: JournalEntry = {
      ...(entry as JournalEntry),
      id: entry?.id ?? `entry-man-${Date.now()}`,
      clientDossierId: dossier.id,
      date, label: label.trim(), pieceRef: pieceRef.trim(),
      journal: journal || defaultJournal(filled),
      lines: filled,
      amount: d,
      status: asDraft ? 'draft' : 'pending_review',
      detectedAnomaly: undefined,
      rawInput: entry?.rawInput || label.trim(),
      inputType: entry?.inputType ?? 'manual',
      explanationSimplified: entry?.explanationSimplified ?? '',
      paymentMethod: (treasury && paymentMethodFromAccountCode(treasury)) || entry?.paymentMethod || 'bank_transfer',
      auditTrail: [...(entry?.auditTrail ?? []), {
        id: `aud-${Date.now()}`, timestamp: new Date().toISOString(), action: 'edited_by_expert', author: authorName,
        notes: isNew ? 'Saisie manuelle.' : 'Écriture modifiée.',
      }],
    };
    const ok = await onSave(out, isNew, isNew && repeat);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl text-xs">
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#EDE9FE] sticky top-0 bg-white">
          <h4 className="font-heading text-lg font-bold text-[#1E084A]">{isNew ? 'Nouvelle écriture' : `Modifier l'écriture ${entry?.pieceRef ?? ''}`}</h4>
          <button onClick={onClose} className="p-1 text-[#7C709A] hover:text-[#1E084A] rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {isNew && (
            <div className="flex flex-wrap gap-1.5">
              <span className="font-bold text-[#7C709A] self-center mr-1">Modèle :</span>
              {TEMPLATES.map(t => (
                <button key={t.key} type="button" onClick={() => applyTemplate(t.key)}
                  className={`px-2.5 py-1 rounded-lg border font-bold ${template?.key === t.key ? 'bg-[#7024E3] text-white border-[#7024E3]' : 'border-[#DDD6FE] text-[#1E084A] hover:bg-[#F5F3FF]'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block"><span className="font-bold text-[#1E084A]">Date</span>
              <input type="date" required className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="block"><span className="font-bold text-[#1E084A]">Journal</span>
              <select className={inputCls} value={journal} onChange={e => setJournal(e.target.value as JournalCode | '')}>
                <option value="">Automatique{filled.length >= 2 ? ` (${defaultJournal(filled)})` : ''}</option>
                {JOURNALS.map(j => <option key={j.code} value={j.code}>{j.code} — {j.label}</option>)}
              </select></label>
            <label className="block"><span className="font-bold text-[#1E084A]">N° de pièce</span>
              <input className={inputCls} placeholder="Automatique" value={pieceRef} onChange={e => setPieceRef(e.target.value)} /></label>
            <label className="block col-span-2 md:col-span-1"><span className="font-bold text-[#1E084A]">Libellé</span>
              <input required className={inputCls} value={label} onChange={e => setLabel(e.target.value)} /></label>
          </div>

          {template?.ttc && (
            <div className="flex flex-wrap items-end gap-2 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl p-3">
              <label className="block"><span className="font-bold text-[#1E084A]">Montant TTC</span>
                <input className={`${inputCls} w-40 font-mono`} inputMode="decimal" value={ttc} onChange={e => setTtc(e.target.value)} /></label>
              <label className="block"><span className="font-bold text-[#1E084A]">TVA %</span>
                <input className={`${inputCls} w-20 font-mono`} inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></label>
              <button type="button" onClick={fillFromTtc} className="px-3 py-2 bg-[#7024E3] text-white font-bold rounded-lg">Calculer HT et TVA</button>
            </div>
          )}

          <datalist id="entry-accounts">
            {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.label}</option>)}
          </datalist>

          <table className="w-full">
            <thead>
              <tr className="text-left text-[#7C709A] font-bold">
                <th className="pb-1 w-40">Compte</th><th className="pb-1">Intitulé / libellé de ligne</th>
                <th className="pb-1 w-32 text-right">Débit</th><th className="pb-1 w-32 text-right">Crédit</th><th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="pr-2 py-1">
                    <input list="entry-accounts" className={`${inputCls} font-mono ${l.accountCode && !labelOf(l.accountCode) ? 'border-[#DC2626]' : ''}`}
                      value={l.accountCode} onChange={e => setLine(i, { accountCode: e.target.value.split(' ')[0] })} />
                  </td>
                  <td className="pr-2 py-1">
                    <input className={inputCls} placeholder={labelOf(l.accountCode) ?? ''} value={l.label} onChange={e => setLine(i, { label: e.target.value })} />
                  </td>
                  <td className="pr-2 py-1"><input className={`${inputCls} font-mono text-right`} inputMode="decimal" value={l.debit}
                    onChange={e => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} /></td>
                  <td className="pr-2 py-1"><input className={`${inputCls} font-mono text-right`} inputMode="decimal" value={l.credit}
                    onChange={e => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} /></td>
                  <td className="py-1">
                    <button type="button" disabled={lines.length <= 2} title="Supprimer la ligne" className="p-1.5 text-[#DC2626] disabled:opacity-30"
                      onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="pt-2" colSpan={2}>
                  <button type="button" onClick={() => setLines(ls => [...ls, { accountCode: '', label: '', debit: '', credit: '' }])}
                    className="px-2.5 py-1 border border-[#DDD6FE] rounded-lg text-[#7024E3] inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter une ligne</button>
                  {d !== c && (
                    <button type="button" onClick={balance} className="ml-2 px-2.5 py-1 border border-[#DDD6FE] rounded-lg text-[#1E084A] inline-flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5" /> Équilibrer ({fmt(Math.abs(d - c))})
                    </button>
                  )}
                </td>
                <td className="pt-2 pr-2 text-right font-mono">{fmt(d)}</td>
                <td className="pt-2 pr-2 text-right font-mono">{fmt(c)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          {(error || problem) && (
            <p className={`p-2.5 rounded-lg border flex items-center gap-1.5 ${locked ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]' : 'bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]'}`}>
              {locked && <Lock className="w-3.5 h-3.5" />}{error || problem}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 px-6 py-4 border-t border-[#EDE9FE] sticky bottom-0 bg-white">
          {isNew && (
            <label className="mr-auto flex items-center gap-1.5 font-bold text-[#1E084A]" title="Loyer, abonnement… : l'écriture sera recréée chaque mois à la même date">
              <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> Répéter chaque mois
            </label>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DDD6FE] rounded-xl font-bold text-[#1E084A]">Fermer</button>
          {(isNew || entry?.status === 'draft') && (
            <button type="button" disabled={saving || !!problem} onClick={() => save(true)} className="px-4 py-2 border border-[#7024E3] text-[#7024E3] rounded-xl font-bold disabled:opacity-40">
              Enregistrer en brouillon
            </button>
          )}
          <button type="button" disabled={saving || !!problem} onClick={() => save(false)}
            className="px-5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold rounded-xl disabled:opacity-40">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};
