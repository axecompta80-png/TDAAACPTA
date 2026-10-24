import React, { useState } from 'react';
import { ClientDossier, JournalEntry } from '../../types';
import {
  Building2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Filter
} from 'lucide-react';

interface MultiClientPortfolioProps {
  dossiers: ClientDossier[];
  activeDossier: ClientDossier;
  entries: JournalEntry[];
  onSelectDossier: (dossier: ClientDossier) => void;
  onUpdateConfidenceThreshold: (dossierId: string, newThreshold: number) => void;
  /** Vue administrateur : regroupement du portefeuille par utilisateur propriétaire. */
  groupByOwner?: boolean;
}

interface DossierStat {
  dossier: ClientDossier;
  owner: string;
  pending: number;
  anomalies: number;
  validated: number;
  totalTurnover: number;
  totalEntries: number;
}

export const MultiClientPortfolio: React.FC<MultiClientPortfolioProps> = ({
  dossiers,
  activeDossier,
  entries,
  onSelectDossier,
  onUpdateConfidenceThreshold,
  groupByOwner = false
}) => {
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [editingThresholdDossierId, setEditingThresholdDossierId] = useState<string | null>(null);

  const countries = Array.from(new Set(dossiers.map(d => d.country)));

  // Un dossier appartient toujours à un propriétaire : le libellé est utilisé pour le regroupement cabinet.
  const dossierStats: DossierStat[] = dossiers.map(dossier => {
    const dEntries = entries.filter(e => e.clientDossierId === dossier.id);
    const pending = dEntries.filter(e => e.status === 'pending_review').length;
    const anomalies = dEntries.filter(e => e.status === 'anomaly').length;
    const validated = dEntries.filter(e => e.status === 'validated').length;
    const totalTurnover = dEntries
      .filter(e => e.creditAccountCode.startsWith('7') || e.label.toLowerCase().includes('vente'))
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      dossier,
      owner: (dossier.ownerName && dossier.ownerName.trim()) || 'Sans propriétaire',
      pending,
      anomalies,
      validated,
      totalTurnover,
      totalEntries: dEntries.length
    };
  });

  // Dossiers à traiter en premier : les anomalies pèsent plus que les écritures en attente.
  const priorityOf = (s: DossierStat) => s.anomalies * 5 + s.pending * 2;
  const filteredStats = (filterCountry === 'all'
    ? dossierStats
    : dossierStats.filter(s => s.dossier.country === filterCountry)
  ).slice().sort((a, b) => priorityOf(b) - priorityOf(a));

  // Regroupement par propriétaire (vue administrateur) ou liste plate (vue comptable).
  const groupedByOwner = (() => {
    if (!groupByOwner) return null;
    const map = new Map<string, DossierStat[]>();
    for (const s of filteredStats) {
      if (!map.has(s.owner)) map.set(s.owner, []);
      map.get(s.owner)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const totalPendingAll = dossierStats.reduce((sum, s) => sum + s.pending, 0);
  const totalAnomaliesAll = dossierStats.reduce((sum, s) => sum + s.anomalies, 0);
  const totalValidatedAll = dossierStats.reduce((sum, s) => sum + s.validated, 0);
  const ownersCount = new Set(dossierStats.map(s => s.owner)).size;

  const renderRow = (s: DossierStat) => {
    const { dossier, pending, anomalies, totalTurnover, owner } = s;
    const isActive = dossier.id === activeDossier.id;
    return (
      <tr
        key={dossier.id}
        className={`hover:bg-[#F5F3FF] transition-colors ${isActive ? 'bg-[#FAF8FF] font-medium' : ''}`}
      >
        <td className="p-3.5">
          <div className="font-bold text-[#1E084A] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#7024E3] shrink-0" />
            <span>{dossier.name}</span>
            {isActive && (
              <span className="px-2 py-0.5 bg-[#7024E3] text-white text-[10.5px] font-bold rounded-full">Actif</span>
            )}
          </div>
          <div className="text-[11px] text-[#7C709A] font-mono mt-0.5">RCCM : {dossier.rccm}</div>
        </td>
        {groupByOwner && (
          <td className="p-3.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#7024E3]">
              <Users className="w-3 h-3" />
              {owner}
            </span>
          </td>
        )}
        <td className="p-3.5 max-w-[200px]">
          <div className="text-[#1E084A] truncate">{dossier.activity}</div>
          <div className="text-[11px] text-[#7C709A] font-mono">{dossier.city}, {dossier.country}</div>
        </td>
        <td className="p-3.5">
          <span className="px-2.5 py-0.5 bg-[#F5F3FF] text-[#7024E3] border border-[#DDD6FE] text-[11px] font-bold rounded-lg">
            {dossier.regimeFiscal}
          </span>
        </td>
        <td className="p-3.5 text-right font-tabular font-black text-[#10B981]">
          {totalTurnover > 0 ? totalTurnover.toLocaleString('fr-FR') : '—'} F
        </td>
        <td className="p-3.5 text-center">
          {pending > 0 ? (
            <span className="px-2 py-0.5 bg-[#F59E0B] text-[#1E084A] font-mono font-bold text-[12px] rounded-full">{pending}</span>
          ) : (
            <span className="text-[#7C709A] font-mono">0</span>
          )}
        </td>
        <td className="p-3.5 text-center">
          {anomalies > 0 ? (
            <span className="px-2 py-0.5 bg-[#EF4444] text-white font-mono font-bold text-[12px] rounded-full">{anomalies}</span>
          ) : (
            <span className="text-[#7C709A] font-mono">0</span>
          )}
        </td>
        <td className="p-3.5 text-center">
          {editingThresholdDossierId === dossier.id ? (
            <div className="flex items-center justify-center gap-1">
              <input
                type="number"
                min="50"
                max="99"
                defaultValue={dossier.confidenceThreshold}
                onBlur={(e) => {
                  onUpdateConfidenceThreshold(dossier.id, parseInt(e.target.value) || 85);
                  setEditingThresholdDossierId(null);
                }}
                className="w-12 text-center p-1 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg text-xs font-mono font-bold text-[#1E084A]"
                autoFocus
              />
              <span className="text-[11px] font-mono text-[#7C709A]">%</span>
            </div>
          ) : (
            <button
              onClick={() => setEditingThresholdDossierId(dossier.id)}
              className="px-2.5 py-0.5 bg-[#F8F7FD] hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg font-mono text-[12px] font-bold text-[#1E084A] inline-flex items-center gap-1.5 transition-colors"
              title="Cliquer pour ajuster le seuil d'auto-validation"
            >
              <Sliders className="w-2.5 h-2.5 text-[#7024E3]" />
              <span>≥ {dossier.confidenceThreshold}%</span>
            </button>
          )}
        </td>
        <td className="p-3.5 text-right">
          <button
            onClick={() => onSelectDossier(dossier)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1 ml-auto transition-all ${
              isActive
                ? 'bg-[#10B981] text-white shadow-2xs'
                : 'bg-[#F8F7FD] text-[#1E084A] border border-[#DDD6FE] hover:bg-[#7024E3] hover:text-white shadow-2xs'
            }`}
          >
            <span>{isActive ? 'En cours' : 'Ouvrir'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  const columnCount = groupByOwner ? 9 : 8;

  return (
    <div className="space-y-5">
      {/* Cabinet Overview Banner */}
      <div className="bg-[#1E084A] text-white p-6 rounded-2xl border border-[#3B1578] shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#A78BFA] font-bold block">
              {groupByOwner ? 'Espace Supervision Administrateur • Tous les dossiers' : 'Mes entreprises • Vos dossiers'}
            </span>
            <h2 className="font-heading text-2xl font-black text-white mt-1">
              Portefeuille Multi-Clients OHADA
            </h2>
            <p className="text-xs text-[#C4B5FD] mt-1">
              {groupByOwner
                ? 'Supervisez les dossiers de tous les utilisateurs, classés par propriétaire.'
                : 'Supervisez les écritures pré-catégorisées par l\'agent IA et validez les flux incertains.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {groupByOwner && (
              <div className="px-3.5 py-2 bg-[#2A0E68] border border-[#3B1578] rounded-xl text-center">
                <span className="text-[11px] text-[#C4B5FD] uppercase block font-medium">Propriétaires</span>
                <span className="text-lg font-black font-tabular text-white">{ownersCount}</span>
              </div>
            )}
            <div className="px-3.5 py-2 bg-[#2A0E68] border border-[#3B1578] rounded-xl text-center">
              <span className="text-[11px] text-[#C4B5FD] uppercase block font-medium">Dossiers</span>
              <span className="text-lg font-black font-tabular text-white">{dossiers.length}</span>
            </div>
            <div className="px-3.5 py-2 bg-[#F59E0B]/20 border border-[#F59E0B]/40 rounded-xl text-center">
              <span className="text-[11px] text-[#FDE68A] uppercase block font-bold">À Valider</span>
              <span className="text-lg font-black font-tabular text-[#FDE68A]">{totalPendingAll}</span>
            </div>
            <div className="px-3.5 py-2 bg-[#EF4444]/20 border border-[#EF4444]/40 rounded-xl text-center">
              <span className="text-[11px] text-[#FCA5A5] uppercase block font-bold">Anomalies</span>
              <span className="text-lg font-black font-tabular text-[#FCA5A5]">{totalAnomaliesAll}</span>
            </div>
            <div className="px-3.5 py-2 bg-[#10B981]/20 border border-[#10B981]/40 rounded-xl text-center">
              <span className="text-[11px] text-[#A7F3D0] uppercase block font-bold">Auto-Validées</span>
              <span className="text-lg font-black font-tabular text-[#A7F3D0]">{totalValidatedAll}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DDD6FE] shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#7024E3]" />
            <span className="text-xs font-bold text-[#1E084A]">Filtrer par pays :</span>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="text-xs p-1.5 px-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-lg font-semibold text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
            >
              <option value="all">Tous les pays ({dossiers.length})</option>
              {countries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <span className="text-xs text-[#7C709A] font-mono">
          Règle : Les flux avec score ≥ seuil sont auto-imputés sans validation manuelle.
        </span>
      </div>

      {/* Client Dossier Table */}
      <div className="bg-white border border-[#DDD6FE] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1E084A] text-white border-b border-[#3B1578] uppercase font-mono text-[11px]">
                <th className="p-3.5">Entreprise / RCCM</th>
                {groupByOwner && <th className="p-3.5">Propriétaire</th>}
                <th className="p-3.5">Activité & Ville</th>
                <th className="p-3.5">Régime Fiscal</th>
                <th className="p-3.5 text-right">CA Période (FCFA)</th>
                <th className="p-3.5 text-center">À Valider</th>
                <th className="p-3.5 text-center">Anomalies</th>
                <th className="p-3.5 text-center">Seuil Auto-IA</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9FE]">
              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="p-6 text-center text-[#7C709A]">
                    Aucun dossier à afficher. Créez votre premier dossier depuis les paramètres.
                  </td>
                </tr>
              )}
              {groupedByOwner
                ? groupedByOwner.map(([owner, list]) => (
                    <React.Fragment key={owner}>
                      <tr className="bg-[#F5F3FF]">
                        <td colSpan={columnCount} className="p-2.5 px-3.5">
                          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#7024E3]">
                            <Users className="w-3.5 h-3.5" />
                            Propriétaire : {owner}
                            <span className="px-1.5 py-0.5 bg-white border border-[#DDD6FE] rounded font-mono text-[10px]">{list.length}</span>
                          </span>
                        </td>
                      </tr>
                      {list.map(renderRow)}
                    </React.Fragment>
                  ))
                : filteredStats.map(renderRow)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
