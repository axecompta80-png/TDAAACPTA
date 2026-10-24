import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { computeFinancialReport } from '../../utils/analytics';
import { Printer, FileSpreadsheet } from 'lucide-react';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';

interface FinancialStatementsProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
}

export const FinancialStatements: React.FC<FinancialStatementsProps> = ({
  entries,
  activeDossier
}) => {
  const [activeTab, setActiveTab] = useState<'bilan' | 'resultat'>('bilan');

  const validatedEntries = entries.filter(e => e.clientDossierId === activeDossier.id && e.status === 'validated');

  // Rapport financier calculé exclusivement à partir des écritures validées (aucune valeur factice).
  const report = computeFinancialReport(validatedEntries);

  const sales701 = report.revenue;
  const purchases601 = report.purchases;
  const services605_62_63 = report.services;
  const personnel66 = report.personnel;
  const amort68 = report.depreciation;

  const immobilized2 = report.immobilisationsNettes;
  const stocks3 = report.stocks;
  const receivables4 = report.creances;
  const treasuryCashBank5 = report.treasury;

  const capital1 = report.capital;
  const debts4 = report.dettes;

  const commercialMargin = report.grossMargin;
  const addedValue = report.addedValue;
  const ebe = report.ebe;
  const operatingResult = report.operatingResult;
  const corporateTax = report.corporateTax;
  const netProfit = report.netProfit;

  const totalActif = report.totalActif;
  const calculatedReserves = Math.max(0, report.totalPassif - capital1 - netProfit - debts4);
  const totalPassif = report.totalPassif;

  const exportXlsx = () => {
    const r = report;
    downloadXlsx(`Etats_Financiers_${fileSafe(activeDossier.name)}_${new Date().toISOString().slice(0, 10)}`, [
      {
        name: 'Bilan',
        rows: [
          ['ACTIF', 'Montant', '', 'PASSIF', 'Montant'],
          ['Immobilisations brutes', r.immobilisationsBrutes, '', 'Capital et réserves', r.capital],
          ['Amortissements', -r.amortissements, '', 'Résultat net de l\'exercice', r.resultatBilan],
          ['Immobilisations nettes', r.immobilisationsNettes, '', 'Dettes (fournisseurs, fiscales, sociales)', r.dettes],
          ['Stocks', r.stocks, '', '', ''],
          ['Créances', r.creances, '', '', ''],
          ['Trésorerie actif', r.treasury, '', '', ''],
          ['TOTAL ACTIF', r.totalActif, '', 'TOTAL PASSIF', r.totalPassif],
          [],
          ['Écart actif - passif', r.imbalance],
        ],
      },
      {
        name: 'Compte de résultat',
        rows: [
          ['Rubrique', 'Montant HT'],
          ['Chiffre d\'affaires (70)', r.revenue],
          ['Autres produits (71-75)', r.otherIncome],
          ['Achats (60-61)', -r.purchases],
          ['Marge brute', r.grossMargin],
          ['Services extérieurs (62-63)', -r.services],
          ['Valeur ajoutée', r.addedValue],
          ['Impôts et taxes (64)', -r.taxes],
          ['Charges de personnel (66)', -r.personnel],
          ['Excédent brut d\'exploitation', r.ebe],
          ['Dotations aux amortissements (68)', -r.depreciation],
          ['Résultat d\'exploitation', r.operatingResult],
          ['Résultat financier', r.financialResult],
          ['Résultat HAO', r.haoResult],
          ['Résultat avant impôt', r.resultBeforeTax],
          [r.corporateTaxEstimated ? 'Impôt sur le résultat (estimé 25 %)' : 'Impôt sur le résultat (89)', -r.corporateTax],
          ['RÉSULTAT NET', r.netProfit],
        ],
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {/* Header with Switcher & Actions */}
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase font-mono tracking-wider text-[#7024E3] font-bold">
            Système Normal & SMT • OHADA
          </span>
          <h3 className="font-heading text-xl font-bold text-[#1E084A]">
            États Financiers SYSCOHADA Révisé
          </h3>
          <p className="text-xs text-[#7C709A]">
            {activeDossier.name} • Exercice 2026
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Tab buttons */}
          <div className="bg-[#F8F7FD] p-1 rounded-xl border border-[#DDD6FE] flex">
            <button
              onClick={() => setActiveTab('bilan')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'bilan' 
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-2xs' 
                  : 'text-[#1E084A] hover:bg-[#EDE9FE]'
              }`}
            >
              Bilan (Actif / Passif)
            </button>
            <button
              onClick={() => setActiveTab('resultat')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'resultat' 
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-2xs' 
                  : 'text-[#1E084A] hover:bg-[#EDE9FE]'
              }`}
            >
              Compte de Résultat
            </button>
          </div>

          <button
            onClick={exportXlsx}
            className="p-2.5 bg-[#F8F7FD] text-[#1E084A] rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors shadow-2xs"
            title="Exporter le Bilan et le Compte de résultat (Excel)"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
          </button>
          <button
            onClick={() => window.print()}
            className="p-2.5 bg-[#F8F7FD] text-[#1E084A] rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors shadow-2xs"
            title="Imprimer les états"
          >
            <Printer className="w-4 h-4 text-[#7024E3]" />
          </button>
        </div>
      </div>

      {/* BILAN VIEW */}
      {activeTab === 'bilan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ACTIF */}
          <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-[#1E084A] text-white p-3.5 border-b border-[#3B1578] flex items-center justify-between">
              <h4 className="font-heading text-sm font-bold uppercase tracking-wide">Bilan Actif</h4>
              <span className="text-[11px] font-mono text-[#A78BFA]">Montants Nets (FCFA)</span>
            </div>

            <div className="p-4 space-y-4 text-xs font-sans">
              {/* Actif Immobilise */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>ACTIF IMMOBILISÉ (Classe 2)</span>
                  <span className="font-tabular font-black">{immobilized2.toLocaleString('fr-FR')}</span>
                </div>
                <div className="pl-3 pt-1.5 text-[12px] text-[#7C709A] flex justify-between">
                  <span>Matériel d'exploitation, outillage & agencements</span>
                  <span className="font-tabular font-mono text-[#1E084A]">{immobilized2.toLocaleString('fr-FR')}</span>
                </div>
              </div>

              {/* Actif Circulant */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>ACTIF CIRCULANT (Classes 3 & 4)</span>
                  <span className="font-tabular font-black">{(stocks3 + receivables4).toLocaleString('fr-FR')}</span>
                </div>
                <div className="pl-3 pt-1.5 space-y-1.5 text-[12px] text-[#7C709A]">
                  <div className="flex justify-between">
                    <span>Stocks de marchandises (Compte 31)</span>
                    <span className="font-tabular font-mono text-[#1E084A]">{stocks3.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Créances clients et comptes rattachés (Compte 41)</span>
                    <span className="font-tabular font-mono text-[#1E084A]">{receivables4.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>

              {/* Tresorerie Actif */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>TRÉSORERIE - ACTIF (Classe 5)</span>
                  <span className="font-tabular font-black text-[#10B981]">{treasuryCashBank5.toLocaleString('fr-FR')}</span>
                </div>
                <div className="pl-3 pt-1.5 text-[12px] text-[#7C709A] flex justify-between">
                  <span>Banques, Mobile Money (OM, Wave) & Caisse</span>
                  <span className="font-tabular font-mono text-[#10B981] font-bold">{treasuryCashBank5.toLocaleString('fr-FR')}</span>
                </div>
              </div>

              {/* Total Actif */}
              <div className="pt-3 border-t-2 border-[#1E084A] flex justify-between font-extrabold text-sm text-[#1E084A]">
                <span className="uppercase">Total Général de l'Actif</span>
                <span className="font-tabular font-black text-[#10B981] text-base">{totalActif.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>

          {/* PASSIF */}
          <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-[#1E084A] text-white p-3.5 border-b border-[#3B1578] flex items-center justify-between">
              <h4 className="font-heading text-sm font-bold uppercase tracking-wide">Bilan Passif</h4>
              <span className="text-[11px] font-mono text-[#A78BFA]">Capitaux & Dettes (FCFA)</span>
            </div>

            <div className="p-4 space-y-4 text-xs font-sans">
              {/* Capitaux Propres */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>CAPITAUX PROPRES & RESSOURCES (Classe 1)</span>
                  <span className="font-tabular font-black">{(capital1 + calculatedReserves + netProfit).toLocaleString('fr-FR')}</span>
                </div>
                <div className="pl-3 pt-1.5 space-y-1.5 text-[12px] text-[#7C709A]">
                  <div className="flex justify-between">
                    <span>Capital social (Compte 101)</span>
                    <span className="font-tabular font-mono text-[#1E084A]">{capital1.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Réserves et reports à nouveau</span>
                    <span className="font-tabular font-mono text-[#1E084A]">{calculatedReserves.toLocaleString('fr-FR')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#10B981]">
                    <span>Résultat net de la période (bénéfice)</span>
                    <span className="font-tabular font-mono">+{netProfit.toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>

              {/* Passif Circulant */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>PASSIF CIRCULANT (Classe 4)</span>
                  <span className="font-tabular font-black">{debts4.toLocaleString('fr-FR')}</span>
                </div>
                <div className="pl-3 pt-1.5 text-[12px] text-[#7C709A] flex justify-between">
                  <span>Fournisseurs d'exploitation et dettes fiscales (Compte 40)</span>
                  <span className="font-tabular font-mono text-[#1E084A]">{debts4.toLocaleString('fr-FR')}</span>
                </div>
              </div>

              {/* Tresorerie Passif */}
              <div>
                <div className="flex justify-between font-bold text-[#1E084A] border-b border-[#EDE9FE] pb-1.5">
                  <span>TRÉSORERIE - PASSIF (Classe 5)</span>
                  <span className="font-tabular font-black">0</span>
                </div>
                <div className="pl-3 pt-1.5 text-[12px] text-[#7C709A] flex justify-between">
                  <span>Crédits d'escompte & découverts bancaires</span>
                  <span className="font-tabular font-mono text-[#1E084A]">0</span>
                </div>
              </div>

              {/* Total Passif */}
              <div className="pt-3 border-t-2 border-[#1E084A] flex justify-between font-extrabold text-sm text-[#1E084A]">
                <span className="uppercase">Total Général du Passif</span>
                <span className="font-tabular font-black text-[#10B981] text-base">{totalPassif.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPTE DE RESULTAT VIEW */}
      {activeTab === 'resultat' && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
          <div className="bg-[#1E084A] text-white p-4 border-b border-[#3B1578] flex items-center justify-between">
            <div>
              <h4 className="font-heading text-base font-bold">
                Compte de Résultat SYSCOHADA Révisé (Soldes Intermédiaires de Gestion)
              </h4>
              <p className="text-[11px] text-[#C4B5FD] mt-0.5">
                Formation du résultat d'exploitation et de la valeur ajoutée
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#2A0E68] border border-[#3B1578] text-[#A78BFA] text-xs font-mono font-bold rounded-lg">
              Norme OHADA
            </span>
          </div>

          <div className="p-5 overflow-x-auto">
            <table className="w-full text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-[#DDD6FE] font-mono text-[12px] uppercase text-[#7C709A]">
                  <th className="py-2.5 text-left">Rubriques Comptables SYSCOHADA</th>
                  <th className="py-2.5 text-left">Postes & Comptes</th>
                  <th className="py-2.5 text-right">Montant (FCFA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9FE]">
                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Ventes de marchandises</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Compte 701</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#10B981]">
                    +{sales701.toLocaleString('fr-FR')}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Achats de marchandises</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Compte 601</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#EF4444]">
                    -{purchases601.toLocaleString('fr-FR')}
                  </td>
                </tr>

                {/* Marge Commerciale */}
                <tr className="bg-[#FAF8FF] font-bold">
                  <td className="py-2.5 uppercase text-[#1E084A]">= MARGE COMMERCIALE</td>
                  <td className="py-2.5 text-[#7C709A]">Ventes - Achats</td>
                  <td className="py-2.5 text-right font-tabular text-[#1E084A]">
                    {commercialMargin.toLocaleString('fr-FR')}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Services extérieurs & autres charges</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Comptes 605, 62, 63</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#EF4444]">
                    -{services605_62_63.toLocaleString('fr-FR')}
                  </td>
                </tr>

                {/* Valeur Ajoutee */}
                <tr className="bg-[#FAF8FF] font-bold">
                  <td className="py-2.5 uppercase text-[#1E084A]">= VALEUR AJOUTÉE (VA)</td>
                  <td className="py-2.5 text-[#7C709A]">Marge - Consommations externes</td>
                  <td className="py-2.5 text-right font-tabular text-[#10B981]">
                    {addedValue.toLocaleString('fr-FR')}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Charges de personnel</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Compte 66</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#EF4444]">
                    -{personnel66.toLocaleString('fr-FR')}
                  </td>
                </tr>

                {/* EBE */}
                <tr className="bg-[#FAF8FF] font-bold">
                  <td className="py-2.5 uppercase text-[#1E084A]">= EXCÉDENT BRUT D'EXPLOITATION (EBE)</td>
                  <td className="py-2.5 text-[#7C709A]">VA - Personnel</td>
                  <td className="py-2.5 text-right font-tabular text-[#10B981]">
                    {ebe.toLocaleString('fr-FR')}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Dotations aux amortissements</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Compte 681</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#EF4444]">
                    -{amort68.toLocaleString('fr-FR')}
                  </td>
                </tr>

                {/* Resultat Exploitation */}
                <tr className="bg-[#FAF8FF] font-bold">
                  <td className="py-2.5 uppercase text-[#1E084A]">= RÉSULTAT D'EXPLOITATION</td>
                  <td className="py-2.5 text-[#7C709A]">EBE - Amortissements</td>
                  <td className="py-2.5 text-right font-tabular text-[#1E084A]">
                    {operatingResult.toLocaleString('fr-FR')}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 font-bold text-[#1E084A]">Impôts sur les bénéfices (IS / IMF)</td>
                  <td className="py-2.5 text-[#7C709A] font-mono">Compte 89</td>
                  <td className="py-2.5 text-right font-tabular font-bold text-[#EF4444]">
                    -{corporateTax.toLocaleString('fr-FR')}
                  </td>
                </tr>

                {/* Resultat Net Final */}
                <tr className="bg-[#1E084A] text-white font-extrabold text-sm">
                  <td className="py-3.5 uppercase text-[#A78BFA]">= RÉSULTAT NET DE L'EXERCICE (BÉNÉFICE)</td>
                  <td className="py-3.5 text-[#C4B5FD] font-mono text-xs">Compte 131</td>
                  <td className="py-3.5 text-right font-tabular text-[#10B981] text-base">
                    +{netProfit.toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
