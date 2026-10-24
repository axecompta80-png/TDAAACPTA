import React, { useState } from 'react';
import { ClientDossier, Invoice, InvoiceInput, JournalEntry, PaymentMethod } from '../../types';
import { CurrentUser } from '../../utils/authApi';
import { api } from '../../utils/api';
import { accountsForDossier } from '../../data/syscohadaPlan';
import { PAYMENT_METHOD_LABEL } from '../../utils/paymentAccounts';
import { canValidate, canUnvalidate, canWrite, isOwnWork, ownsDossier } from '../../utils/roles';
import { computeInvoiceTotals, computeAgedBalance, AGING_BUCKETS, paidAmount, remainingAmount, settlementState } from '../../utils/invoices';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';
import { FileText, Plus, X, Send, Check, Ban, Edit3, Wallet, Printer, FileSpreadsheet, Trash2, Link2 } from 'lucide-react';

interface InvoicesPanelProps {
  invoices: Invoice[];
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  currentUser: CurrentUser;
  onInvoiceChanged: (invoice: Invoice) => void;
  onEntriesChanged: (entries: JournalEntry[]) => void;
  notify: (message: string) => void;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const STATUS: Record<Invoice['status'], { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]' },
  pending_review: { label: 'En attente', cls: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]' },
  validated: { label: 'Validée', cls: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' },
  cancelled: { label: 'Annulée', cls: 'bg-[#F1F5F9] text-[#64748B] border-[#CBD5E1] line-through' },
};
const SETTLEMENT = {
  unpaid: { label: 'Non réglée', cls: 'text-[#DC2626]' },
  partial: { label: 'Partiellement soldée', cls: 'text-[#D97706]' },
  paid: { label: 'Soldée', cls: 'text-[#16A34A]' },
};

const inputCls = 'w-full p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30';
const btn = 'p-1.5 rounded-lg transition-colors';

export const InvoicesPanel: React.FC<InvoicesPanelProps> = ({
  invoices, entries, activeDossier, currentUser, onInvoiceChanged, onEntriesChanged, notify,
}) => {
  const [view, setView] = useState<'list' | 'aged'>('list');
  const [editing, setEditing] = useState<Invoice | 'new' | null>(null);
  const [lettering, setLettering] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  const writer = canWrite(currentUser.role);
  // Le propriétaire du dossier émet ses factures lui-même, sans circuit de validation
  const owner = ownsDossier(activeDossier, currentUser);
  const validator = owner || canValidate(currentUser.role);
  const chief = owner || canUnvalidate(currentUser.role);
  const aged = computeAgedBalance(invoices, today());

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { notify(e?.message || 'Action impossible.'); } finally { setBusy(false); }
  };

  const submit = (inv: Invoice) => run(async () => {
    onInvoiceChanged(await api.submitInvoice(inv.id));
    notify(`Facture ${inv.number} soumise à validation.`);
  });
  const validate = (inv: Invoice) => run(async () => {
    const r = await api.validateInvoice(inv.id);
    onInvoiceChanged(r.invoice);
    onEntriesChanged(r.entries);
    notify(`Facture ${inv.number} validée : ${r.entries.length} écriture(s) générée(s).`);
  });
  const cancel = (inv: Invoice) => {
    const reason = window.prompt(`Motif de l'annulation de ${inv.number} (facultatif) :`, '');
    if (reason === null) return;
    run(async () => {
      const r = await api.cancelInvoice(inv.id, reason);
      onInvoiceChanged(r.invoice);
      onEntriesChanged(r.entries);
      notify(`Facture ${inv.number} annulée.`);
    });
  };

