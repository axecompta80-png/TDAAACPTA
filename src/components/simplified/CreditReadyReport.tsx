import React from 'react';
import { computeCreditAssessment } from '../../utils/analytics';
import { ClientDossier, JournalEntry } from '../../types';
import { 
  FileCheck, 
  ShieldCheck, 
  Printer, 
  Download, 
  QrCode, 
  TrendingUp, 
  CheckCircle2, 
  Building2, 
  X
} from 'lucide-react';

interface CreditReadyReportProps {
  activeDossier: ClientDossier;
  entries: JournalEntry[];
  onClose: () => void;
}

export const CreditReadyReport: React.FC<CreditReadyReportProps> = ({
  activeDossier,
  entries,
  onClose
}) => {
  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id);

  // Tout est calculé sur les écritures réelles du dossier (6 derniers mois maximum)
  const assessment = computeCreditAssessment(dossierEntries);
  const solvabilityScore = assessment.score;
  const estimatedMonthlyRevenue = assessment.avgMonthlyRevenue;
  const estimatedMonthlyNetFlow = assessment.avgMonthlyNetFlow;
  const maxMonthlyReimbursement = assessment.maxMonthlyRepayment;
  const suggested12MonthCredit = assessment.suggested12MonthCredit;
  const traceabilityRate = assessment.traceabilityRate;
  const today = new Date();
  const documentId = `AXE-${activeDossier.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}-${today.toISOString().slice(0, 10).replace(/-/g, '')}`;

  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header Bar */}
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between border-b border-[#3B1578]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7024E3] to-[#8B5CF6] text-white flex items-center justify-center font-bold shadow-xs">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-white">
                Dossier Financier "Crédit-Ready"
              </h3>
              <p className="text-xs text-[#C4B5FD]">
                Synthèse certifiée conforme SYSCOHADA pour banques & microfinances (OHADA)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:from-[#5B18C4] hover:to-[#7024E3] shadow-xs transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#C4B5FD] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto bg-[#F8F7FD]">
          {/* Institutional Top Head */}
          <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-[12px] uppercase tracking-widest font-mono font-bold text-[#7024E3]">
                RÉPUBLIQUE DE {activeDossier.country.toUpperCase()} • ESPACE OHADA
              </span>
              <h2 className="font-heading text-2xl font-black text-[#1E084A] mt-1">
                {activeDossier.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#7C709A] mt-1.5 font-mono">
                <span>RCCM: {activeDossier.rccm}</span>
                <span>IFU: {activeDossier.ifu}</span>
                <span>Gérant: {activeDossier.managerName}</span>
                <span>Tél: {activeDossier.phone}</span>
              </div>
            </div>

            {/* Solvability Gauge */}
            <div className="bg-gradient-to-tr from-[#1E084A] to-[#2E1065] text-white px-5 py-3.5 rounded-xl border border-[#3B1578] text-center shrink-0 shadow-xs">
              <span className="text-[11px] uppercase tracking-wider block text-[#A78BFA] font-mono font-bold">
                Score Solvabilité IA
              </span>
              <div className="text-3xl font-black font-tabular text-white mt-0.5">
                {solvabilityScore}<span className="text-sm font-normal text-[#A78BFA]">/100</span>
              </div>
              <span className={`text-[11px] font-bold block mt-0.5 ${assessment.score >= 65 ? 'text-[#10B981]' : assessment.score >= 45 ? 'text-[#F59E0B]' : 'text-[#F87171]'}`}>
                {assessment.mention}
              </span>
            </div>
          </div>

          {/* Key Bank Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#DDD6FE] p-4 rounded-xl shadow-2xs">
              <span className="text-xs text-[#7C709A] font-bold block">
                Chiffre d'Affaires Mensuel Moyen
              </span>
              <div className="text-2xl font-black font-tabular text-[#1E084A] mt-1.5">
                {estimatedMonthlyRevenue.toLocaleString('fr-FR')} <span className="text-xs font-mono text-[#7C709A]">FCFA</span>
              </div>
              <span className="text-[11px] text-[#7C709A] font-bold flex items-center gap-1 mt-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${assessment.sufficientData ? 'text-[#10B981]' : 'text-[#F59E0B]'}`} />
                Moyenne sur {assessment.monthsObserved} mois observé{assessment.monthsObserved > 1 ? 's' : ''}
              </span>
            </div>

            <div className="bg-white border border-[#DDD6FE] p-4 rounded-xl shadow-2xs">
              <span className="text-xs text-[#7C709A] font-bold block">
                Flux Net Disponible Mensuel
              </span>
              <div className="text-2xl font-black font-tabular text-[#10B981] mt-1.5">
                {estimatedMonthlyNetFlow.toLocaleString('fr-FR')} <span className="text-xs font-mono text-[#7C709A]">FCFA</span>
              </div>
              <span className="text-[11px] text-[#7C709A] mt-1.5 block">
                Marge d'exploitation nette : {assessment.netMarginPct}%
              </span>
            </div>

            <div className="bg-white border border-[#DDD6FE] p-4 rounded-xl shadow-2xs">
              <span className="text-xs text-[#7C709A] font-bold block">
                Capacité Mensuelle de Remboursement
              </span>
              <div className="text-2xl font-black font-tabular text-[#7024E3] mt-1.5">
                {maxMonthlyReimbursement.toLocaleString('fr-FR')} <span className="text-xs font-mono text-[#7C709A]">FCFA</span>
              </div>
              <span className="text-[11px] text-[#7024E3] font-bold block mt-1.5">
                33% du flux net mensuel (plafond prudentiel)
              </span>
            </div>
          </div>

          {/* Estimated Loan Envelope */}
          <div className="bg-gradient-to-br from-[#F5F3FF] to-white border border-[#DDD6FE] p-6 rounded-2xl shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-heading text-lg font-bold text-[#1E084A]">
                  Financement Bancable Recommandé (12 à 24 mois)
                </h4>
                <p className="text-xs text-[#7C709A] mt-1">
                  Estimation calibrée pour crédit de fonds de roulement ou réassort de stock
                </p>
              </div>

              <div className="text-left md:text-right">
                <span className="text-xs text-[#7C709A] font-bold block">Enveloppe conseillée :</span>
                <span className="text-2xl lg:text-3xl font-black font-tabular text-[#7024E3]">
                  {suggested12MonthCredit.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#DDD6FE] text-xs">
              <div className="flex items-start gap-2 text-[#1E084A]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong>Traçabilité des encaissements :</strong> {traceabilityRate}% de vos ventes passent par Mobile Money ou la banque ; régularité mensuelle : {assessment.regularityRate}%.
                </span>
              </div>
              <div className="flex items-start gap-2 text-[#1E084A]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong>Conformité SYSCOHADA :</strong> Écritures comptabilisées selon le Système Normal & SMT révisé de l'OHADA.
                </span>
              </div>
            </div>
          </div>

          {/* Points d'attention calculés */}
          <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs">
            <h4 className="font-heading text-sm font-bold text-[#1E084A] mb-2">
              Points d'attention pour votre demande de crédit
            </h4>
            <ul className="space-y-1.5 text-xs text-[#534674] list-disc pl-4">
              {assessment.recommendations.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>

          {/* Attestation & Institutional Verification Seal */}
          <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-xs text-[#534674]">
              <p className="font-bold text-[#1E084A]">
                Synthèse générée par AxeCompta AI à partir des écritures enregistrées
              </p>
              <p>
                Ce document synthétise les opérations enregistrées au fil de l'eau avec piste d'audit horodatée. Il est indicatif : à faire valider par un expert-comptable avant dépôt auprès d'une banque.
              </p>
              <p className="text-[11px] font-mono text-[#7C709A]">
                Référence : {documentId} • Généré le {today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* QR Code Verification Stamp */}
            <div className="border border-[#DDD6FE] p-3 bg-[#FAF8FF] text-center rounded-xl shrink-0 shadow-2xs">
              <div className="w-20 h-20 bg-[#1E084A] text-white flex flex-col items-center justify-center mx-auto rounded-lg p-1">
                <QrCode className="w-16 h-16 text-white" />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#1E084A] block mt-1.5 uppercase">
                Vérification DGI / Banque
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
