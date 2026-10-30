import React, { useEffect, useState } from 'react';
import { JournalEntry, ClientDossier, RecurringEntry } from '../../types';
import { JOURNALS, isLocked } from '../../utils/entryLines';
import { CurrentUser } from '../../utils/authApi';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
  MinusSquare,
  Edit3, 
  History, 
  Download, 
  Search, 
  X,
  Check,
  FileSpreadsheet,
  Sparkles,
  Send,
  Undo2,
  Ban,
  FilePen,
  Plus,
  Copy,
  RotateCcw,
  Lock
} from 'lucide-react';

const STATUS_LABEL: Record<JournalEntry['status'], string> = {
  draft: 'Brouillon',
  pending_review: 'En attente',
  anomaly: 'Anomalie',
  validated: 'Validée',
  cancelled: 'Annulée',
};
const EDITABLE: JournalEntry['status'][] = ['draft', 'pending_review', 'anomaly'];

interface JournalValidationProps {
  entries: JournalEntry[];
  activeDossier: ClientDossier;
  currentUser: CurrentUser;
  onBatchValidate: (entryIds: string[]) => void;
  onEntryAction: (action: 'submit' | 'unvalidate' | 'cancel' | 'reverse', id: string, reason?: string) => void;
  /** Ouvre le formulaire d'écriture : modification (avec id) ou nouvelle écriture pré-remplie (sans id). */
  onEditEntry: (entry?: Partial<JournalEntry>) => void;
  /** Recherche globale : remplace la recherche et efface les filtres. */
  search?: { q: string; n: number };
  recurring?: RecurringEntry[];
  onStopRecurring?: (id: string) => void;
  onViewAuditTrail: (entry: JournalEntry) => void;
  onOpenExcelImport?: () => void;
}

