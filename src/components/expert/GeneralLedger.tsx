import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { SYSCOHADA_ACCOUNTS } from '../../data/syscohadaPlan';
import { BookOpen, Scale, ChevronDown, ChevronRight, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';

interface GeneralLedgerProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  /** Ouvre le détail d'une écriture (clic sur un mouvement). */
  onOpenEntry?: (entry: JournalEntry) => void;
}

interface Movement { entry: JournalEntry; date: string; pieceRef: string; label: string; debit: number; credit: number }

interface AccountBalanceItem {
  code: string;
  label: string;
  accountClass: number;
  /** Solde (débit - crédit) à l'ouverture de la période. */
  opening: number;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
  movements: Movement[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString('fr-FR');
/** Classes de gestion (6 à 8) : leur solde repart de zéro à chaque exercice. */
const isResultAccount = (code: string) => /^[678]/.test(code);
const RAN_CODE = '12*';

export const GeneralLedger: React.FC<GeneralLedgerProps> = ({
  entries,
  activeDossier,
  onOpenEntry
}) => {
  const [selectedClass, setSelectedClass] = useState<number | 'all'>('all');
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const year = String(new Date().getFullYear());
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);

  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id && e.status === 'validated' && e.date <= to);
  const yearStart = `${from.slice(0, 4)}-01-01`;

  const accountMap = new Map<string, AccountBalanceItem>();
  const item = (code: string, fallbackLabel?: string) => {
    if (!accountMap.has(code)) {
      accountMap.set(code, {
        code,
        label: SYSCOHADA_ACCOUNTS.find(a => a.code === code)?.label ?? fallbackLabel ?? `Compte ${code}`,
        accountClass: parseInt(code.charAt(0)) || 0,
        opening: 0, totalDebit: 0, totalCredit: 0, debitBalance: 0, creditBalance: 0, movements: [],
      });
    }
    return accountMap.get(code)!;
  };

  for (const entry of dossierEntries) {
    for (const l of entry.lines) {
      if (entry.date >= from) {
        const acc = item(l.accountCode, l.accountLabel);
        acc.totalDebit += l.debit;
        acc.totalCredit += l.credit;
        acc.movements.push({ entry, date: entry.date, pieceRef: entry.pieceRef, label: l.label ?? entry.label, debit: l.debit, credit: l.credit });
      } else if (!isResultAccount(l.accountCode) || entry.date >= yearStart) {
        item(l.accountCode, l.accountLabel).opening += l.debit - l.credit;
      } else {
        // Résultat des exercices antérieurs : reporté à nouveau (calculé, aucune écriture de clôture).
        item(RAN_CODE, 'Report à nouveau (résultats des exercices antérieurs)').opening += l.debit - l.credit;
      }
    }
  }

  // Soldes finaux = à-nouveau + mouvements de la période
  const allAccounts = Array.from(accountMap.values()).map(acc => {
    const diff = r2(acc.opening + acc.totalDebit - acc.totalCredit);
    acc.movements.sort((a, b) => a.date.localeCompare(b.date));
    return { ...acc, opening: r2(acc.opening), debitBalance: diff > 0 ? diff : 0, creditBalance: diff < 0 ? -diff : 0 };
  }).filter(a => a.opening || a.movements.length).sort((a, b) => a.code.localeCompare(b.code));

  const sum = (f: (a: AccountBalanceItem) => number) => r2(allAccounts.reduce((s, a) => s + f(a), 0));
  const grandOpening = sum(a => a.opening);
  const grandTotalDebit = sum(a => a.totalDebit);
  const grandTotalCredit = sum(a => a.totalCredit);
  const grandTotalSoldeDebiteur = sum(a => a.debitBalance);
  const grandTotalSoldeCrediteur = sum(a => a.creditBalance);

  const isBalanced = grandOpening === 0 && grandTotalDebit === grandTotalCredit && grandTotalSoldeDebiteur === grandTotalSoldeCrediteur;
  const period = `${from.split('-').reverse().join('/')} au ${to.split('-').reverse().join('/')}`;