  const exportXlsx = () => {
    const name = `Factures_${fileSafe(activeDossier.name)}_${today()}`;
    downloadXlsx(name, [
      {
        name: 'Balance âgée',
        rows: [
          ['Client', 'Factures', ...AGING_BUCKETS.map(b => b.label), 'Total dû'],
          ...[...aged.rows, aged.totals].map(r => [r.customer, r.invoices, ...AGING_BUCKETS.map(b => r.buckets[b.key]), r.total]),
        ],
      },
      {
        name: 'Factures',
        rows: [
          ['N°', 'Date', 'Échéance', 'Client', 'Mode', 'HT', 'TVA', 'TTC', 'Réglé', 'Reste dû', 'Statut'],
          ...invoices.map(i => [i.number, i.date, i.dueDate, i.customerName, i.mode === 'cash' ? 'Comptant' : 'Crédit',
            i.totalHT, i.totalTVA, i.totalTTC, paidAmount(i), remainingAmount(i), STATUS[i.status].label]),
        ],
      },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-bold text-[#1E084A]">Factures, Lettrage & Balance âgée</h3>
          <p className="text-xs text-[#7C709A]">
            {invoices.length} facture(s) • Créances clients restant dues : <b className="text-[#1E084A]">{fmt(aged.totals.total)} FCFA</b>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#F8F7FD] p-1 rounded-xl border border-[#DDD6FE] flex">
            {(['list', 'aged'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${view === v ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white' : 'text-[#1E084A] hover:bg-[#EDE9FE]'}`}>
                {v === 'list' ? 'Factures' : 'Balance âgée'}
              </button>
            ))}
          </div>
          <button onClick={exportXlsx} className="px-3.5 py-2 bg-[#F8F7FD] text-[#1E084A] text-xs font-bold rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" /> Export Excel
          </button>
          {writer && (
            <button onClick={() => setEditing('new')} className="px-4 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nouvelle facture
            </button>
          )}
        </div>
      </div>

      {view === 'list' && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1E084A] text-white uppercase font-mono text-[11px]">
                  <th className="p-3">N° / Date</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Échéance</th>
                  <th className="p-3 text-right">TTC</th>
                  <th className="p-3 text-right">Reste dû</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9FE]">
                {invoices.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-[#7C709A]">Aucune facture pour ce dossier.</td></tr>
                )}
                {invoices.map(inv => {
                  const own = !owner && isOwnWork(inv, currentUser.id);
                  const st = settlementState(inv);
                  const late = inv.status === 'validated' && st !== 'paid' && inv.dueDate < today();
                  return (
                    <tr key={inv.id} className="hover:bg-[#F5F3FF]">
                      <td className="p-3 font-mono whitespace-nowrap">
                        <div className="font-bold text-[#1E084A]">{inv.number}</div>
                        <div className="text-[10.5px] text-[#7C709A]">{inv.date} • {inv.mode === 'cash' ? 'Comptant' : 'Crédit'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-[#1E084A]">{inv.customerName}</div>
                        <div className="text-[10.5px] text-[#7C709A] font-mono">{inv.customerAccountCode}</div>
                      </td>
                      <td className={`p-3 font-mono whitespace-nowrap ${late ? 'text-[#DC2626] font-bold' : ''}`}>{inv.dueDate}</td>
                      <td className="p-3 text-right font-bold whitespace-nowrap">{fmt(inv.totalTTC)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="font-bold">{inv.status === 'validated' ? fmt(remainingAmount(inv)) : '—'}</div>
                        {inv.status === 'validated' && <div className={`text-[10.5px] font-bold ${SETTLEMENT[st].cls}`}>{SETTLEMENT[st].label}</div>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 border text-[11px] font-bold rounded-full ${STATUS[inv.status].cls}`}>{STATUS[inv.status].label}</span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button className={`${btn} text-[#1E084A] hover:bg-[#F5F3FF]`} title="Imprimer" onClick={() => printInvoice(inv, activeDossier)}>
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {writer && (inv.status === 'draft' || inv.status === 'pending_review') && (
                            <button className={`${btn} text-[#1E084A] hover:bg-[#F5F3FF]`} title="Modifier" onClick={() => setEditing(inv)}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {writer && !owner && inv.status === 'draft' && (
                            <button disabled={busy} className={`${btn} text-[#7024E3] hover:bg-[#F5F3FF]`} title="Soumettre à validation" onClick={() => submit(inv)}>
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {validator && (inv.status === 'pending_review' || (owner && inv.status === 'draft')) && (own ? (
                            <span className={`${btn} text-[#C4B5FD] cursor-help`} title="Séparation des tâches : un autre valideur doit valider votre facture.">
                              <Check className="w-4 h-4" />
                            </span>
                          ) : (
                            <button disabled={busy} className={`${btn} text-[#10B981] hover:bg-[#F0FDF4]`} title={owner ? "Émettre la facture (génère les écritures)" : "Valider et générer les écritures"} onClick={() => validate(inv)}>
                              <Check className="w-4 h-4" />
                            </button>
                          ))}
                          {writer && inv.status === 'validated' && (
                            <button className={`${btn} text-[#0EA5E9] hover:bg-[#E0F2FE]`} title="Règlements & lettrage" onClick={() => setLettering(inv)}>
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {((writer && (inv.status === 'draft' || inv.status === 'pending_review')) || (chief && inv.status === 'validated')) && (
                            <button disabled={busy} className={`${btn} text-[#DC2626] hover:bg-[#FEE2E2]`} title="Annuler la facture" onClick={() => cancel(inv)}>
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'aged' && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1E084A] text-white uppercase font-mono text-[11px]">
                  <th className="p-3">Client</th>
                  {AGING_BUCKETS.map(b => <th key={b.key} className="p-3 text-right">{b.label}</th>)}
                  <th className="p-3 text-right">Total dû</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9FE]">
                {aged.rows.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-[#7C709A]">Aucune créance impayée sur les factures validées.</td></tr>
                )}
                {[...aged.rows, ...(aged.rows.length ? [aged.totals] : [])].map(r => (
                  <tr key={r.customer} className={r === aged.totals ? 'bg-[#F5F3FF] font-bold' : 'hover:bg-[#F5F3FF]'}>
                    <td className="p-3 font-semibold text-[#1E084A]">{r.customer} <span className="text-[#7C709A] font-normal">({r.invoices})</span></td>
                    {AGING_BUCKETS.map((b, i) => (
                      <td key={b.key} className={`p-3 text-right font-mono ${r.buckets[b.key] && i >= 3 ? 'text-[#DC2626] font-bold' : ''}`}>
                        {r.buckets[b.key] ? fmt(r.buckets[b.key]) : '—'}
                      </td>
                    ))}
                    <td className="p-3 text-right font-mono font-bold">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-3 text-[11px] text-[#7C709A] border-t border-[#EDE9FE]">
            Calculée sur les factures validées, déduction faite des règlements lettrés. Retard = jours écoulés depuis l'échéance.
          </p>
        </div>
      )}

      {editing && (
        <InvoiceEditor
          invoice={editing === 'new' ? null : editing}
          activeDossier={activeDossier}
          onClose={() => setEditing(null)}
          onSaved={(inv) => { onInvoiceChanged(inv); setEditing(null); notify(`Facture ${inv.number} enregistrée.`); }}
          notify={notify}
        />
      )}

      {lettering && (
        <LetteringModal
          invoice={invoices.find(i => i.id === lettering.id) ?? lettering}
          invoices={invoices}
          entries={entries}
          onClose={() => setLettering(null)}
          onInvoiceChanged={onInvoiceChanged}
          onEntriesChanged={onEntriesChanged}
          notify={notify}
        />
      )}
    </div>
  );
};

// ---------- Éditeur de facture ----------

interface InvoiceEditorProps {
  invoice: Invoice | null;
  activeDossier: ClientDossier;
  onClose: () => void;
  onSaved: (invoice: Invoice) => void;
  notify: (message: string) => void;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ invoice, activeDossier, onClose, onSaved, notify }) => {
  const accounts = accountsForDossier(activeDossier.id);
  const customerAccounts = accounts.filter(a => a.code.startsWith('411'));
  const salesAccounts = accounts.filter(a => a.code.startsWith('70'));
  const [form, setForm] = useState<InvoiceInput>(() => invoice ? {
    date: invoice.date, dueDate: invoice.dueDate, mode: invoice.mode, paymentMethod: invoice.paymentMethod,
    customerName: invoice.customerName, customerPhone: invoice.customerPhone, customerEmail: invoice.customerEmail,
    customerAddress: invoice.customerAddress, customerTaxId: invoice.customerTaxId,
    customerAccountCode: invoice.customerAccountCode, salesAccountCode: invoice.salesAccountCode,
    vatRate: invoice.vatRate, paymentTerms: invoice.paymentTerms, notes: invoice.notes,
    lines: invoice.lines.map(l => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })),
  } : {
    date: today(), dueDate: addDays(today(), 30), mode: 'credit', paymentMethod: 'cash',
    customerName: '', customerAccountCode: '4111', salesAccountCode: '7011', vatRate: 18,
    paymentTerms: 'Paiement à 30 jours fin de mois', lines: [{ description: '', quantity: 1, unitPrice: 0 }],
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof InvoiceInput>(k: K, v: InvoiceInput[K]) => setForm(f => ({ ...f, [k]: v }));
  const setLine = (i: number, patch: Partial<InvoiceInput['lines'][number]>) =>
    setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));
  const totals = computeInvoiceTotals(form.lines, form.vatRate);

  const save = async (submit: boolean) => {
    setSaving(true);
    try {
      const saved = invoice ? await api.updateInvoice(invoice.id, form, submit) : await api.createInvoice(activeDossier.id, form, submit);
      onSaved(saved);
    } catch (e: any) {
      notify(e?.message || "Erreur lors de l'enregistrement de la facture.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl">
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between sticky top-0">
          <h3 className="font-heading text-base font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#A78BFA]" /> {invoice ? `Modifier la facture ${invoice.number}` : 'Nouvelle facture'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); save(true); }} className="p-6 space-y-5 text-xs">
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="font-bold text-[#7024E3] mb-2 uppercase tracking-wider text-[11px]">Client</legend>
            <label className="sm:col-span-2"><span className="font-bold block mb-1">Nom / Raison sociale *</span>
              <input required className={inputCls} value={form.customerName} onChange={e => set('customerName', e.target.value)} /></label>
            <label><span className="font-bold block mb-1">Téléphone</span>
              <input className={inputCls} value={form.customerPhone ?? ''} onChange={e => set('customerPhone', e.target.value)} /></label>
            <label><span className="font-bold block mb-1">Email</span>
              <input type="email" className={inputCls} value={form.customerEmail ?? ''} onChange={e => set('customerEmail', e.target.value)} /></label>
            <label><span className="font-bold block mb-1">Adresse</span>
              <input className={inputCls} value={form.customerAddress ?? ''} onChange={e => set('customerAddress', e.target.value)} /></label>
            <label><span className="font-bold block mb-1">IFU / NCC du client</span>
              <input className={inputCls} value={form.customerTaxId ?? ''} onChange={e => set('customerTaxId', e.target.value)} /></label>
            <label className="sm:col-span-2"><span className="font-bold block mb-1">Compte client (411)</span>
              <select className={`${inputCls} font-mono`} value={form.customerAccountCode} onChange={e => set('customerAccountCode', e.target.value)}>
                {customerAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.label}</option>)}
              </select>
              <span className="text-[10.5px] text-[#7C709A]">Créez un sous-compte client dédié dans « Plan comptable » (ex. 41111).</span>
            </label>
          </fieldset>

          <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <legend className="font-bold text-[#7024E3] mb-2 uppercase tracking-wider text-[11px]">Conditions</legend>
            <label><span className="font-bold block mb-1">Type</span>
              <select className={inputCls} value={form.mode} onChange={e => set('mode', e.target.value as InvoiceInput['mode'])}>
                <option value="credit">À crédit</option>
                <option value="cash">Au comptant</option>
              </select></label>
            <label><span className="font-bold block mb-1">Date</span>
              <input type="date" required className={inputCls} value={form.date} onChange={e => set('date', e.target.value)} /></label>
            {form.mode === 'credit' ? (
              <label><span className="font-bold block mb-1">Échéance</span>
                <input type="date" required min={form.date} className={inputCls} value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value)} /></label>
            ) : (
              <label><span className="font-bold block mb-1">Règlement</span>
                <select className={inputCls} value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value as PaymentMethod)}>
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
                </select></label>
            )}
            <label><span className="font-bold block mb-1">Compte de vente</span>
              <select className={`${inputCls} font-mono`} value={form.salesAccountCode} onChange={e => set('salesAccountCode', e.target.value)}>
                {salesAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.label}</option>)}
              </select></label>
            <label className="col-span-2 sm:col-span-4"><span className="font-bold block mb-1">Conditions de règlement</span>
              <input className={inputCls} value={form.paymentTerms ?? ''} onChange={e => set('paymentTerms', e.target.value)} placeholder="Ex. 50 % à la commande, solde à 30 jours" /></label>
          </fieldset>

          <fieldset>
            <legend className="font-bold text-[#7024E3] mb-2 uppercase tracking-wider text-[11px]">Articles / Services</legend>
            <div className="space-y-2">
              {form.lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input required placeholder="Désignation" className={`${inputCls} col-span-6`} value={l.description} onChange={e => setLine(i, { description: e.target.value })} />
                  <input type="number" min="0" step="any" required title="Quantité" className={`${inputCls} col-span-2 font-mono`} value={l.quantity} onChange={e => setLine(i, { quantity: Number(e.target.value) })} />
                  <input type="number" min="0" step="any" required title="Prix unitaire HT" className={`${inputCls} col-span-2 font-mono`} value={l.unitPrice} onChange={e => setLine(i, { unitPrice: Number(e.target.value) })} />
                  <span className="col-span-1 text-right font-mono font-bold">{fmt(totals.amounts[i] ?? 0)}</span>
                  <button type="button" disabled={form.lines.length === 1} className="col-span-1 p-1.5 text-[#DC2626] disabled:opacity-30" title="Supprimer la ligne"
                    onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-[#7024E3] font-bold flex items-center gap-1"
              onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { description: '', quantity: 1, unitPrice: 0 }] }))}>
              <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
            </button>
          </fieldset>

          <div className="flex flex-col sm:flex-row justify-between gap-4 border-t border-[#EDE9FE] pt-4">
            <label className="flex-1"><span className="font-bold block mb-1">Notes</span>
              <textarea rows={3} className={inputCls} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></label>
            <div className="sm:w-64 space-y-1.5 font-mono">
              <div className="flex justify-between"><span>Total HT</span><b>{fmt(totals.totalHT)}</b></div>
              <div className="flex justify-between items-center"><span>TVA
                <input type="number" min="0" max="100" step="any" className="w-14 ml-1 p-1 border border-[#DDD6FE] rounded" value={form.vatRate} onChange={e => set('vatRate', Number(e.target.value))} /> %</span>
                <b>{fmt(totals.totalTVA)}</b></div>
              <div className="flex justify-between text-sm text-[#7024E3] border-t border-[#EDE9FE] pt-1.5"><span className="font-bold">Total TTC</span><b>{fmt(totals.totalTTC)} FCFA</b></div>
            </div>
          </div>

          <p className="text-[11px] text-[#7C709A]">
            À l'émission : débit {form.customerAccountCode} {fmt(totals.totalTTC)},
            crédit {form.salesAccountCode} {fmt(totals.totalHT)}{totals.totalTVA > 0 ? `, crédit 4431 ${fmt(totals.totalTVA)}` : ''}
            {form.mode === 'cash' ? ' + encaissement immédiat lettré.' : '.'}
          </p>

          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#DDD6FE] rounded-xl font-bold">Fermer</button>
            <button type="button" disabled={saving} onClick={() => save(false)} className="px-4 py-2 border border-[#7024E3] text-[#7024E3] rounded-xl font-bold disabled:opacity-50">
              Enregistrer en brouillon
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold rounded-xl disabled:opacity-50">
              Enregistrer et soumettre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Lettrage ----------

interface LetteringModalProps {
  invoice: Invoice;
  invoices: Invoice[];
  entries: JournalEntry[];
  onClose: () => void;
  onInvoiceChanged: (invoice: Invoice) => void;
  onEntriesChanged: (entries: JournalEntry[]) => void;
  notify: (message: string) => void;
}

const LetteringModal: React.FC<LetteringModalProps> = ({ invoice, invoices, entries, onClose, onInvoiceChanged, onEntriesChanged, notify }) => {
  const remaining = remainingAmount(invoice);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [busy, setBusy] = useState(false);

  // Montant déjà lettré de chaque écriture, toutes factures confondues
  const allocated = new Map<string, number>();
  for (const inv of invoices) for (const p of inv.payments) allocated.set(p.entryId, (allocated.get(p.entryId) ?? 0) + p.amount);
  const candidates = entries
    .filter(e => e.creditAccountCode.startsWith('411') && e.amount - (allocated.get(e.id) ?? 0) > 0)
    .map(e => ({ entry: e, free: e.amount - (allocated.get(e.id) ?? 0) }))
    .sort((a, b) => Number(b.entry.creditAccountCode === invoice.customerAccountCode) - Number(a.entry.creditAccountCode === invoice.customerAccountCode));

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { notify(e?.message || 'Lettrage impossible.'); } finally { setBusy(false); }
  };
  const letter = (body: Parameters<typeof api.letterPayment>[1]) => act(async () => {
    const r = await api.letterPayment(invoice.id, body);
    onInvoiceChanged(r.invoice);
    onEntriesChanged([r.entry]);
    setAmount(remainingAmount(r.invoice));
    notify(remainingAmount(r.invoice) === 0 ? `Facture ${invoice.number} soldée.` : 'Règlement lettré.');
  });
  const unletter = (paymentId: string) => act(async () => {
    const inv = await api.unletterPayment(paymentId);
    onInvoiceChanged(inv);
    setAmount(remainingAmount(inv));
    notify('Lettrage supprimé.');
  });
  const entryOf = (id: string) => entries.find(e => e.id === id);

  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl text-xs">
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between sticky top-0">
          <h3 className="font-heading text-base font-bold flex items-center gap-2"><Link2 className="w-5 h-5 text-[#A78BFA]" /> Lettrage — {invoice.number}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[['Total TTC', invoice.totalTTC], ['Réglé', paidAmount(invoice)], ['Reste dû', remaining]].map(([l, v]) => (
              <div key={l as string} className="bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl p-3">
                <div className="text-[#7C709A]">{l}</div>
                <div className="font-mono font-bold text-sm text-[#1E084A]">{fmt(v as number)}</div>
              </div>
            ))}
          </div>

          <section>
            <h4 className="font-bold text-[#1E084A] mb-2">Règlements lettrés</h4>
            {invoice.payments.length === 0 ? <p className="text-[#7C709A]">Aucun règlement lettré.</p> : (
              <ul className="divide-y divide-[#EDE9FE] border border-[#EDE9FE] rounded-xl">
                {invoice.payments.map(p => {
                  const e = entryOf(p.entryId);
                  return (
                    <li key={p.id} className="flex items-center justify-between p-2.5">
                      <span>{e ? `${e.date} • ${e.pieceRef} • ${e.label}` : p.entryId}{e && e.status !== 'validated' && <em className="text-[#D97706]"> (écriture en attente de validation)</em>}</span>
                      <span className="flex items-center gap-2">
                        <b className="font-mono">{fmt(p.amount)}</b>
                        {e?.invoiceId !== invoice.id && (
                          <button disabled={busy} onClick={() => unletter(p.id)} className="text-[#DC2626]" title="Délettrer"><X className="w-3.5 h-3.5" /></button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {remaining > 0 && (
            <>
              <section className="border border-[#DDD6FE] rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-[#1E084A]">Enregistrer un nouveau règlement</h4>
                <div className="grid grid-cols-3 gap-2">
                  <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
                  <input type="number" min="1" max={remaining} className={`${inputCls} font-mono`} value={amount} onChange={e => setAmount(Number(e.target.value))} />
                  <select className={inputCls} value={method} onChange={e => setMethod(e.target.value as PaymentMethod)}>
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
                  </select>
                </div>
                <button disabled={busy || amount <= 0 || amount > remaining} onClick={() => letter({ newPayment: { date, amount, paymentMethod: method } })}
                  className="px-4 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold rounded-xl disabled:opacity-40">
                  Encaisser et lettrer {fmt(amount)}
                </button>
                <p className="text-[10.5px] text-[#7C709A]">Crée l'écriture « trésorerie / {invoice.customerAccountCode} », lettrée sur cette facture.</p>
              </section>

              <section>
                <h4 className="font-bold text-[#1E084A] mb-2">Lettrer un règlement déjà saisi (crédit 411)</h4>
                {candidates.length === 0 ? <p className="text-[#7C709A]">Aucun règlement disponible.</p> : (
                  <ul className="divide-y divide-[#EDE9FE] border border-[#EDE9FE] rounded-xl">
                    {candidates.map(({ entry, free }) => (
                      <li key={entry.id} className="flex items-center justify-between p-2.5 gap-2">
                        <span>{entry.date} • {entry.pieceRef} • {entry.label} <span className="font-mono text-[#7C709A]">({entry.creditAccountCode})</span></span>
                        <button disabled={busy} onClick={() => letter({ entryId: entry.id, amount: Math.min(free, remaining) })}
                          className="px-2.5 py-1 border border-[#7024E3] text-[#7024E3] font-bold rounded-lg whitespace-nowrap">
                          Lettrer {fmt(Math.min(free, remaining))}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------- Impression ----------

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Facture imprimable avec les mentions obligatoires (émetteur, RCCM / IFU, numéro, dates, HT / TVA / TTC, conditions). */
export function printInvoice(inv: Invoice, d: ClientDossier) {
  const w = window.open('', '_blank', 'width=820,height=1000');
  if (!w) return;
  const rows = inv.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="n">${fmt(l.quantity)}</td><td class="n">${fmt(l.unitPrice)}</td><td class="n">${fmt(l.amountHT)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.number)}</title><style>
    body{font-family:Arial,sans-serif;color:#1E084A;margin:40px;font-size:13px}
    h1{font-size:22px;margin:0}.top{display:flex;justify-content:space-between;gap:24px;margin-bottom:28px}
    table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
    th{background:#1E084A;color:#fff}.n{text-align:right}.tot td{border:none}.tot .b{font-weight:bold;font-size:15px}
    .muted{color:#666;font-size:12px}.stamp{color:#B45309;font-weight:bold}
  </style></head><body>
    <div class="top">
      <div><h1>${esc(d.name)}</h1><div class="muted">${esc(d.activity)}<br>${esc(d.city)}, ${esc(d.country)} • Tél. ${esc(d.phone)}<br>RCCM : ${esc(d.rccm)} • IFU : ${esc(d.ifu)}<br>Régime : ${esc(d.regimeFiscal)}</div></div>
      <div style="text-align:right"><h1>FACTURE</h1><div>N° <b>${esc(inv.number)}</b></div><div>Date : ${esc(inv.date)}</div>
        <div>Échéance : ${esc(inv.dueDate)}</div><div>${inv.mode === 'cash' ? 'Au comptant' : 'À crédit'}</div>
        ${inv.status !== 'validated' ? `<div class="stamp">${inv.status === 'cancelled' ? 'ANNULÉE' : 'PROFORMA — non validée'}</div>` : ''}</div>
    </div>
    <div><b>Facturé à :</b> ${esc(inv.customerName)}<br><span class="muted">${[inv.customerAddress, inv.customerPhone, inv.customerEmail, inv.customerTaxId && `IFU : ${inv.customerTaxId}`].filter(Boolean).map(esc).join(' • ')}</span></div>
    <table><thead><tr><th>Désignation</th><th class="n">Qté</th><th class="n">P.U. HT</th><th class="n">Montant HT</th></tr></thead><tbody>${rows}</tbody></table>
    <table class="tot" style="width:320px;margin-left:auto">
      <tr><td>Total HT</td><td class="n">${fmt(inv.totalHT)}</td></tr>
      <tr><td>TVA ${fmt(inv.vatRate)} %</td><td class="n">${fmt(inv.totalTVA)}</td></tr>
      <tr><td class="b">Total TTC (${esc(d.currency)})</td><td class="n b">${fmt(inv.totalTTC)}</td></tr>
    </table>
    ${inv.paymentTerms ? `<p><b>Conditions de règlement :</b> ${esc(inv.paymentTerms)}</p>` : ''}
    ${inv.mode === 'cash' && inv.paymentMethod ? `<p>Réglée ${esc(PAYMENT_METHOD_LABEL[inv.paymentMethod])}.</p>` : ''}
    ${inv.notes ? `<p class="muted">${esc(inv.notes)}</p>` : ''}
    <script>window.onload=()=>window.print()</script>
  </body></html>`);
  w.document.close();
}
