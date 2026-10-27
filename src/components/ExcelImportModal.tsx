import React, { useState, useRef } from 'react';
import { JournalEntry, ClientDossier, PaymentMethod, TransactionStatus } from '../types';
import { SYSCOHADA_ACCOUNTS } from '../data/syscohadaPlan';
import { 
  parseExcelBuffer, 
  parseCellAmount,
  parseCellDate,
  detectColumns, 
  classifyTransactionSmart, 
  generateSampleExcelTemplate,
  ColumnMapping, 
  ParsedRowPreview 
} from '../utils/excelParser';
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Sliders, 
  X, 
  Sparkles,
  ArrowRight,
  RotateCcw,
  Layers,
  Scale
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDossier: ClientDossier;
  dossiers: ClientDossier[];
  onImportEntries: (newEntries: JournalEntry[], targetDossierId: string) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  activeDossier,
  dossiers,
  onImportEntries
}) => {
  const [targetDossierId, setTargetDossierId] = useState(activeDossier.id);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [allRowsBySheet, setAllRowsBySheet] = useState<Record<string, any[]>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateCol: '',
    labelCol: '',
    amountCol: ''
  });
  const [parsedRows, setParsedRows] = useState<ParsedRowPreview[]>([]);
  const [importAsValidated, setImportAsValidated] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file upload
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' Ko');

    try {
      const buffer = await file.arrayBuffer();
      const { sheetNames, rowsBySheet } = parseExcelBuffer(buffer, file.name);

      if (sheetNames.length === 0 || !rowsBySheet[sheetNames[0]] || rowsBySheet[sheetNames[0]].length === 0) {
        alert("Le fichier Excel est vide ou ne contient aucune ligne exploitable.");
        setIsProcessing(false);
        return;
      }

      setAvailableSheets(sheetNames);
      const firstSheet = sheetNames[0];
      setSelectedSheet(firstSheet);
      setAllRowsBySheet(rowsBySheet);

      const firstRow = rowsBySheet[firstSheet][0];
      const detectedHeaders = Object.keys(firstRow);
      setHeaders(detectedHeaders);

      const initialMapping = detectColumns(detectedHeaders);
      setColumnMapping(initialMapping);

      // Generate preview rows
      buildPreview(rowsBySheet[firstSheet], initialMapping);
      setStep('preview');
    } catch (err) {
      console.error("Erreur lors de la lecture du fichier Excel:", err);
      alert("Impossible de lire ce document Excel. Vérifiez que le fichier est valide (.xlsx, .xls ou .csv).");
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert raw rows into ParsedRowPreview with auto-SYSCOHADA classification
  const buildPreview = (rawRows: any[], mapping: ColumnMapping) => {
    const previews: ParsedRowPreview[] = [];
    const cell = (row: any, col?: string) => (col ? String(row[col] ?? '').trim() : '');
    const amountOf = (row: any, col?: string) => (col ? parseCellAmount(row[col]) ?? 0 : 0);
    // Colonne montant signée (au moins un négatif) : positif = recette, négatif = dépense.
    // Sans négatif, le sens vient du libellé (un journal d'achats n'a que des montants positifs).
    const signed = !!mapping.amountCol && rawRows.some(r => amountOf(r, mapping.amountCol) < 0);

    rawRows.forEach((row, idx) => {
      const labelVal = cell(row, mapping.labelCol).slice(0, 300);

      let amount = 0;
      let isCreditMovement = false;
      const credit = Math.abs(amountOf(row, mapping.creditCol));
      const debit = Math.abs(amountOf(row, mapping.debitCol));
      if (credit > 0) {
        amount = credit;
        isCreditMovement = true;
      } else if (debit > 0) {
        amount = debit;
      } else {
        const signedAmount = amountOf(row, mapping.amountCol);
        amount = Math.abs(signedAmount);
        isCreditMovement = signed && signedAmount > 0;
      }
      amount = Math.round(amount * 100) / 100;
      if (!labelVal && amount === 0) return; // ligne vide, de séparation ou de sous-total

      const date = parseCellDate(row[mapping.dateCol]);
      const tvaAmount = Math.round(Math.abs(amountOf(row, mapping.tvaCol)) * 100) / 100;
      const pieceRef = (cell(row, mapping.pieceRefCol) || `IMP-XL-${String(idx + 1).padStart(3, '0')}`).slice(0, 80);

      const classification = classifyTransactionSmart(
        labelVal,
        amount,
        isCreditMovement,
        cell(row, mapping.debitAccountCol) || undefined,
        cell(row, mapping.creditAccountCol) || undefined,
        cell(row, mapping.paymentMethodCol) || undefined
      );

      // Ligne non importable telle quelle : signalée et décochée plutôt que devinée.
      const blocking = !date ? `Date illisible (« ${cell(row, mapping.dateCol) || 'vide'} ») : ligne ignorée`
        : amount === 0 ? 'Montant absent ou nul : ligne ignorée'
        : !labelVal ? 'Libellé vide : ligne ignorée'
        : tvaAmount > amount ? 'TVA supérieure au montant : ligne ignorée'
        : undefined;

      previews.push({
        id: `preview-${idx}-${Date.now()}`,
        rowIndex: idx + 1,
        selected: !blocking,
        date: date ?? '',
        pieceRef,
        label: labelVal || '(sans libellé)',
        amount,
        debitAccountCode: classification.debitCode,
        debitAccountLabel: classification.debitLabel,
        creditAccountCode: classification.creditCode,
        creditAccountLabel: classification.creditLabel,
        paymentMethod: classification.paymentMethod,
        tvaAmount,
        confidenceScore: classification.confidence,
        anomaly: blocking ?? classification.anomaly,
        originalRaw: row
      });
    });

    setParsedRows(previews);
  };

  // Switch sheet
  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    const rows = allRowsBySheet[sheetName] || [];
    if (rows.length > 0) {
      const newHeaders = Object.keys(rows[0]);
      setHeaders(newHeaders);
      const newMapping = detectColumns(newHeaders);
      setColumnMapping(newMapping);
      buildPreview(rows, newMapping);
    }
  };

  // Update mapping manually
  const updateMappingField = (field: keyof ColumnMapping, val: string) => {
    const updated = { ...columnMapping, [field]: val };
    setColumnMapping(updated);
    if (selectedSheet && allRowsBySheet[selectedSheet]) {
      buildPreview(allRowsBySheet[selectedSheet], updated);
    }
  };

  // Toggle selection
  const importable = (r: ParsedRowPreview) => !!r.date && r.amount > 0 && r.tvaAmount <= r.amount && r.label !== '(sans libellé)';

  const toggleRowSelect = (id: string) => {
    setParsedRows(prev => prev.map(r => r.id === id && importable(r) ? { ...r, selected: !r.selected } : r));
  };

  const toggleSelectAll = () => {
    const allSelected = parsedRows.filter(importable).every(r => r.selected);
    setParsedRows(prev => prev.map(r => ({ ...r, selected: !allSelected && importable(r) })));
  };

  // Update row account directly in preview
  const updateRowAccount = (rowId: string, side: 'debit' | 'credit', code: string) => {
    const acc = SYSCOHADA_ACCOUNTS.find(a => a.code === code);
    setParsedRows(prev => prev.map(r => {
      if (r.id === rowId) {
        if (side === 'debit') {
          return {
            ...r,
            debitAccountCode: code,
            debitAccountLabel: acc ? acc.label : `Compte ${code}`
          };
        } else {
          return {
            ...r,
            creditAccountCode: code,
            creditAccountLabel: acc ? acc.label : `Compte ${code}`
          };
        }
      }
      return r;
    }));
  };

  // Download template
  const handleDownloadTemplate = (type: 'journal_syscohada' | 'releve_bancaire_mobile') => {
    const bytes = generateSampleExcelTemplate(type);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'journal_syscohada' ? 'Modele_Journal_SYSCOHADA.xlsx' : 'Modele_Releve_Transactions.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Final confirmation: Convert selected previews to JournalEntry[]
  const handleFinalImport = () => {
    const selectedRows = parsedRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      alert("Veuillez sélectionner au moins une ligne à importer.");
      return;
    }

    const newEntries: JournalEntry[] = selectedRows.map((r, i) => {
      // Un import arrive soumis ou en brouillon ; le serveur valide d'office les lignes sûres.
      const status: TransactionStatus = importAsValidated ? 'pending_review' : 'draft';
      return {
        id: `entry-imp-${Date.now()}-${i}`,
        date: r.date,
        label: r.label,
        pieceRef: r.pieceRef,
        debitAccount: `${r.debitAccountCode} - ${r.debitAccountLabel}`,
        debitAccountCode: r.debitAccountCode,
        creditAccount: `${r.creditAccountCode} - ${r.creditAccountLabel}`,
        creditAccountCode: r.creditAccountCode,
        amount: r.amount,
        tvaAmount: r.tvaAmount,
        clientDossierId: targetDossierId,
        status,
        confidenceScore: r.confidenceScore,
        detectedAnomaly: r.anomaly,
        rawInput: `Import Excel: ${fileName} [Ligne ${r.rowIndex}]`,
        inputType: 'excel_import',
        explanationSimplified: `Opération importée depuis Excel : ${r.label}. Débit ${r.debitAccountCode} / Crédit ${r.creditAccountCode}.`,
        paymentMethod: r.paymentMethod,
        auditTrail: [
          {
            id: `aud-${Date.now()}-${i}`,
            timestamp: new Date().toISOString(),
            action: 'created_by_ai',
            author: 'Module Import Excel AxeCompta',
            notes: `Importé depuis ${fileName}. Détection SYSCOHADA confiance ${r.confidenceScore}%.`,
            confidenceScore: r.confidenceScore
          }
        ]
      };
    });

    onImportEntries(newEntries, targetDossierId);
    onClose();
  };

  // Summary stats
  const selectedCount = parsedRows.filter(r => r.selected).length;
  const totalAmountSelected = parsedRows
    .filter(r => r.selected)
    .reduce((sum, r) => sum + r.amount, 0);

  const filteredPreviewRows = parsedRows.filter(r => 
    searchFilter === '' || 
    r.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.pieceRef.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.debitAccountCode.includes(searchFilter) ||
    r.creditAccountCode.includes(searchFilter)
  );

  return (
    <div className="fixed inset-0 bg-[#1E084A]/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between border-b border-[#3B1578] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-lg font-bold text-white">
                  Importation de Fichiers Excel & Tableurs
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/20 text-[#34D399] border border-[#10B981]/30">
                  .xlsx, .xls, .csv
                </span>
              </div>
              <p className="text-xs text-[#C4B5FD]">
                Conversion automatique en écritures SYSCOHADA avec détection d'imputation comptable
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-[#C4B5FD] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Dossier & Mode Switcher Bar */}
        <div className="bg-[#FAF8FF] px-6 py-3 border-b border-[#DDD6FE] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#534674]">Dossier client récepteur :</span>
            <select
              value={targetDossierId}
              onChange={(e) => setTargetDossierId(e.target.value)}
              className="bg-white border border-[#DDD6FE] text-[#1E084A] font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#7024E3] shadow-2xs"
            >
              {dossiers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.city}, {d.country})
                </option>
              ))}
            </select>
          </div>

          {/* Stepper indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setStep('upload')}
              className={`px-3 py-1 rounded-lg transition-all ${
                step === 'upload' 
                  ? 'bg-[#7024E3] text-white shadow-2xs' 
                  : 'text-[#7C709A] hover:bg-[#EDE9FE]'
              }`}
            >
              1. Fichier
            </button>
            <span className="text-[#DDD6FE]">/</span>
            <button
              disabled={parsedRows.length === 0}
              onClick={() => setStep('mapping')}
              className={`px-3 py-1 rounded-lg transition-all ${
                step === 'mapping' 
                  ? 'bg-[#7024E3] text-white shadow-2xs' 
                  : parsedRows.length === 0 ? 'text-[#C4B5FD] cursor-not-allowed' : 'text-[#7C709A] hover:bg-[#EDE9FE]'
              }`}
            >
              2. Colonnes
            </button>
            <span className="text-[#DDD6FE]">/</span>
            <button
              disabled={parsedRows.length === 0}
              onClick={() => setStep('preview')}
              className={`px-3 py-1 rounded-lg transition-all ${
                step === 'preview' 
                  ? 'bg-[#7024E3] text-white shadow-2xs' 
                  : parsedRows.length === 0 ? 'text-[#C4B5FD] cursor-not-allowed' : 'text-[#7C709A] hover:bg-[#EDE9FE]'
              }`}
            >
              3. Validation ({parsedRows.length})
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processFile(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-[#7024E3]/40 hover:border-[#7024E3] bg-[#FAF8FF] hover:bg-[#F5F3FF] p-8 sm:p-12 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all group shadow-2xs"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-[#DDD6FE] group-hover:border-[#7024E3] flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-all">
                  <UploadCloud className="w-8 h-8 text-[#7024E3]" />
                </div>
                <h4 className="font-heading text-lg font-bold text-[#1E084A] mb-1">
                  Glissez-déposez votre document Excel ici
                </h4>
                <p className="text-xs text-[#7C709A] max-w-md mb-4">
                  Formats acceptés : <strong>.XLSX, .XLS, .CSV</strong> (tableaux de ventes, relevés bancaires, extraits Wave / Orange Money / MTN MoMo, journaux d'achats)
                </p>
                <button
                  type="button"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3] transition-all flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Parcourir mes documents</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Download Official Blank Templates */}
              <div className="bg-[#FAF8FF] border border-[#DDD6FE] p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-[#1E084A] block">Modèles Excel téléchargeables :</span>
                  <p className="text-[12px] text-[#7C709A]">
                    Fournissez ces trames à vos clients entrepreneurs pour standardiser la collecte.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('journal_syscohada')}
                    className="px-3 py-1.5 bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[#1E084A] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs text-[12px]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#7024E3]" />
                    <span>Modèle Journal (.xlsx)</span>
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('releve_bancaire_mobile')}
                    className="px-3 py-1.5 bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[#1E084A] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs text-[12px]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>Modèle Relevé (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* Sheet selector */}
              {availableSheets.length > 1 && (
                <div className="bg-[#FAF8FF] p-4 border border-[#DDD6FE] rounded-xl flex items-center gap-3">
                  <Layers className="w-5 h-5 text-[#7024E3]" />
                  <span className="text-xs font-bold text-[#1E084A]">Feuille du classeur à traiter :</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="bg-white border border-[#DDD6FE] text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    {availableSheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Mapping Grid */}
              <div className="bg-white border border-[#DDD6FE] p-5 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#EDE9FE] pb-3">
                  <div>
                    <h4 className="font-heading text-sm font-bold text-[#1E084A]">
                      Correspondance des Colonnes Détectées
                    </h4>
                    <p className="text-[12px] text-[#7C709A]">
                      Vérifiez les liaisons entre les colonnes de votre fichier et les champs comptables SYSCOHADA.
                    </p>
                  </div>
                  <button
                    onClick={() => setStep('preview')}
                    className="px-4 py-2 bg-[#7024E3] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-[#5B18C4] transition-colors"
                  >
                    <span>Voir le résultat</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {/* Date Column */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Date de l'opération *</label>
                    <select
                      value={columnMapping.dateCol}
                      onChange={(e) => updateMappingField('dateCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">Sélectionner une colonne...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Label / Description */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Libellé / Description *</label>
                    <select
                      value={columnMapping.labelCol}
                      onChange={(e) => updateMappingField('labelCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">Sélectionner une colonne...</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Amount or Debit/Credit */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Montant Global (TTC)</label>
                    <select
                      value={columnMapping.amountCol}
                      onChange={(e) => updateMappingField('amountCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Non utilisé si Débit/Crédit séparés)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Separate Debit Amount */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Colonne Débit / Dépense</label>
                    <select
                      value={columnMapping.debitCol || ''}
                      onChange={(e) => updateMappingField('debitCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Optionnel)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Separate Credit Amount */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Colonne Crédit / Recette</label>
                    <select
                      value={columnMapping.creditCol || ''}
                      onChange={(e) => updateMappingField('creditCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Optionnel)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Reference / Piece */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">N° Pièce / Référence</label>
                    <select
                      value={columnMapping.pieceRefCol || ''}
                      onChange={(e) => updateMappingField('pieceRefCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Auto-généré si vide)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Explicit Debit Account */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Compte Débit (Code OHADA)</label>
                    <select
                      value={columnMapping.debitAccountCol || ''}
                      onChange={(e) => updateMappingField('debitAccountCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Auto-détecté par IA si non spécifié)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Explicit Credit Account */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Compte Crédit (Code OHADA)</label>
                    <select
                      value={columnMapping.creditAccountCol || ''}
                      onChange={(e) => updateMappingField('creditAccountCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Auto-détecté par IA si non spécifié)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* TVA */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Montant de TVA</label>
                    <select
                      value={columnMapping.tvaCol || ''}
                      onChange={(e) => updateMappingField('tvaCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Aucune : TVA à 0)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  {/* Payment Method */}
                  <div className="p-3 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl space-y-1">
                    <label className="font-bold text-[#1E084A] block">Moyen de Règlement / Canal</label>
                    <select
                      value={columnMapping.paymentMethodCol || ''}
                      onChange={(e) => updateMappingField('paymentMethodCol', e.target.value)}
                      className="w-full bg-white border border-[#DDD6FE] rounded-lg p-2 font-medium"
                    >
                      <option value="">(Auto-détecté si vide)</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & AI CLASSIFICATION TABLE */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Top Banner with Stats & Controls */}
              <div className="bg-[#FAF8FF] border border-[#DDD6FE] p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 font-bold text-[#1E084A]">
                    <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                    <span>{fileName}</span>
                    <span className="text-[#7C709A] font-normal">({fileSize})</span>
                  </div>

                  <span className="text-[#DDD6FE]">|</span>

                  <span className="font-mono bg-[#E0E7FF] text-[#3730A3] px-2 py-0.5 rounded font-bold">
                    {selectedCount} / {parsedRows.length} lignes sélectionnées
                  </span>

                  <span className="font-mono bg-[#D1FAE5] text-[#065F46] px-2 py-0.5 rounded font-bold">
                    Total : {totalAmountSelected.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Filtrer lignes..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-[#DDD6FE] rounded-lg text-xs w-36 focus:outline-none focus:border-[#7024E3]"
                  />
                  <button
                    onClick={() => setStep('mapping')}
                    className="px-3 py-1.5 bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg font-bold text-[#1E084A] flex items-center gap-1 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#7024E3]" />
                    <span>Ajuster colonnes</span>
                  </button>
                  <button
                    onClick={() => setStep('upload')}
                    className="px-3 py-1.5 bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg font-bold text-[#1E084A] flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#7024E3]" />
                    <span>Changer fichier</span>
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="bg-white border border-[#DDD6FE] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="sticky top-0 bg-[#1E084A] text-white z-10 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={parsedRows.length > 0 && parsedRows.every(r => r.selected)}
                            onChange={toggleSelectAll}
                            className="rounded accent-[#7024E3]"
                          />
                        </th>
                        <th className="p-3 w-24">Date</th>
                        <th className="p-3 w-28">N° Pièce</th>
                        <th className="p-3 min-w-[200px]">Libellé de l'opération</th>
                        <th className="p-3 min-w-[170px]">Compte Débit (SYSCOHADA)</th>
                        <th className="p-3 min-w-[170px]">Compte Crédit (SYSCOHADA)</th>
                        <th className="p-3 text-right w-28">Montant (FCFA)</th>
                        <th className="p-3 text-center w-24">Confiance IA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDE9FE]">
                      {filteredPreviewRows.map((row) => (
                        <tr 
                          key={row.id}
                          className={`hover:bg-[#FAF8FF] transition-colors ${!row.selected ? 'opacity-40 bg-gray-50' : ''}`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleRowSelect(row.id)}
                              className="rounded accent-[#7024E3]"
                            />
                          </td>

                          <td className="p-3 font-mono text-[#534674] whitespace-nowrap">
                            {row.date}
                          </td>

                          <td className="p-3 font-mono font-bold text-[#7024E3] whitespace-nowrap">
                            {row.pieceRef}
                          </td>

                          <td className="p-3 font-medium text-[#1E084A]">
                            <div>{row.label}</div>
                            {row.anomaly && (
                              <span className="text-[11px] text-[#DC2626] font-bold flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {row.anomaly}
                              </span>
                            )}
                          </td>

                          {/* Editable Debit Account */}
                          <td className="p-2">
                            <select
                              value={row.debitAccountCode}
                              onChange={(e) => updateRowAccount(row.id, 'debit', e.target.value)}
                              className="w-full bg-[#FAF8FF] border border-[#DDD6FE] text-[#1E084A] font-bold text-[12px] rounded-lg p-1.5 focus:bg-white"
                            >
                              {SYSCOHADA_ACCOUNTS.map(a => (
                                <option key={a.code} value={a.code}>
                                  {a.code} - {a.label.slice(0, 24)}...
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Editable Credit Account */}
                          <td className="p-2">
                            <select
                              value={row.creditAccountCode}
                              onChange={(e) => updateRowAccount(row.id, 'credit', e.target.value)}
                              className="w-full bg-[#FAF8FF] border border-[#DDD6FE] text-[#1E084A] font-bold text-[12px] rounded-lg p-1.5 focus:bg-white"
                            >
                              {SYSCOHADA_ACCOUNTS.map(a => (
                                <option key={a.code} value={a.code}>
                                  {a.code} - {a.label.slice(0, 24)}...
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3 text-right font-tabular font-black text-[#1E084A] whitespace-nowrap">
                            {row.amount.toLocaleString('fr-FR')}
                          </td>

                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                              row.confidenceScore >= 90 
                                ? 'bg-[#D1FAE5] text-[#065F46]' 
                                : 'bg-[#FEF3C7] text-[#92400E]'
                            }`}>
                              {row.confidenceScore}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Status Option on Import */}
              <div className="bg-[#FAF8FF] border border-[#DDD6FE] p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#1E084A]">
                    <input
                      type="radio"
                      name="importStatus"
                      checked={importAsValidated}
                      onChange={() => setImportAsValidated(true)}
                      className="accent-[#7024E3]"
                    />
                    <span>Enregistrer directement (validées si aucune anomalie)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#534674]">
                    <input
                      type="radio"
                      name="importStatus"
                      checked={!importAsValidated}
                      onChange={() => setImportAsValidated(false)}
                      className="accent-[#7024E3]"
                    />
                    <span>Importer en brouillon (à relire avant soumission)</span>
                  </label>
                </div>

                <div className="flex items-center gap-1.5 text-[#166534] font-bold text-[12px]">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>Partie double garantie pour chaque ligne</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-white px-6 py-4 border-t border-[#DDD6FE] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-[#DDD6FE] hover:bg-[#FAF8FF] text-[#534674] font-bold text-xs rounded-xl transition-colors"
          >
            Annuler
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {step !== 'preview' ? (
              <button
                disabled={parsedRows.length === 0}
                onClick={() => setStep('preview')}
                className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                  parsedRows.length > 0 
                    ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3]' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <span>Prévisualiser les écritures</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={selectedCount === 0}
                onClick={handleFinalImport}
                className={`w-full sm:w-auto px-6 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all ${
                  selectedCount > 0 
                    ? 'bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Confirmer et importer {selectedCount} écriture{selectedCount > 1 ? 's' : ''} ({totalAmountSelected.toLocaleString('fr-FR')} FCFA)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