  const exportXlsx = () => {
    const ledgerRows: (string | number)[][] = [['Compte', 'Intitulé', 'Date', 'Pièce', 'Libellé', 'Débit', 'Crédit', 'Solde cumulé']];
    for (const acc of allAccounts) {
      let running = acc.opening;
      if (acc.opening) ledgerRows.push([acc.code, acc.label, from, '', 'À nouveau', acc.opening > 0 ? acc.opening : 0, acc.opening < 0 ? -acc.opening : 0, running]);
      for (const m of acc.movements) {
        running = r2(running + m.debit - m.credit);
        ledgerRows.push([acc.code, acc.label, m.date, m.pieceRef, m.label, m.debit, m.credit, running]);
      }
    }
    downloadXlsx(`Balance_GrandLivre_${fileSafe(activeDossier.name)}_${from}_${to}`, [
      {
        name: 'Balance',
        rows: [
          [`Balance du ${period}`],
          ['Compte', 'Intitulé', 'Solde à nouveau', 'Mouvements débit', 'Mouvements crédit', 'Solde débiteur', 'Solde créditeur'],
          ...allAccounts.map(a => [a.code, a.label, a.opening, a.totalDebit, a.totalCredit, a.debitBalance, a.creditBalance]),
          ['TOTAL', '', grandOpening, grandTotalDebit, grandTotalCredit, grandTotalSoldeDebiteur, grandTotalSoldeCrediteur],
        ],
      },
      { name: 'Grand Livre', rows: ledgerRows },
    ]);
  };

