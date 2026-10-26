import React, { useState } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { SYSCOHADA_ACCOUNTS, accountsForDossier } from '../../data/syscohadaPlan';
import { CurrentUser } from '../../utils/authApi';
import { downloadXlsx, fileSafe } from '../../utils/excelExport';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CheckSquare, 
  Square, 
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
  FilePen
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
  onEntryAction: (action: 'submit' | 'unvalidate' | 'cancel', id: string, reason?: string) => void;
  onUpdateEntry: (updatedEntry: JournalEntry) => void;
  onViewAuditTrail: (entry: JournalEntry) => void;
  onOpenExcelImport?: () => void;
}

export const JournalValidation: React.FC<JournalValidationProps> = ({
  entries,
  activeDossier,
  currentUser,
  onBatchValidate,
  onEntryAction,
  onUpdateEntry,
  onViewAuditTrail,
  onOpenExcelImport
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Edit form state
  const [editDebitCode, setEditDebitCode] = useState('');
  const [editCreditCode, setEditCreditCode] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editAmount, setEditAmount] = useState<number>(0);

  const dossierEntries = entries.filter(e => e.clientDossierId === activeDossier.id);
  const accounts = accountsForDossier(activeDossier.id);
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

  // Filter entries
  const filteredEntries = dossierEntries.filter(entry => {
    const matchesStatus = filterStatus === 'all' ? true : entry.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      entry.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.pieceRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.debitAccount.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.creditAccount.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Select / Deselect All
  const handleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Open edit modal
  const startEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditDebitCode(entry.debitAccountCode);
    setEditCreditCode(entry.creditAccountCode);
    setEditLabel(entry.label);
    setEditAmount(entry.amount);
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const debitAcc = SYSCOHADA_ACCOUNTS.find(a => a.code === editDebitCode);
    const creditAcc = SYSCOHADA_ACCOUNTS.find(a => a.code === editCreditCode);

    const updated: JournalEntry = {
      ...editingEntry,
      label: editLabel,
      amount: editAmount,
      debitAccountCode: editDebitCode,
      debitAccount: debitAcc ? `${debitAcc.code} - ${debitAcc.label}` : editDebitCode,
      creditAccountCode: editCreditCode,
      creditAccount: creditAcc ? `${creditAcc.code} - ${creditAcc.label}` : editCreditCode,
      // Une correction ne valide jamais : l'écriture repasse en attente (sauf brouillon).
      status: editingEntry.status === 'draft' ? 'draft' : 'pending_review',
      detectedAnomaly: undefined,
      auditTrail: [
        ...editingEntry.auditTrail,
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'edited_by_expert',
          author: currentUser.name,
          notes: `Correction d'imputation : Débit ${editDebitCode}, Crédit ${editCreditCode}`
        }
      ]
    };

    onUpdateEntry(updated);
    setEditingEntry(null);
  };

  const exportXlsx = () => {
    downloadXlsx(`Journal_${fileSafe(activeDossier.name)}_${new Date().toISOString().slice(0, 10)}`, [{
      name: 'Journal',
      rows: [
        ['Date', 'Pièce', 'Libellé', 'Compte débit', 'Compte crédit', 'Montant', 'TVA', 'Statut'],
        ...filteredEntries.map(e => [e.date, e.pieceRef, e.label, e.debitAccount, e.creditAccount, e.amount, e.tvaAmount, STATUS_LABEL[e.status]]),
      ],
    }]);
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Date', 'PieceRef', 'Libelle', 'CompteDebit', 'CompteCredit', 'Montant_FCFA', 'Statut', 'ConfianceIA'];
    const rows = filteredEntries.map(e => [
      e.date,
      e.pieceRef,
      `"${e.label.replace(/"/g, '""')}"`,
      e.debitAccountCode,
      e.creditAccountCode,
      e.amount,
      e.status,
      `${e.confidenceScore}%`
    ]);

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
            {dossierEntries.length} écritures enregistrées • Colonnes fixes et imputation en partie double
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Batch Validation Button */}
          {selectedIds.length > 0 && (
            <button
              onClick={() => {
                onBatchValidate(selectedIds);
                setSelectedIds([]);
              }}
              className="px-4 py-2 bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 hover:from-[#059669] hover:to-[#047857] transition-all"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Valider la sélection ({selectedIds.length})</span>
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

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Rechercher libellé, réf, compte..."
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
                  <button onClick={handleSelectAll} className="p-0.5">
                    {selectedIds.length > 0 && selectedIds.length === filteredEntries.length ? (
                      <CheckSquare className="w-4 h-4 text-[#A78BFA]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#7C709A]" />
                    )}
                  </button>
                </th>
                <th className="p-3">Date & Réf</th>
                <th className="p-3">Libellé de l'opération</th>
                <th className="p-3">Débit (SYSCOHADA)</th>
                <th className="p-3">Crédit (SYSCOHADA)</th>
                <th className="p-3 text-right">Montant Débit</th>
                <th className="p-3 text-right">Montant Crédit</th>
                <th className="p-3 text-center">Confiance IA</th>
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
                      <div className="text-[10.5px] text-[#7C709A]">{entry.pieceRef}</div>
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

                    {/* Debit Account */}
                    <td className="p-3 whitespace-nowrap font-mono">
                      <span className="font-bold text-[#7024E3] bg-[#F5F3FF] border border-[#DDD6FE] px-1.5 py-0.5 rounded-md">
                        {entry.debitAccountCode}
                      </span>
                      <span className="text-[11px] text-[#7C709A] block truncate max-w-[140px] mt-0.5">
                        {entry.debitAccount.replace(/^[0-9]+\s*-\s*/, '')}
                      </span>
                    </td>

                    {/* Credit Account */}
                    <td className="p-3 whitespace-nowrap font-mono">
                      <span className="font-bold text-[#10B981] bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded-md">
                        {entry.creditAccountCode}
                      </span>
                      <span className="text-[11px] text-[#7C709A] block truncate max-w-[140px] mt-0.5">
                        {entry.creditAccount.replace(/^[0-9]+\s*-\s*/, '')}
                      </span>
                    </td>

                    {/* Montant Débit */}
                    <td className="p-3 text-right font-tabular font-bold text-[#1E084A] whitespace-nowrap">
                      {entry.amount.toLocaleString('fr-FR')}
                    </td>

                    {/* Montant Crédit */}
                    <td className="p-3 text-right font-tabular font-bold text-[#1E084A] whitespace-nowrap">
                      {entry.amount.toLocaleString('fr-FR')}
                    </td>

                    {/* Confiance IA */}
                    <td className="p-3 text-center font-mono">
                      <span className={`text-[12px] font-bold ${
                        entry.confidenceScore >= 90 
                          ? 'text-[#10B981]' 
                          : entry.confidenceScore >= 75 
                            ? 'text-[#F59E0B]' 
                            : 'text-[#EF4444]'
                      }`}>
                        {entry.confidenceScore}%
                      </span>
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
                        {EDITABLE.includes(entry.status) && !entry.invoiceId && (
                          <button
                            onClick={() => startEdit(entry)}
                            className="p-1.5 text-[#1E084A] hover:bg-[#F5F3FF] rounded-lg transition-colors"
                            title="Modifier l'imputation comptable"
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
                          title="Voir la piste d'audit horodatée"
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
                        {entry.status === 'validated' && !entry.invoiceId && (
                          <button
                            onClick={() => { const r = askReason('la dévalidation'); if (r !== null) onEntryAction('unvalidate', entry.id, r); }}
                            className="p-1.5 text-[#D97706] hover:bg-[#FEF3C7] rounded-lg transition-colors"
                            title="Dévalider"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {entry.status !== 'cancelled' && !entry.invoiceId && (
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

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDD6FE] w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3.5 border-b border-[#EDE9FE] mb-4">
              <h4 className="font-heading text-lg font-bold text-[#1E084A]">
                Modifier l'Écriture SYSCOHADA
              </h4>
              <button onClick={() => setEditingEntry(null)} className="p-1 text-[#7C709A] hover:text-[#1E084A] rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#1E084A] mb-1.5">Libellé d'écriture</label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1E084A] mb-1.5">Montant (FCFA)</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl font-mono text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#7024E3] mb-1.5">Compte Débit (Charge / Trésorerie)</label>
                  <select
                    value={editDebitCode}
                    onChange={(e) => setEditDebitCode(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl font-mono text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                  >
                    {accounts.map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} - {a.label.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#10B981] mb-1.5">Compte Crédit (Produit / Trésorerie)</label>
                  <select
                    value={editCreditCode}
                    onChange={(e) => setEditCreditCode(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl font-mono text-[#1E084A] focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                  >
                    {accounts.map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} - {a.label.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#EDE9FE]">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-4 py-2 border border-[#DDD6FE] rounded-xl font-bold text-[#1E084A] hover:bg-[#F8F7FD] transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold rounded-xl shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3] transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
