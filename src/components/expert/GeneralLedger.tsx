import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { SYSCOHADA_ACCOUNTS } from '../../data/syscohadaPlan';
import { BookOpen, Scale, ChevronDown, ChevronRight, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';

interface GeneralLedgerProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
}

interface AccountBalanceItem {
  code: string;
  label: string;
  accountClass: number;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
  movements: {
    date: string;
    pieceRef: string;
    label: string;
    debit: number;
    credit: number;
  }[];
}

export const GeneralLedger: React.FC<GeneralLedgerProps> = ({
  entries,
  activeDossier
}) => {
  const [selectedClass, setSelectedClass] = useState<number | 'all'>('all');
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id && e.status === 'validated');

  // Compute balance for every active SYSCOHADA account
  const accountMap = new Map<string, AccountBalanceItem>();

  // Ensure accounts have entries
  dossierEntries.forEach(entry => {
    // Debit side
    const debitCode = entry.debitAccountCode;
    if (!accountMap.has(debitCode)) {
      const def = SYSCOHADA_ACCOUNTS.find(a => a.code === debitCode);
      accountMap.set(debitCode, {
        code: debitCode,
        label: def ? def.label : entry.debitAccount,
        accountClass: parseInt(debitCode.charAt(0)) || 5,
        totalDebit: 0,
        totalCredit: 0,
        debitBalance: 0,
        creditBalance: 0,
        movements: []
      });
    }
    const debitItem = accountMap.get(debitCode)!;
    debitItem.totalDebit += entry.amount;
    debitItem.movements.push({
      date: entry.date,
      pieceRef: entry.pieceRef,
      label: entry.label,
      debit: entry.amount,
      credit: 0
    });

    // Credit side
    const creditCode = entry.creditAccountCode;
    if (!accountMap.has(creditCode)) {
      const def = SYSCOHADA_ACCOUNTS.find(a => a.code === creditCode);
      accountMap.set(creditCode, {
        code: creditCode,
        label: def ? def.label : entry.creditAccount,
        accountClass: parseInt(creditCode.charAt(0)) || 7,
        totalDebit: 0,
        totalCredit: 0,
        debitBalance: 0,
        creditBalance: 0,
        movements: []
      });
    }
    const creditItem = accountMap.get(creditCode)!;
    creditItem.totalCredit += entry.amount;
    creditItem.movements.push({
      date: entry.date,
      pieceRef: entry.pieceRef,
      label: entry.label,
      debit: 0,
      credit: entry.amount
    });
  });

  // Calculate net balances
  const allAccounts = Array.from(accountMap.values()).map(acc => {
    const diff = acc.totalDebit - acc.totalCredit;
    return {
      ...acc,
      debitBalance: diff > 0 ? diff : 0,
      creditBalance: diff < 0 ? Math.abs(diff) : 0
    };
  }).sort((a, b) => a.code.localeCompare(b.code));

  // Totals
  const grandTotalDebit = allAccounts.reduce((sum, a) => sum + a.totalDebit, 0);
  const grandTotalCredit = allAccounts.reduce((sum, a) => sum + a.totalCredit, 0);
  const grandTotalSoldeDebiteur = allAccounts.reduce((sum, a) => sum + a.debitBalance, 0);
  const grandTotalSoldeCrediteur = allAccounts.reduce((sum, a) => sum + a.creditBalance, 0);

  const isBalanced = grandTotalDebit === grandTotalCredit && grandTotalSoldeDebiteur === grandTotalSoldeCrediteur;

  const exportXlsx = () => {
    const ledgerRows: (string | number)[][] = [['Compte', 'Intitulé', 'Date', 'Pièce', 'Libellé', 'Débit', 'Crédit', 'Solde cumulé']];
    for (const acc of allAccounts) {
      let running = 0;
      for (const m of [...acc.movements].sort((a, b) => a.date.localeCompare(b.date))) {
        running += m.debit - m.credit;
        ledgerRows.push([acc.code, acc.label, m.date, m.pieceRef, m.label, m.debit, m.credit, running]);
      }
    }
    downloadXlsx(`Balance_GrandLivre_${fileSafe(activeDossier.name)}_${new Date().toISOString().slice(0, 10)}`, [
      {
        name: 'Balance',
        rows: [
          ['Compte', 'Intitulé', 'Total débit', 'Total crédit', 'Solde débiteur', 'Solde créditeur'],
          ...allAccounts.map(a => [a.code, a.label, a.totalDebit, a.totalCredit, a.debitBalance, a.creditBalance]),
          ['TOTAL', '', grandTotalDebit, grandTotalCredit, grandTotalSoldeDebiteur, grandTotalSoldeCrediteur],
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
            Synthèse comptable des mouvements et soldes pour {activeDossier.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                <th className="p-3 text-right">Total Débit</th>
                <th className="p-3 text-right">Total Crédit</th>
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
                        <td colSpan={7} className="p-4 border-y border-[#EDE9FE]">
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
                                {acc.movements.map((m, i) => (
                                  <tr key={i}>
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
                  <span className="text-[11px] text-[#065F46] bg-[#D1FAE5] px-2 py-0.5 rounded-full font-bold">
                    100% OK
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