export const JournalValidation: React.FC<JournalValidationProps> = ({
  entries,
  activeDossier,
  currentUser,
  onBatchValidate,
  onEntryAction,
  onEditEntry,
  search,
  recurring = [],
  onStopRecurring,
  onViewAuditTrail,
  onOpenExcelImport
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [journalFilter, setJournalFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showRecurring, setShowRecurring] = useState(false);
  useEffect(() => {
    if (!search) return;
    setSearchTerm(search.q); setFilterStatus('all'); setJournalFilter(''); setDateFrom(''); setDateTo('');
  }, [search?.n]);

  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id);
  const locked = (e: JournalEntry) => isLocked(e.date, activeDossier.lockedUntil);
  const reversedIds = new Set(dossierEntries.filter(e => e.reversalOfId && e.status !== 'cancelled').map(e => e.reversalOfId));
  const canReverse = (e: JournalEntry) => e.status === 'validated' && !e.invoiceId && !e.reversalOfId && !reversedIds.has(e.id);
  const canValidateEntry = (e: JournalEntry) => e.status === 'pending_review' || e.status === 'anomaly';
  const askReason = (what: string) => window.prompt(`Motif de ${what} (facultatif) :`, '');

  // Assistant IA du cabinet : résumé du dossier et suggestion de validation en lot
  const [aiSummary, setAiSummary] = useState<{ summary: string; points: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const reliableIds = dossierEntries
    .filter(e => e.status === 'pending_review' && !e.detectedAnomaly)
    .map(e => e.id);

  const loadAiSummary = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch('/api/agent/dossier-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId: activeDossier.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Résumé indisponible');
      setAiSummary({ summary: data.summary, points: data.points ?? [] });
    } catch (e: any) {
      setAiError(e?.message || 'Résumé indisponible');
    } finally {
      setAiLoading(false);
    }
  };

  // Filtres : statut, journal, période, recherche (libellé, pièce, compte, montant)
  const term = searchTerm.trim().toLowerCase();
  const termAmount = Number(term.replace(/[\s.]/g, '').replace(',', '.'));
  const filteredEntries = dossierEntries.filter(entry => {
    if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
    if (journalFilter && entry.journal !== journalFilter) return false;
    if (dateFrom && entry.date < dateFrom) return false;
    if (dateTo && entry.date > dateTo) return false;
    return !term ||
      entry.label.toLowerCase().includes(term) ||
      entry.pieceRef.toLowerCase().includes(term) ||
      entry.lines.some(l => l.accountCode.startsWith(term) || (l.accountLabel ?? '').toLowerCase().includes(term) ||
        (termAmount > 0 && (l.debit === termAmount || l.credit === termAmount)));
  });

  // Sélection : ne compte que les lignes visibles (filtre + recherche) ; chaque bouton n'agit que sur les lignes concernées.
  const selectedEntries = filteredEntries.filter(e => selectedIds.includes(e.id));
  const allSelected = filteredEntries.length > 0 && selectedEntries.length === filteredEntries.length;
  const toValidate = selectedEntries.filter(canValidateEntry).map(e => e.id);
  const toSubmit = selectedEntries.filter(e => e.status === 'draft').map(e => e.id);
  const handleSelectAll = () => setSelectedIds(allSelected ? [] : filteredEntries.map(e => e.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const duplicate = (e: JournalEntry) => onEditEntry({
    journal: e.journal, label: e.label, lines: e.lines.map(({ accountCode, label, debit, credit }) => ({ accountCode, label, debit, credit })),
  });

  const exportXlsx = () => {
    downloadXlsx(`Journal_${fileSafe(activeDossier.name)}_${new Date().toISOString().slice(0, 10)}`, [{
      name: 'Journal',
      rows: [
        ['Date', 'Journal', 'N°', 'Pièce', 'Libellé', 'Compte', 'Intitulé', 'Débit', 'Crédit', 'Statut'],
        ...filteredEntries.flatMap(e => e.lines.map(l => [e.date, e.journal, e.number ?? '', e.pieceRef, l.label ?? e.label, l.accountCode, l.accountLabel ?? '', l.debit || '', l.credit || '', STATUS_LABEL[e.status]])),
      ],
    }]);
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Date', 'Journal', 'Numero', 'PieceRef', 'Libelle', 'Compte', 'Debit', 'Credit', 'Statut'];
    const q = (t: string) => `"${t.replace(/"/g, '""')}"`;
    const rows = filteredEntries.flatMap(e => e.lines.map(l => [
      e.date, e.journal, e.number ?? '', q(e.pieceRef), q(l.label ?? e.label), l.accountCode, l.debit, l.credit, e.status,
    ]));

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Journal_SYSCOHADA_${activeDossier.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-bold text-[#1E084A]">
            Journal Général des Écritures SYSCOHADA
          </h3>
          <p className="text-xs text-[#7C709A]">
            {dossierEntries.length} écritures enregistrées • Partie double, une ou plusieurs lignes par écriture
            {activeDossier.lockedUntil && <span className="ml-1.5 inline-flex items-center gap-1 text-[#B45309] font-bold"><Lock className="w-3 h-3" /> bloquée jusqu'au {activeDossier.lockedUntil.split('-').reverse().join('/')}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Actions sur la sélection */}
          {selectedEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl px-2.5 py-1.5">
              <span className="text-xs font-bold text-[#1E084A]">{selectedEntries.length} sélectionnée{selectedEntries.length > 1 ? 's' : ''}</span>
              {toSubmit.length > 0 && (
                <button
                  onClick={() => { toSubmit.forEach(id => onEntryAction('submit', id)); setSelectedIds([]); }}
                  className="px-3 py-1.5 bg-white text-[#7024E3] text-xs font-bold rounded-lg border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Soumettre les brouillons ({toSubmit.length})</span>
                </button>
              )}
              {toValidate.length > 0 && (
                <button
                  onClick={() => { onBatchValidate(toValidate); setSelectedIds([]); }}
                  className="px-3 py-1.5 bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 hover:from-[#059669] hover:to-[#047857]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valider ({toValidate.length})</span>
                </button>
              )}
              {toSubmit.length === 0 && toValidate.length === 0 && (
                <span className="text-[11px] text-[#7C709A]">Aucune action : écritures déjà validées ou annulées</span>
              )}
              <button onClick={() => setSelectedIds([])} className="text-[11px] font-bold text-[#7C709A] hover:text-[#1E084A] underline">
                Désélectionner
              </button>
            </div>
          )}

          <button
            onClick={() => onEditEntry()}
            className="px-3.5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle écriture</span>
          </button>

          {recurring.length > 0 && (
            <button onClick={() => setShowRecurring(v => !v)}
              className="px-3.5 py-2 bg-[#F8F7FD] text-[#1E084A] text-xs font-bold rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-[#7024E3]" /> Récurrentes ({recurring.length})
            </button>
          )}

          {/* Import Excel */}
          {onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="px-3.5 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Importer Excel (.xlsx)</span>
            </button>
          )}

          {/* Export */}
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 bg-[#F8F7FD] text-[#1E084A] text-xs font-bold rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#7024E3]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportXlsx}
            className="px-3.5 py-2 bg-[#F8F7FD] text-[#1E084A] text-xs font-bold rounded-xl border border-[#DDD6FE] hover:bg-[#EDE9FE] flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {showRecurring && recurring.length > 0 && (
        <div className="bg-white border border-[#DDD6FE] p-4 rounded-xl shadow-2xs text-xs">
          <h4 className="font-bold text-[#1E084A] mb-2">Écritures répétées chaque mois</h4>
          <ul className="divide-y divide-[#EDE9FE]">
            {recurring.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <b>{r.label}</b> <span className="text-[#7C709A]">• {r.journal} • le {r.day} du mois • prochaine le {r.nextDate.split('-').reverse().join('/')} •
                  {' '}{r.lines.reduce((s, l) => s + l.debit, 0).toLocaleString('fr-FR')} FCFA</span>
                </span>
                {onStopRecurring && (
                  <button onClick={() => window.confirm(`Arrêter « ${r.label} » ? Les écritures déjà passées restent.`) && onStopRecurring(r.id)}
                    className="px-2.5 py-1 border border-[#FECACA] text-[#DC2626] font-bold rounded-lg">Arrêter</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assistant IA du cabinet */}
      <div className="bg-[#F5F3FF] border border-[#DDD6FE] p-4 rounded-xl shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#1E084A] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#7024E3]" />
            Assistant IA du cabinet
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadAiSummary}
              disabled={aiLoading}
              className="px-3 py-1.5 bg-white text-[#1E084A] text-xs font-bold rounded-lg border border-[#DDD6FE] hover:bg-[#EDE9FE] disabled:opacity-50"
            >
              {aiLoading ? 'Analyse en cours…' : 'Résumé IA du dossier'}
            </button>
            <button
              onClick={() => reliableIds.length && onBatchValidate(reliableIds)}
              disabled={reliableIds.length === 0}
              title="Écritures en attente, sans anomalie"
              className="px-3 py-1.5 bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-xs font-bold rounded-lg shadow-2xs disabled:opacity-40"
            >
              Valider les écritures fiables ({reliableIds.length})
            </button>
          </div>
        </div>
        {aiError && <p className="text-xs text-[#B91C1C]">{aiError}</p>}
        {aiSummary && (
          <div className="text-xs text-[#534674] space-y-1.5">
            <p>{aiSummary.summary}</p>
            {aiSummary.points.length > 0 ? (
              <ul className="list-disc pl-4 space-y-0.5">
                {aiSummary.points.map(p => <li key={p}>{p}</li>)}
              </ul>
            ) : (
              <p className="text-[#166534] font-semibold">Aucun point d'attention détecté.</p>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#DDD6FE] p-3.5 rounded-xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Buttons */}
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
              filterStatus === 'all' 
                ? 'bg-[#1E084A] text-white shadow-2xs' 
                : 'bg-[#F8F7FD] text-[#7C709A] hover:bg-[#EDE9FE]'
            }`}
          >
            Tous ({dossierEntries.length})
          </button>
          <button
            onClick={() => setFilterStatus('draft')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              filterStatus === 'draft' ? 'bg-[#64748B] text-white shadow-2xs' : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
            }`}
          >
            <FilePen className="w-3.5 h-3.5" />
            <span>Brouillons ({dossierEntries.filter(e => e.status === 'draft').length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('pending_review')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              filterStatus === 'pending_review' 
                ? 'bg-[#F59E0B] text-white shadow-2xs' 
                : 'bg-[#FEF3C7] text-[#D97706] hover:bg-[#FDE68A]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>À valider ({dossierEntries.filter(e => e.status === 'pending_review').length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('anomaly')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              filterStatus === 'anomaly' 
                ? 'bg-[#EF4444] text-white shadow-2xs' 
                : 'bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Anomalies ({dossierEntries.filter(e => e.status === 'anomaly').length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('validated')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              filterStatus === 'validated' 
                ? 'bg-[#10B981] text-white shadow-2xs' 
                : 'bg-[#D1FAE5] text-[#059669] hover:bg-[#A7F3D0]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Validés ({dossierEntries.filter(e => e.status === 'validated').length})</span>
          </button>
          <button
            onClick={() => setFilterStatus('cancelled')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all ${
              filterStatus === 'cancelled' ? 'bg-[#475569] text-white shadow-2xs' : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Annulées ({dossierEntries.filter(e => e.status === 'cancelled').length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={journalFilter} onChange={e => setJournalFilter(e.target.value)} title="Journal"
            className="text-xs p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A]">
            <option value="">Tous les journaux</option>
            {JOURNALS.map(j => <option key={j.code} value={j.code}>{j.code} — {j.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du"
            className="text-xs p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A]" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au"
            className="text-xs p-2 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A]" />
          {(journalFilter || dateFrom || dateTo) && (
            <button onClick={() => { setJournalFilter(''); setDateFrom(''); setDateTo(''); }} className="text-[11px] font-bold text-[#7C709A] underline">Effacer</button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Libellé, pièce, compte, montant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs p-2 pl-8 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30 text-[#1E084A]"
          />
          <Search className="w-3.5 h-3.5 text-[#7C709A] absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Dense Table Layout */}
      <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1E084A] text-white border-b border-[#3B1578] uppercase font-mono text-[11px]">
                <th className="p-3 text-center w-8">
                  <button onClick={handleSelectAll} className="p-0.5" title={allSelected ? 'Tout désélectionner' : 'Tout sélectionner (lignes affichées)'}>
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#A78BFA]" />
                    ) : selectedEntries.length > 0 ? (
                      <MinusSquare className="w-4 h-4 text-[#A78BFA]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#7C709A]" />
                    )}
                  </button>
                </th>
                <th className="p-3">Date & Pièce</th>
                <th className="p-3">Libellé de l'opération</th>
                <th className="p-3">Débit</th>
                <th className="p-3">Crédit</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3 text-center">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9FE] font-sans">
              {filteredEntries.map(entry => {
                const isSelected = selectedIds.includes(entry.id);

                return (
                  <tr 
                    key={entry.id}
                    className={`hover:bg-[#F5F3FF] transition-colors ${
                      isSelected ? 'bg-[#FAF8FF]' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <button onClick={() => toggleSelectOne(entry.id)} className="p-0.5">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#7024E3]" />
                        ) : (
                          <Square className="w-4 h-4 text-[#C4B5FD]" />
                        )}
                      </button>
                    </td>

                    {/* Date & Ref */}
                    <td className="p-3 whitespace-nowrap font-mono text-[12px]">
                      <div className="font-bold text-[#1E084A]">{entry.date}</div>
                      <div className="text-[10.5px] text-[#7C709A]">{entry.journal}{entry.number ? ` n° ${entry.number}` : ''} • {entry.pieceRef}{entry.attachments?.length ? ` • 📎 ${entry.attachments.length}` : ''}</div>
                    </td>

                    {/* Label */}
                    <td className="p-3 max-w-[220px]">
                      <div className="font-semibold text-[#1E084A] leading-tight line-clamp-2">
                        {entry.label}
                      </div>
                      {entry.detectedAnomaly && (
                        <div className="text-[11px] text-[#DC2626] bg-[#FEE2E2] p-1.5 rounded-lg mt-1 border border-[#FECACA] flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-[#DC2626]" />
                          <span>{entry.detectedAnomaly}</span>
                        </div>
                      )}
                    </td>

                    {/* Lignes au débit puis au crédit */}
                    {(['debit', 'credit'] as const).map(side => (
                      <td key={side} className="p-3 whitespace-nowrap font-mono align-top">
                        {entry.lines.filter(l => l[side] > 0).map((l, i) => (
                          <div key={i} className="mb-1 last:mb-0" title={l.accountLabel}>
                            <span className={`font-bold px-1.5 py-0.5 rounded-md border ${side === 'debit' ? 'text-[#7024E3] bg-[#F5F3FF] border-[#DDD6FE]' : 'text-[#10B981] bg-[#F0FDF4] border-[#BBF7D0]'}`}>
                              {l.accountCode}
                            </span>
                            <span className="ml-1.5 text-[11px] text-[#534674]">{l[side].toLocaleString('fr-FR')}</span>
                            <span className="text-[10.5px] text-[#7C709A] block truncate max-w-[160px]">{l.accountLabel}</span>
                          </div>
                        ))}
                      </td>
                    ))}

                    <td className="p-3 text-right font-tabular font-bold text-[#1E084A] whitespace-nowrap">
                      {entry.amount.toLocaleString('fr-FR')}
                    </td>

                    {/* Statut */}
                    <td className="p-3 text-center whitespace-nowrap">
                      {entry.status === 'validated' && (
                        <span className="px-2.5 py-0.5 bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] text-[11px] font-bold rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#16A34A]" /> Validé
                        </span>
                      )}
                      {entry.status === 'pending_review' && (
                        <span className="px-2.5 py-0.5 bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] text-[11px] font-bold rounded-full inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#D97706]" /> À valider
                        </span>
                      )}
                      {entry.status === 'anomaly' && (
                        <span className="px-2.5 py-0.5 bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA] text-[11px] font-bold rounded-full inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#DC2626]" /> Anomalie
                        </span>
                      )}
                      {entry.status === 'draft' && (
                        <span className="px-2.5 py-0.5 bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] text-[11px] font-bold rounded-full inline-flex items-center gap-1">
                          <FilePen className="w-3 h-3" /> Brouillon
                        </span>
                      )}
                      {entry.status === 'cancelled' && (
                        <span className="px-2.5 py-0.5 bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] text-[11px] font-bold rounded-full inline-flex items-center gap-1 line-through">
                          <Ban className="w-3 h-3" /> Annulée
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {locked(entry) && (
                          <span className="p-1.5 text-[#B45309]" title="Période bloquée : corrigez par contre-passation"><Lock className="w-3.5 h-3.5" /></span>
                        )}
                        {EDITABLE.includes(entry.status) && !entry.invoiceId && !locked(entry) && (
                          <button
                            onClick={() => onEditEntry(entry)}
                            className="p-1.5 text-[#1E084A] hover:bg-[#F5F3FF] rounded-lg transition-colors"
                            title="Modifier l'écriture"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {entry.status === 'draft' && (
                          <button
                            onClick={() => onEntryAction('submit', entry.id)}
                            className="p-1.5 text-[#7024E3] hover:bg-[#F5F3FF] rounded-lg transition-colors"
                            title="Soumettre à validation"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => onViewAuditTrail(entry)}
                          className="p-1.5 text-[#1E084A] hover:bg-[#F5F3FF] rounded-lg transition-colors"
                          title="Détail, pièces justificatives et piste d'audit"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {canValidateEntry(entry) && (
                          <button
                            onClick={() => onBatchValidate([entry.id])}
                            className="p-1.5 text-[#10B981] hover:bg-[#F0FDF4] rounded-lg transition-colors"
                            title="Validation définitive"
                          >
                            <Check className="w-4 h-4 font-bold" />
                          </button>
                        )}
                        {!entry.invoiceId && (
                          <button onClick={() => duplicate(entry)} className="p-1.5 text-[#1E084A] hover:bg-[#F5F3FF] rounded-lg transition-colors" title="Dupliquer (nouvelle écriture pré-remplie)">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canReverse(entry) && (
                          <button
                            onClick={() => { const r = askReason('la contre-passation (datée d’aujourd’hui)'); if (r !== null) onEntryAction('reverse', entry.id, r); }}
                            className="p-1.5 text-[#7024E3] hover:bg-[#F5F3FF] rounded-lg transition-colors"
                            title="Contre-passer : écriture inverse datée d'aujourd'hui"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {entry.status === 'validated' && !entry.invoiceId && !locked(entry) && (
                          <button
                            onClick={() => { const r = askReason('la dévalidation'); if (r !== null) onEntryAction('unvalidate', entry.id, r); }}
                            className="p-1.5 text-[#D97706] hover:bg-[#FEF3C7] rounded-lg transition-colors"
                            title="Dévalider"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {entry.status !== 'cancelled' && !entry.invoiceId && !locked(entry) && (
                          <button
                            onClick={() => { const r = askReason("l'annulation"); if (r !== null) onEntryAction('cancel', entry.id, r); }}
                            className="p-1.5 text-[#DC2626] hover:bg-[#FEE2E2] rounded-lg transition-colors"
                            title="Annuler l'écriture"
                          >
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

    </div>
  );
};
