import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { EvolutionChart } from '../EvolutionChart';
import { computeFlows, computeReceivables, computeTreasury, periodBounds } from '../../utils/analytics';
import { isTreasuryCode } from '../../utils/paymentAccounts';
import {
  Wallet,
  Smartphone,
  Building,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Receipt,
  Activity,
  Layers,
  Scale
} from 'lucide-react';

interface TreasuryPageProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  onOpenCreditReady: () => void;
  onOpenNewInvoice: () => void;
}

/**
 * Page dédiée Trésorerie & Statistiques.
 * Priorité UX : un seul chiffre clé mis en avant, actions séparées des données,
 * et le détail (graphique / comptes) accessible par onglet plutôt que tout affiché d'un coup.
 */
export const TreasuryPage: React.FC<TreasuryPageProps> = ({
  entries,
  activeDossier,
  onOpenCreditReady,
  onOpenNewInvoice
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'chart' | 'pockets'>('chart');

  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id);

  // Tous les chiffres viennent des écritures réelles : caisse 5711, banque 5211 (chèques et virements),
  // Orange Money 5261, MTN 5262, Wave 5263, Moov 5264.
  const treasury = computeTreasury(dossierEntries);
  const month = periodBounds('month');
  const flows = computeFlows(dossierEntries, month.from, month.to);
  const receivables = computeReceivables(dossierEntries);

  const totalLiquidity = treasury.total;
  const totalIncome = flows.cashIn;
  const totalExpenses = flows.cashOut;
  const netMargin = totalIncome - totalExpenses;

  const monthInflows = dossierEntries.filter(e =>
    e.date >= month.from && isTreasuryCode(e.debitAccountCode) && !isTreasuryCode(e.creditAccountCode)
  );
  const tracedShare = monthInflows.length
    ? Math.round((monthInflows.filter(e => e.paymentMethod !== 'cash').length / monthInflows.length) * 100)
    : 0;

  const alerts: { text: string; type: 'warning' | 'info' | 'success' }[] = [];
  if (dossierEntries.length === 0) {
    alerts.push({
      text: "Aucune opération enregistrée pour l'instant. Dites à l'agent ce que vous avez vendu ou acheté : la trésorerie se met à jour toute seule.",
      type: 'info'
    });
  } else {
    if (totalExpenses > totalIncome) {
      alerts.push({
        text: "Attention : vos dépenses du mois dépassent vos encaissements. Surveillez vos achats de stock.",
        type: 'warning'
      });
    } else if (totalIncome > 0) {
      alerts.push({
        text: `Trésorerie positive : vous dégagez un excédent net de ${netMargin.toLocaleString('fr-FR')} FCFA ce mois.`,
        type: 'success'
      });
    }
    if (monthInflows.length > 0) {
      alerts.push({
        text: `${tracedShare}% de vos encaissements du mois passent par Mobile Money ou la banque${tracedShare >= 40 ? " : cela renforce votre profil pour le micro-crédit." : ". Encaisser davantage hors espèces améliore votre dossier de crédit."}`,
        type: 'info'
      });
    }
    if (receivables.total > 0) {
      alerts.push({ text: `Vos clients vous doivent ${receivables.total.toLocaleString('fr-FR')} FCFA : pensez à les relancer.`, type: 'warning' });
    }
    const negative = [
      ['la caisse', treasury.cash], ['la banque', treasury.bank], ['Orange Money', treasury.orangeMoney],
      ['MTN MoMo', treasury.mtnMomo], ['Wave', treasury.wave], ['Moov Money', treasury.moovMoney]
    ].filter(([, v]) => (v as number) < 0);
    if (negative.length > 0) {
      alerts.push({
        text: `Solde négatif sur ${negative.map(([n]) => n).join(', ')} : il manque sans doute un solde de départ. Dites par exemple à l'agent « j'avais 200 000 F en caisse au départ ».`,
        type: 'warning'
      });
    }
  }

  const pockets = [
    { label: 'Caisse Espèces', code: '5711', tag: 'Espèces', balance: treasury.cash, icon: Wallet, color: '#7024E3', note: 'Billetage et pièces physiques' },
    { label: 'Banque', code: '5211', tag: 'Chèque / virement', balance: treasury.bank, icon: Building, color: '#7024E3', note: 'Virements fournisseurs & chèques' },
    { label: 'Orange Money', code: '5261', tag: 'OM Pro', balance: treasury.orangeMoney, icon: Smartphone, color: '#F97316', note: 'Paiements marchands & factures' },
    { label: 'MTN MoMo', code: '5262', tag: 'MoMo', balance: treasury.mtnMomo, icon: Smartphone, color: '#EAB308', note: 'Paiements et retraits MTN' },
    { label: 'Wave Business', code: '5263', tag: 'Sans frais', balance: treasury.wave, icon: Smartphone, color: '#0EA5E9', note: 'QR Code & virements clients' },
    { label: 'Moov Money', code: '5264', tag: 'Moov', balance: treasury.moovMoney, icon: Smartphone, color: '#2563EB', note: 'Paiements et retraits Moov' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* En-tête de page */}
      <div>
        <span className="text-[12px] uppercase tracking-widest font-bold text-[#7C709A] dark:text-[#A78BFA] font-mono">
          {activeDossier.name}
        </span>
        <h1 className="font-heading text-2xl font-black text-[#7024E3] mt-0.5">
          Trésorerie & Statistiques
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Colonne principale : le chiffre clé, puis le détail par onglet */}
        <div className="lg:col-span-2 space-y-5">
          {/* Chiffre clé unique, mis en avant */}
          <div className="bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#2D1A54] p-6 lg:p-8 rounded-2xl shadow-xs text-center sm:text-left transition-colors">
            <span className="text-xs uppercase tracking-widest font-bold text-[#7C709A] dark:text-[#A78BFA] font-mono">
              Trésorerie totale disponible
            </span>
            <div className="flex items-baseline gap-2 mt-2 justify-center sm:justify-start">
              <span className="text-4xl lg:text-5xl font-black font-tabular text-[#1E084A] dark:text-[#F3EFFF]">
                {totalLiquidity.toLocaleString('fr-FR')}
              </span>
              <span className="text-xl font-black text-[#7024E3] dark:text-[#A78BFA] font-mono">FCFA</span>
            </div>
            <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-2">
              Cumul des disponibilités en Caisse, Mobile Money et Comptes Bancaires
            </p>
          </div>

          {/* 3 indicateurs essentiels du mois */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-[#F0FDF4] dark:bg-[#0E281E] p-4 border border-[#BBF7D0] dark:border-[#134E39] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#166534] dark:text-[#34D399] font-semibold">Entrées du mois</span>
                <TrendingUp className="w-4 h-4 text-[#16A34A] dark:text-[#34D399]" />
              </div>
              <div className="text-xl font-bold font-tabular text-[#166534] dark:text-[#34D399] mt-1.5">
                +{totalIncome.toLocaleString('fr-FR')} <span className="text-xs font-mono">FCFA</span>
              </div>
            </div>

            <div className="bg-[#FFF1F2] dark:bg-[#2B0E1B] p-4 border border-[#FECDD3] dark:border-[#521832] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9F1239] dark:text-[#F43F5E] font-semibold">Dépenses du mois</span>
                <TrendingDown className="w-4 h-4 text-[#E11D48] dark:text-[#F43F5E]" />
              </div>
              <div className="text-xl font-bold font-tabular text-[#9F1239] dark:text-[#F43F5E] mt-1.5">
                -{totalExpenses.toLocaleString('fr-FR')} <span className="text-xs font-mono">FCFA</span>
              </div>
            </div>

            <div className="bg-[#F5F3FF] dark:bg-[#20103E] p-4 border border-[#DDD6FE] dark:border-[#3B2068] rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5B18C4] dark:text-[#C4B5FD] font-semibold">Solde Net</span>
                <Scale className="w-4 h-4 text-[#7024E3] dark:text-[#A78BFA]" />
              </div>
              <div className={`text-xl font-bold font-tabular mt-1.5 ${netMargin >= 0 ? 'text-[#5B18C4] dark:text-[#34D399]' : 'text-[#E11D48] dark:text-[#F43F5E]'}`}>
                {netMargin >= 0 ? '+' : ''}{netMargin.toLocaleString('fr-FR')} <span className="text-xs font-mono">FCFA</span>
              </div>
            </div>
          </div>

          {/* Détail : un seul onglet visible à la fois pour ne pas surcharger */}
          <div className="bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#2D1A54] rounded-2xl shadow-2xs overflow-hidden transition-colors">
            <div className="flex items-center gap-1.5 p-2 border-b border-[#EDE9FE] dark:border-[#2D1A54]">
              <button
                onClick={() => setActiveViewTab('chart')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeViewTab === 'chart'
                    ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs'
                    : 'text-[#534674] dark:text-[#A594C9] hover:bg-[#F5F3FF] dark:hover:bg-[#20103E]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Graphique d'Évolution</span>
              </button>
              <button
                onClick={() => setActiveViewTab('pockets')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeViewTab === 'pockets'
                    ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs'
                    : 'text-[#534674] dark:text-[#A594C9] hover:bg-[#F5F3FF] dark:hover:bg-[#20103E]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Comptes & Portefeuilles</span>
              </button>
            </div>

            <div className="p-4">
              {activeViewTab === 'chart' ? (
                <EvolutionChart entries={entries} activeDossier={activeDossier} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {pockets.map(p => (
                    <div key={p.code} className="border border-[#DDD6FE] dark:border-[#2D1A54] p-4 rounded-xl hover:border-[#7024E3] dark:hover:border-[#8B5CF6] transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                          <p.icon className="w-4 h-4" style={{ color: p.color }} />
                          {p.label} ({p.code})
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 bg-[#F5F3FF] dark:bg-[#20103E] text-[#7024E3] dark:text-[#A78BFA] font-bold rounded">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-lg font-black font-tabular text-[#1E084A] dark:text-[#F3EFFF] mt-2.5">
                        {p.balance.toLocaleString('fr-FR')} <span className="text-xs font-mono text-[#7C709A] dark:text-[#A594C9]">FCFA</span>
                      </p>
                      <span className="text-[11px] text-[#7C709A] dark:text-[#A594C9] mt-0.5 block">{p.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne latérale : actions et lecture rapide, séparées des chiffres */}
        <div className="space-y-4">
          <div className="bg-[#1E084A] dark:bg-[#150A2A] border border-transparent dark:border-[#2D1A54] p-5 rounded-2xl shadow-md space-y-2.5">
            <span className="text-[11px] uppercase tracking-widest font-bold text-[#A78BFA] font-mono block mb-1">
              Actions rapides
            </span>
            <button
              onClick={onOpenCreditReady}
              className="w-full px-3.5 py-2.5 bg-[#2A0E68] dark:bg-[#25104B] text-white hover:bg-[#341764] text-xs font-bold rounded-xl shadow-xs border border-[#3B1578] dark:border-[#4B2382] flex items-center gap-2 transition-all"
            >
              <FileCheck className="w-4 h-4 text-[#A78BFA] shrink-0" />
              <span>Dossier Crédit-Ready (Banque)</span>
            </button>
            <button
              onClick={onOpenNewInvoice}
              className="w-full px-3.5 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white hover:from-[#5B18C4] hover:to-[#7024E3] text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all"
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Émettre Facture / Reçu</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#2D1A54] p-5 rounded-2xl shadow-2xs space-y-3 transition-colors">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#7024E3] dark:text-[#A78BFA]" />
              Alertes en langage clair
            </h4>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    alert.type === 'warning'
                      ? 'bg-[#FFFBEB] dark:bg-[#2B1B06] border-[#FDE68A] dark:border-[#57390B] text-[#92400E] dark:text-[#FBBF24]'
                      : alert.type === 'success'
                      ? 'bg-[#F0FDF4] dark:bg-[#0B2519] border-[#BBF7D0] dark:border-[#14532D] text-[#166534] dark:text-[#34D399]'
                      : 'bg-[#F5F3FF] dark:bg-[#1C0F38] border-[#DDD6FE] dark:border-[#35225E] text-[#1E084A] dark:text-[#E9D5FF]'
                  }`}
                >
                  <span className="font-bold">•</span>
                  <span className="leading-relaxed font-medium">{alert.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
