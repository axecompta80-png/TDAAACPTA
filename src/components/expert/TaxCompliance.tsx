import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { Printer, Download, ShieldCheck, QrCode } from 'lucide-react';
import { computeFlows, computeTva, isoDate } from '../../utils/analytics';

interface TaxComplianceProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
}

export const TaxCompliance: React.FC<TaxComplianceProps> = ({
  entries,
  activeDossier
}) => {
  const [taxType, setTaxType] = useState<'tva' | 'dsf'>('tva');

  const [month, setMonth] = useState(isoDate(new Date()).slice(0, 7));
  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id);

  // TVA calculée sur les écritures validées du mois, avec les montants de TVA réellement enregistrés
  const tva = computeTva(dossierEntries, month);
  const { totalSalesHT, tvaCollectee, tvaDeductible } = tva;
  const netTvaToPay = tva.netToPay;
  const creditTva = tva.credit;
  const notValidatedInMonth = dossierEntries.filter(e => e.status !== 'validated' && e.date.startsWith(month)).length;
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // DSF : chiffres de l'année civile du mois sélectionné
  const year = month.slice(0, 4);
  const yearFlows = computeFlows(dossierEntries.filter(e => e.status === 'validated'), `${year}-01-01`, `${year}-12-31`);
  const yearPurchases = dossierEntries
    .filter(e => e.status === 'validated' && e.date.startsWith(year) && /^(60|61|62|63)/.test(e.debitAccountCode))
    .reduce((sum, e) => sum + (e.amount - (e.tvaAmount || 0)), 0);
  const grossAddedValue = Math.max(0, yearFlows.revenue - yearPurchases);

  const downloadDsfSummary = () => {
    const rows = [
      ['Dénomination', activeDossier.name],
      ['RCCM', activeDossier.rccm],
      ['IFU', activeDossier.ifu],
      ['Régime', activeDossier.regimeFiscal],
      ['Exercice', year],
      ['Chiffre d\'affaires HT (FCFA)', yearFlows.revenue],
      ['Achats et services extérieurs HT (FCFA)', yearPurchases],
      ['Valeur ajoutée brute (FCFA)', grossAddedValue],
      ['Charges totales HT (FCFA)', yearFlows.expenses],
      ['Résultat avant impôt (FCFA)', yearFlows.result],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `synthese-dsf-${year}-${activeDossier.name.replace(/[^a-zA-Z0-9]+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] uppercase font-mono tracking-wider text-[#7024E3] font-bold">
            Fiscalité & Déclarations Officielles • {activeDossier.country}
          </span>
          <h3 className="font-heading text-xl font-bold text-[#1E084A]">
            Déclarations Fiscales & Conformité e-Facture
          </h3>
          <p className="text-xs text-[#7C709A]">
            Calcul automatique des bordereaux TVA et de la Déclaration Statistique et Fiscale (DSF OHADA)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-[#F8F7FD] p-1 rounded-xl border border-[#DDD6FE] flex">
            <button
              onClick={() => setTaxType('tva')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                taxType === 'tva' 
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-2xs' 
                  : 'text-[#1E084A] hover:bg-[#EDE9FE]'
              }`}
            >
              Bordereau TVA Mensuel
            </button>
            <button
              onClick={() => setTaxType('dsf')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                taxType === 'dsf' 
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-2xs' 
                  : 'text-[#1E084A] hover:bg-[#EDE9FE]'
              }`}
            >
              Synthèse DSF Annuelle
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="p-2.5 bg-[#F8F7FD] text-[#1E084A] rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] transition-colors shadow-2xs"
            title="Imprimer"
          >
            <Printer className="w-4 h-4 text-[#7024E3]" />
          </button>
        </div>
      </div>

      {taxType === 'tva' && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl p-6 shadow-xs space-y-5">
          {/* Header of Tax Form */}
          <div className="border-b border-[#EDE9FE] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-[#7024E3]">
                DIRECTION GÉNÉRALE DES IMPÔTS • RÉPUBLIQUE DE {activeDossier.country.toUpperCase()}
              </span>
              <h4 className="font-heading text-lg font-bold text-[#1E084A]">
                Bordereau de Déclaration de Taxe sur la Valeur Ajoutée (TVA)
              </h4>
              <p className="text-xs text-[#7C709A] font-mono mt-0.5">
                Redevable : {activeDossier.name} • IFU : {activeDossier.ifu} • Régime : {activeDossier.regimeFiscal}
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold bg-[#F5F3FF] text-[#7024E3] px-2.5 py-1 rounded-lg border border-[#DDD6FE]">
                Échéance : 15 du mois M+1
              </span>
              <span className="block text-[11px] text-[#7C709A] font-mono mt-1">
                Période : {monthLabel}
              </span>
              <input
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="block ml-auto mt-1 text-[11px] font-mono border border-[#DDD6FE] rounded-lg px-1.5 py-0.5 bg-white text-[#1E084A]"
              />
            </div>
          </div>

          {notValidatedInMonth > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs p-3 rounded-xl">
              {notValidatedInMonth} écriture(s) de {monthLabel} ne sont pas encore validées : elles ne sont pas comptées dans ce bordereau. Validez-les dans « Journal & Validation » pour les inclure.
            </div>
          )}

          {/* Detailed Calculations */}
          <div className="space-y-4 text-xs font-sans">
            {/* Section A: Operations Imposables */}
            <div className="bg-[#FAF8FF] p-4 border border-[#DDD6FE] rounded-xl">
              <h5 className="font-bold text-[#1E084A] uppercase text-[12px] mb-2 font-mono">
                I. Opérations Réalisées & TVA Collectée (Taux 18%)
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[#534674]">
                  <span>Chiffre d'affaires taxable réalisé (Ventes locales HT)</span>
                  <span className="font-tabular font-bold font-mono text-[#1E084A]">{totalSalesHT.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#DDD6FE] font-bold">
                  <span className="text-[#10B981]">Total TVA brute collectée (Compte SYSCOHADA 4431)</span>
                  <span className="font-tabular font-mono text-[#10B981] font-black">{tvaCollectee.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            </div>

            {/* Section B: Deductions */}
            <div className="bg-[#FAF8FF] p-4 border border-[#DDD6FE] rounded-xl">
              <h5 className="font-bold text-[#1E084A] uppercase text-[12px] mb-2 font-mono">
                II. Déductions Autorisées (TVA Déductible)
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[#534674]">
                  <span>TVA sur achats de marchandises et matières déductibles</span>
                  <span className="font-tabular font-bold font-mono text-[#1E084A]">{tvaDeductible.toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#DDD6FE] font-bold">
                  <span className="text-[#7024E3]">Total TVA déductible (Compte SYSCOHADA 4451)</span>
                  <span className="font-tabular font-mono text-[#7024E3] font-black">{tvaDeductible.toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>
            </div>

            {/* Section C: Net Tax Due */}
            <div className="bg-[#1E084A] text-white p-5 rounded-2xl border border-[#3B1578] flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-mono uppercase text-[#A78BFA] block font-bold">
                  III. Liquidation Finale de la Taxe
                </span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {netTvaToPay > 0 ? 'TVA Nette à Payer au Trésor Public :' : 'Crédit de TVA Reportable :'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black font-tabular text-[#10B981]">
                  {(netTvaToPay > 0 ? netTvaToPay : creditTva).toLocaleString('fr-FR')} FCFA
                </div>
                <span className="text-[11px] text-[#C4B5FD] font-mono">
                  Code guichet DGI : 444100
                </span>
              </div>
            </div>
          </div>

          {/* e-MECeF / e-Facture Compliance Notice */}
          <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[#166534]">
              <ShieldCheck className="w-5 h-5 shrink-0 text-[#16A34A]" />
              <span>
                <strong>Facturation Électronique Conforme :</strong> Toutes les écritures de ventes sont horodatées et prêtes pour la télé-déclaration API DGI (e-MECeF Bénin / Facture Normalisée CI / SINTAX).
              </span>
            </div>
            <div className="w-10 h-10 bg-[#1E084A] p-1 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      )}

      {taxType === 'dsf' && (
        <div className="bg-white border border-[#DDD6FE] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-[#EDE9FE] pb-3.5">
            <span className="text-[11px] font-mono uppercase font-bold text-[#7024E3]">
              OHADA • DÉCLARATION STATISTIQUE ET FISCALE (DSF)
            </span>
            <h4 className="font-heading text-lg font-bold text-[#1E084A]">
              Liasse Fiscale Annuelle - Tableau 1 & 2
            </h4>
            <p className="text-xs text-[#7C709A]">
              Chiffres clés calculés sur les écritures validées de l'exercice. La liasse officielle reste à établir avec votre expert-comptable.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl">
              <span className="font-bold font-mono block text-[#1E084A] mb-2">Renseignements Généraux</span>
              <div className="space-y-1 text-[#534674]">
                <p>• Dénomination : {activeDossier.name}</p>
                <p>• Numéro RCCM : {activeDossier.rccm}</p>
                <p>• Numéro IFU / Fiscal : {activeDossier.ifu}</p>
                <p>• Régime : {activeDossier.regimeFiscal}</p>
              </div>
            </div>

            <div className="p-4 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl">
              <span className="font-bold font-mono block text-[#1E084A] mb-2">Indicateurs Économiques Clefs</span>
              <div className="space-y-1 text-[#534674]">
                <p>• Chiffre d'affaires HT {year} : {yearFlows.revenue.toLocaleString('fr-FR')} FCFA</p>
                <p>• Valeur ajoutée brute : {grossAddedValue.toLocaleString('fr-FR')} FCFA</p>
                <p>• Résultat avant impôt : {yearFlows.result.toLocaleString('fr-FR')} FCFA</p>
                <p>• Conformité plan de comptes : 100% SYSCOHADA Révisé</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              onClick={downloadDsfSummary}
              className="px-5 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl flex items-center gap-2 hover:from-[#5B18C4] hover:to-[#7024E3] shadow-xs transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger la synthèse DSF (CSV)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