  const filteredAccounts = selectedClass === 'all' 
    ? allAccounts 
    : allAccounts.filter(a => a.accountClass === selectedClass);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-bold text-[#1E084A]">
            Balance Générale & Grand Livre SYSCOHADA
          </h3>
          <p className="text-xs text-[#7C709A]">
            {activeDossier.name} • période du {period} • cliquez sur un mouvement pour voir l'écriture
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} title="Du"
          className="text-xs p-1.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A]" />
        <input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} title="Au"
          className="text-xs p-1.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A]" />
        <button
          onClick={exportXlsx}
          className="px-3.5 py-1.5 bg-[#F8F7FD] text-[#1E084A] text-xs font-bold rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5 shadow-2xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
          <span>Export Excel</span>
        </button>
        {/* Balance Status Pill */}
        <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs ${
          isBalanced ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
        }`}>
          <Scale className="w-4 h-4" />
          <span>{isBalanced ? 'Partie Double Équilibrée' : 'Déséquilibre Détecté'}</span>
        </div>
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-2 rounded-xl border border-[#DDD6FE] shadow-2xs">
        <button
          onClick={() => setSelectedClass('all')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            selectedClass === 'all' 
              ? 'bg-[#1E084A] text-white shadow-2xs' 
              : 'text-[#1E084A] hover:bg-[#F8F7FD]'
          }`}
        >
          Tous les comptes ({allAccounts.length})
        </button>

        {[
          { cl: 1, label: 'Cl. 1 Capitaux' },
          { cl: 2, label: 'Cl. 2 Immobilisations' },
          { cl: 3, label: 'Cl. 3 Stocks' },
          { cl: 4, label: 'Cl. 4 Tiers' },
          { cl: 5, label: 'Cl. 5 Trésorerie' },
          { cl: 6, label: 'Cl. 6 Charges' },
          { cl: 7, label: 'Cl. 7 Produits' },
          { cl: 8, label: 'Cl. 8 HAO' },
        ].map(item => (
          <button
            key={item.cl}
            onClick={() => setSelectedClass(item.cl)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              selectedClass === item.cl 
                ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-2xs' 
                : 'text-[#534674] hover:bg-[#F5F3FF]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Balance Table */}
      <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-[#1E084A] text-white border-b border-[#3B1578] uppercase font-mono text-[11px]">
                <th className="p-3 w-24">N° Compte</th>
                <th className="p-3">Intitulé SYSCOHADA</th>
                <th className="p-3 text-right">Solde à nouveau</th>
                <th className="p-3 text-right">Mouv. Débit</th>
                <th className="p-3 text-right">Mouv. Crédit</th>
                <th className="p-3 text-right">Solde Débiteur</th>
                <th className="p-3 text-right">Solde Créditeur</th>
                <th className="p-3 text-center w-24">Grand Livre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9FE]">
              {filteredAccounts.map(acc => {
                const isExpanded = expandedAccount === acc.code;
                return (
                  <React.Fragment key={acc.code}>
                    <tr className="hover:bg-[#F5F3FF] transition-colors">
                      <td className="p-3 font-mono font-bold text-[#7024E3]">
                        {acc.code}
                      </td>
                      <td className="p-3 font-semibold text-[#1E084A]">
                        {acc.label}
                      </td>
                      <td className="p-3 text-right font-tabular text-[#534674]">
                        {acc.opening ? `${fmt(Math.abs(acc.opening))} ${acc.opening > 0 ? 'D' : 'C'}` : '—'}
                      </td>
                      <td className="p-3 text-right font-tabular font-bold text-[#1E084A]">
                        {acc.totalDebit > 0 ? acc.totalDebit.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="p-3 text-right font-tabular font-bold text-[#1E084A]">
                        {acc.totalCredit > 0 ? acc.totalCredit.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="p-3 text-right font-tabular font-bold text-[#10B981]">
                        {acc.debitBalance > 0 ? acc.debitBalance.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="p-3 text-right font-tabular font-bold text-[#7024E3]">
                        {acc.creditBalance > 0 ? acc.creditBalance.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setExpandedAccount(isExpanded ? null : acc.code)}
                          className="px-2.5 py-1 bg-[#F8F7FD] hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 text-[#1E084A] transition-colors"
                        >
                          <span>{acc.movements.length} ops</span>
                          {isExpanded ? <ChevronDown className="w-2.5 h-2.5 text-[#7024E3]" /> : <ChevronRight className="w-2.5 h-2.5 text-[#7024E3]" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Grand Livre Details for Account */}
                    {isExpanded && (
                      <tr className="bg-[#FAF8FF]">
                        <td colSpan={8} className="p-4 border-y border-[#EDE9FE]">
                          <div className="bg-white p-4 border border-[#DDD6FE] rounded-xl shadow-2xs">
                            <h5 className="text-[12px] font-mono font-bold text-[#1E084A] uppercase mb-2.5">
                              Extrait du Grand Livre : Compte {acc.code} — {acc.label}
                            </h5>
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="border-b border-[#DDD6FE] text-[#7C709A] font-mono">
                                  <th className="py-1.5">Date</th>
                                  <th className="py-1.5">Pièce</th>
                                  <th className="py-1.5">Libellé</th>
                                  <th className="py-1.5 text-right">Débit</th>
                                  <th className="py-1.5 text-right">Crédit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EDE9FE]">
                                {acc.opening !== 0 && (
                                  <tr className="italic text-[#7C709A]">
                                    <td className="py-1.5 font-mono">{from}</td><td /><td className="py-1.5">À nouveau</td>
                                    <td className="py-1.5 text-right font-tabular">{acc.opening > 0 ? fmt(acc.opening) : '—'}</td>
                                    <td className="py-1.5 text-right font-tabular">{acc.opening < 0 ? fmt(-acc.opening) : '—'}</td>
                                  </tr>
                                )}
                                {acc.movements.map((m, i) => (
                                  <tr key={i} onClick={() => onOpenEntry?.(m.entry)} className={onOpenEntry ? 'cursor-pointer hover:bg-[#F5F3FF]' : ''}>
                                    <td className="py-1.5 font-mono text-[#534674]">{m.date}</td>
                                    <td className="py-1.5 font-mono text-[#7C709A]">{m.pieceRef}</td>
                                    <td className="py-1.5 text-[#1E084A]">{m.label}</td>
                                    <td className="py-1.5 text-right font-tabular font-bold text-[#10B981]">
                                      {m.debit > 0 ? m.debit.toLocaleString('fr-FR') : '—'}
                                    </td>
                                    <td className="py-1.5 text-right font-tabular font-bold text-[#7024E3]">
                                      {m.credit > 0 ? m.credit.toLocaleString('fr-FR') : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* General Totals Footers */}
            <tfoot>
              <tr className="bg-[#1E084A] text-white font-bold font-mono text-xs border-t border-[#3B1578]">
                <td colSpan={2} className="p-3.5 uppercase">
                  Totaux Généraux de la Balance (SYSCOHADA)
                </td>
                <td className="p-3.5 text-right font-tabular text-[#A78BFA]">
                  {fmt(grandOpening)} F
                </td>
                <td className="p-3.5 text-right font-tabular text-[#A78BFA]">
                  {grandTotalDebit.toLocaleString('fr-FR')} F
                </td>
                <td className="p-3.5 text-right font-tabular text-[#A78BFA]">
                  {grandTotalCredit.toLocaleString('fr-FR')} F
                </td>
                <td className="p-3.5 text-right font-tabular text-[#10B981]">
                  {grandTotalSoldeDebiteur.toLocaleString('fr-FR')} F
                </td>
                <td className="p-3.5 text-right font-tabular text-[#C4B5FD]">
                  {grandTotalSoldeCrediteur.toLocaleString('fr-FR')} F
                </td>
                <td className="p-3.5 text-center">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${isBalanced ? 'text-[#065F46] bg-[#D1FAE5]' : 'text-[#991B1B] bg-[#FEE2E2]'}`}>
                    {isBalanced ? 'Équilibrée' : 'Écart'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
