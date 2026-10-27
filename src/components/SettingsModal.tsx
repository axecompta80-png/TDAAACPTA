import React, { useState, useRef } from 'react';
import { ClientDossier, DossierInfo, PlatformSettings, JournalEntry } from '../types';
import { useTheme } from '../context/ThemeContext';
import { soundManager, SOUND_OPTIONS, SoundType } from '../utils/sound';
import { deviceNotificationStatus, requestDeviceNotifications } from '../utils/deviceNotify';
import { OHADA_COUNTRIES, ACTIVITY_SECTORS, FISCAL_REGIMES } from '../data/initialSettings';
import { CurrentUser } from '../utils/authApi';
import { AccountPanel } from './settings/AccountPanel';
import { 
  Settings, 
  X, 
  Building2, 
  Edit3, 
  Trash2, 
  Check, 
  Sliders, 
  Sparkles, 
  Volume2, 
  Play, 
  Palette, 
  Database, 
  ShieldCheck, 
  Download, 
  Upload, 
   
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Percent, 
  DollarSign, 
  HelpCircle,
  Briefcase,
  MapPin,
  Phone,
  FileText,
  CreditCard,
  Search
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossiers: ClientDossier[];
  activeDossier: ClientDossier;
  entries: JournalEntry[];
  settings: PlatformSettings;
  onUpdateSettings: (newSettings: PlatformSettings) => void;
  onUpdateDossier: (updatedDossier: ClientDossier) => void;
  onDeleteDossier: (dossierId: string) => void;
  onSelectDossier: (dossier: ClientDossier) => void;
  onImportBackup?: (backupData: { dossiers: ClientDossier[]; entries: JournalEntry[] }) => void;
  currentUser: CurrentUser;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dossiers,
  activeDossier,
  entries,
  settings,
  onUpdateSettings,
  onUpdateDossier,
  onDeleteDossier,
  onSelectDossier,
  onImportBackup,
  currentUser
}) => {
  const { isDark } = useTheme();
  // Niveau Entreprise (compte principal sur la comptabilité de l'entreprise) : les réglages
  // s'appliquent à tous les dossiers, et la liste permet de gérer chaque dossier.
  const isEntrepriseLevel = activeDossier.isMain && !currentUser.dossierId;

  // Active tab in Settings
  const [activeTab, setActiveTab] = useState<'dossiers' | 'compte' | 'syscohada' | 'ai' | 'audio' | 'display' | 'backup'>('dossiers');

  // Search filter for dossiers
  const [dossierSearch, setDossierSearch] = useState('');

  // Formulaire de modification des informations d'un dossier
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDossierId, setEditingDossierId] = useState<string | null>(null);
  
  // Dossier Form Fields
  const [formData, setFormData] = useState<DossierInfo>({
    name: '',
    managerName: '',
    phone: '',
    activity: '',
    city: 'Abidjan',
    country: "Côte d'Ivoire",
    rccm: '',
    ifu: '',
    regimeFiscal: 'Réel Simplifié',
    currency: 'FCFA'
  });

  // Delete confirmation modal state
  const [dossierToDelete, setDossierToDelete] = useState<ClientDossier | null>(null);

  // Sound test feedback state
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [deviceNotif, setDeviceNotif] = useState(deviceNotificationStatus());

  // Success message feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Open Edit Form
  const handleOpenEditForm = (dossier: ClientDossier) => {
    setEditingDossierId(dossier.id);
    setFormData({
      name: dossier.name,
      managerName: dossier.managerName,
      phone: dossier.phone,
      activity: dossier.activity,
      city: dossier.city,
      country: dossier.country,
      rccm: dossier.rccm,
      ifu: dossier.ifu,
      regimeFiscal: dossier.regimeFiscal,
      currency: dossier.currency
    });
    setIsFormOpen(true);
  };

  // Enregistrer les informations du dossier
  const handleSaveDossier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Veuillez renseigner le nom de l\'entreprise.');
      return;
    }

    const existing = dossiers.find(d => d.id === editingDossierId);
    if (existing) {
      onUpdateDossier({ ...existing, ...formData });
      showFeedback(`"${formData.name}" mis à jour avec succès.`);
    }
    setIsFormOpen(false);
    setEditingDossierId(null);
  };

  // Confirm Delete Dossier
  const handleConfirmDeleteDossier = () => {
    if (!dossierToDelete) return;

    const name = dossierToDelete.name;
    onDeleteDossier(dossierToDelete.id);
    setDossierToDelete(null);
    showFeedback(`Le dossier "${name}" et le compte de son propriétaire ont été supprimés.`);
  };

  // Handle Country selection and auto-adjust currency and default VAT
  const handleCountryChange = (countryName: string) => {
    const found = OHADA_COUNTRIES.find(c => c.name === countryName);
    setFormData(prev => ({
      ...prev,
      country: countryName,
      currency: found?.currency.includes('FCFA') ? 'FCFA' : found?.currency || 'FCFA'
    }));
  };

  // Sound testing
  const handleTestSound = (type?: SoundType) => {
    setIsPlayingTest(true);
    soundManager.play(type || settings.soundType);
    setTimeout(() => setIsPlayingTest(false), 500);
  };

  // Full Backup Export JSON
  const handleExportBackup = () => {
    const backup = {
      exportDate: new Date().toISOString(),
      platform: 'AxeCompta SYSCOHADA v2026',
      dossiers,
      entries
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AxeCompta_Sauvegarde_Complete_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showFeedback('Sauvegarde complète exportée en JSON.');
  };

  // Full Backup Import JSON
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.dossiers && Array.isArray(parsed.dossiers) && onImportBackup) {
          onImportBackup({
            dossiers: parsed.dossiers,
            entries: parsed.entries || []
          });
          showFeedback('Sauvegarde restaurée avec succès.');
        } else {
          alert('Le fichier sélectionné ne semble pas être une sauvegarde AxeCompta valide.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON de sauvegarde.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Niveau Entreprise : l'entreprise et tous ses dossiers ; sinon uniquement le dossier courant.
  const filteredDossiers = (isEntrepriseLevel ? dossiers : [activeDossier]).filter(d => 
    d.name.toLowerCase().includes(dossierSearch.toLowerCase()) ||
    d.activity.toLowerCase().includes(dossierSearch.toLowerCase()) ||
    d.country.toLowerCase().includes(dossierSearch.toLowerCase()) ||
    d.city.toLowerCase().includes(dossierSearch.toLowerCase()) ||
    d.rccm.toLowerCase().includes(dossierSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Settings Modal Card */}
      <div 
        className={`relative z-10 w-full max-w-5xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200 ${
          isDark 
            ? 'bg-[#150A2A] border-[#3B2068] text-[#F3EFFF] shadow-black/90' 
            : 'bg-white border-[#DDD6FE] text-[#1E084A] shadow-purple-950/20'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDE9FE] dark:border-[#2D1A54] flex items-center justify-between gap-3 bg-[#FAF8FF] dark:bg-[#1A0E34]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#7024E3] to-[#8B5CF6] text-white shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black font-heading tracking-wide">
                  {isEntrepriseLevel ? "Paramètres de l'entreprise" : 'Paramètres du dossier'}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#7024E3]/15 text-[#7024E3] dark:text-[#C4B5FD] font-mono">
                  v2026 AUDCIF
                </span>
              </div>
              <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                {isEntrepriseLevel
                  ? `${activeDossier.name} : ces paramètres s'appliquent à l'entreprise et sont recopiés sur tous ses dossiers.`
                  : `${activeDossier.name} : ces paramètres ne concernent que ce dossier.`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#EDE9FE] dark:hover:bg-[#2D1A54] text-[#7C709A] dark:text-[#A594C9] hover:text-[#1E084A] dark:hover:text-white transition-colors"
            aria-label="Fermer les paramètres"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert if any */}
        {feedbackMsg && (
          <div className="px-5 py-2.5 bg-[#DCFCE7] dark:bg-[#0E351F] border-b border-[#BBF7D0] dark:border-[#1A5B36] text-[#059669] dark:text-[#34D399] text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Main Body: Horizontal / Sidebar Tab Navigation */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-64 p-3 border-b md:border-b-0 md:border-r border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF]/60 dark:bg-[#180C30]/60 space-y-1 shrink-0 overflow-x-auto md:overflow-x-visible flex md:flex-col gap-1">
            <button
              onClick={() => setActiveTab('dossiers')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 shrink-0 ${
                activeTab === 'dossiers'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4" />
                <span>{isEntrepriseLevel ? 'Entreprise & Dossiers' : 'Informations du dossier'}</span>
              </div>
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                activeTab === 'dossiers' ? 'bg-white/20 text-white' : 'bg-[#EDE9FE] dark:bg-[#2A164F] text-[#7024E3] dark:text-[#C4B5FD]'
              }`}>
                {filteredDossiers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('compte')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'compte'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Compte & équipe</span>
            </button>

            <button
              onClick={() => setActiveTab('syscohada')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'syscohada'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>SYSCOHADA & Fiscalité</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'ai'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>IA & Automatisation</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'audio'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Sons & Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('display')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'display'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Affichage</span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 shrink-0 ${
                activeTab === 'backup'
                  ? 'bg-[#7024E3] text-white shadow-xs'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#28154B]'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Données & Sauvegardes</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* ================= TAB 1: PROJETS / DOSSIERS CLIENTS (CRUD) ================= */}
            {activeTab === 'dossiers' && (
              <div className="space-y-5">
                {/* Top Action & Search Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                      {isEntrepriseLevel ? "L'entreprise et ses dossiers" : 'Informations du dossier'}
                    </h3>
                    <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                      {isEntrepriseLevel
                        ? 'Modifiez les informations ou supprimez un dossier. Pour en créer un, utilisez « Ajouter un Dossier » dans la barre du haut.'
                        : 'Fiche signalétique et identifiants fiscaux de ce dossier.'}
                    </p>
                  </div>
                </div>

                {/* Search in dossiers */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7C709A] dark:text-[#A594C9]" />
                  <input
                    type="text"
                    placeholder="Filtrer par nom d'entreprise, ville, pays, RCCM ou secteur..."
                    value={dossierSearch}
                    onChange={e => setDossierSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#F5F3FF] dark:bg-[#1A0E34] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs text-[#1E084A] dark:text-[#F3EFFF] focus:outline-hidden focus:border-[#7024E3]"
                  />
                </div>

                {/* Dossiers Grid / List */}
                <div className="grid grid-cols-1 gap-3.5">
                  {filteredDossiers.map(dossier => {
                    const isActive = dossier.id === activeDossier.id;
                    const dossierEntries = entries.filter(e => e.clientDossierId === dossier.id);
                    const countryInfo = OHADA_COUNTRIES.find(c => c.name === dossier.country);

                    return (
                      <div
                        key={dossier.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-[#FAF8FF] dark:bg-[#1C0F38] border-[#7024E3] dark:border-[#A78BFA] shadow-xs'
                            : 'bg-white dark:bg-[#160B2E] border-[#EDE9FE] dark:border-[#2D1A54] hover:border-[#DDD6FE]'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Dossier info */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-black text-[#1E084A] dark:text-[#F3EFFF]">
                                {dossier.name}
                              </h4>
                              {isActive ? (
                                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#059669] dark:text-[#34D399] flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Actif</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    onSelectDossier(dossier);
                                    showFeedback(`Dossier actif basculé sur "${dossier.name}".`);
                                  }}
                                  className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EDE9FE] dark:bg-[#2A164F] text-[#7024E3] dark:text-[#C4B5FD] hover:bg-[#7024E3] hover:text-white transition-colors"
                                  title="Basculer sur ce dossier"
                                >
                                  Activer
                                </button>
                              )}
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-[#2A1550] text-[#534674] dark:text-[#C4B5FD] font-bold">
                                {countryInfo?.flag || '🌍'} {dossier.country} • {dossier.city}
                              </span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EDE9FE] dark:bg-[#2A164F] text-[#7024E3] dark:text-[#C4B5FD]">
                                {dossier.regimeFiscal}
                              </span>
                            </div>

                            <p className="text-xs text-[#534674] dark:text-[#A594C9]">
                              {dossier.isMain ? 'Entreprise' : `Dossier de ${dossier.ownerName ?? '—'}`} • {dossier.activity}
                            </p>

                            {/* Meta items */}
                            <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#7C709A] dark:text-[#8E7BB8] font-mono pt-1">
                              <span>Gérant: <strong>{dossier.managerName}</strong></span>
                              <span>•</span>
                              <span>Tél: <strong>{dossier.phone}</strong></span>
                              <span>•</span>
                              <span>RCCM: <strong>{dossier.rccm}</strong></span>
                              <span>•</span>
                              <span>NIF: <strong>{dossier.ifu}</strong></span>
                              <span>•</span>
                              <span className="text-[#10B981] font-bold">{dossierEntries.length} écriture(s)</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-[#EDE9FE] dark:border-[#2D1A54]">
                            <button
                              onClick={() => handleOpenEditForm(dossier)}
                              className="px-3 py-1.5 bg-[#F5F3FF] dark:bg-[#251348] border border-[#DDD6FE] dark:border-[#381D66] hover:border-[#7024E3] text-[#7024E3] dark:text-[#C4B5FD] text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                              title="Modifier les informations de l'entreprise"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Modifier</span>
                            </button>

                            {isEntrepriseLevel && !dossier.isMain && (
                              <button
                                onClick={() => setDossierToDelete(dossier)}
                                className="p-2 rounded-xl border transition-colors bg-white dark:bg-[#1A0E34] border-[#FEE2E2] dark:border-[#4B1924] text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-[#4B1924]"
                                title="Supprimer ce dossier et le compte de son propriétaire"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= TAB 2: NORMES SYSCOHADA & FISCALITÉ ================= */}
            {activeTab === 'compte' && (
              <AccountPanel />
            )}

            {activeTab === 'syscohada' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                    Paramètres Comptables & Réglementaires SYSCOHADA
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                    Ajustez les règles de conformité AUDCIF, seuils fiscaux d'espèces et taux de TVA de la plateforme.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Plan de Comptes Version */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#7024E3]" />
                      <span>Référentiel Comptable Appliqué</span>
                    </label>
                    <select
                      value={settings.syscohadaVersion}
                      onChange={e => onUpdateSettings({ ...settings, syscohadaVersion: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs text-[#1E084A] dark:text-[#F3EFFF]"
                    >
                      <option value="SYSCOHADA Révisé 2026 (AUDCIF)">SYSCOHADA Révisé 2026 (AUDCIF - Acte Uniforme)</option>
                      <option value="SYSCOHADA Révisé 2017">SYSCOHADA Révisé 2017</option>
                      <option value="Système Minimal de Trésorerie (SMT)">Système Minimal de Trésorerie (SMT)</option>
                    </select>
                    <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                      Contrôle la nomenclature des comptes des classes 1 à 8 et l'ordonnancement du bilan.
                    </p>
                  </div>

                  {/* Cash Deductibility Threshold */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                      <span>Plafond Légal Espèces Déductibles (FCFA)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="50000"
                        value={settings.cashDeductibilityThreshold}
                        onChange={e => onUpdateSettings({ ...settings, cashDeductibilityThreshold: Math.max(0, Number(e.target.value)) })}
                        className="w-full p-2.5 pr-14 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono font-bold text-[#1E084A] dark:text-[#F3EFFF]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7C709A]">
                        FCFA
                      </span>
                    </div>
                    <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                      Tout règlement supérieur en espèces (compte 5711) génère une alerte fiscale de non-déductibilité.
                    </p>
                  </div>

                  {/* Default VAT Rate */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-[#7024E3]" />
                      <span>Taux de TVA Standard (%)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="30"
                        value={settings.defaultVatRate}
                        onChange={e => onUpdateSettings({ ...settings, defaultVatRate: Math.max(0, Number(e.target.value)) })}
                        className="w-full p-2.5 pr-10 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono font-bold text-[#1E084A] dark:text-[#F3EFFF]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7C709A]">
                        %
                      </span>
                    </div>
                    <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                      18.00% pour la zone UEMOA (CI, Sénégal, Bénin...) ou 19.25% pour le Cameroun (CEMAC).
                    </p>
                  </div>

                  {/* Auto-flag cash payments toggle */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] block">
                        Alerter en cas de dépassement espèces
                      </span>
                      <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                        Déclenche automatiquement une notification avec avertissement sonore.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoFlagLargeCashPayments}
                        onChange={e => onUpdateSettings({ ...settings, autoFlagLargeCashPayments: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7024E3]"></div>
                    </label>
                  </div>
                </div>

                {/* Default Accounts Configuration */}
                <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-3">
                  <h4 className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] uppercase tracking-wider">
                    Comptes de Contrepartie par Défaut (SYSCOHADA)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[12px] font-bold text-[#534674] dark:text-[#C4B5FD] block mb-1">
                        Caisse Espèces Principale
                      </label>
                      <input
                        type="text"
                        value={settings.defaultDebitCashAccount}
                        onChange={e => onUpdateSettings({ ...settings, defaultDebitCashAccount: e.target.value })}
                        className="w-full p-2 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-bold text-[#534674] dark:text-[#C4B5FD] block mb-1">
                        Ventes de Marchandises
                      </label>
                      <input
                        type="text"
                        value={settings.defaultCreditSalesAccount}
                        onChange={e => onUpdateSettings({ ...settings, defaultCreditSalesAccount: e.target.value })}
                        className="w-full p-2 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-bold text-[#534674] dark:text-[#C4B5FD] block mb-1">
                        Achats de Marchandises
                      </label>
                      <input
                        type="text"
                        value={settings.defaultDebitExpenseAccount}
                        onChange={e => onUpdateSettings({ ...settings, defaultDebitExpenseAccount: e.target.value })}
                        className="w-full p-2 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: IA & AUTOMATISATION ================= */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                    Intelligence Artificielle & Automatisation Comptable
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                    Configurez le modèle Gemini et le filtrage des doublons.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Validation : règle du propriétaire du dossier (server/access.ts) */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-0.5">
                    <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] block">
                      Validation des écritures
                    </span>
                    <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                      Les écritures sans anomalie sont validées automatiquement. Les anomalies restent « à vérifier » dans le journal, où vous les validez en un clic.
                    </p>
                  </div>

                  {/* Duplicate Detection Toggle */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] block">
                        Détection automatique des doublons
                      </span>
                      <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                        Identifie les reçus, factures et montants déjà saisis pour le même client.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.duplicateDetection}
                        onChange={e => onUpdateSettings({ ...settings, duplicateDetection: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7024E3]"></div>
                    </label>
                  </div>
                </div>

                {/* AI Model Preference */}
                <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                  <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#7024E3]" />
                    <span>Moteur d'Analyse Sélectionné</span>
                  </label>
                  <select
                    value={settings.aiModelPreference}
                    onChange={e => onUpdateSettings({ ...settings, aiModelPreference: e.target.value as any })}
                    className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs text-[#1E084A] dark:text-[#F3EFFF]"
                  >
                    <option value="gemini-2.5-flash">Gemini Flash — dernière version (Recommandé : raisonnement rapide et lecture de reçus)</option>
                    <option value="gemini-2.5-flash-lite">Gemini Flash Lite — dernière version (ultra rapide et économique)</option>
                    <option value="heuristic-fast">Moteur Heuristique Local Hors-Ligne (Secours garanti)</option>
                  </select>
                  <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                    Le système utilise automatiquement le moteur de secours heuristique en cas d'absence de clé ou de coupure réseau.
                  </p>
                </div>
              </div>
            )}

            {/* ================= TAB 4: AUDIO, SONS & NOTIFICATIONS ================= */}
            {activeTab === 'audio' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                    Paramètres Audio & Alertes Sonores
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                    Choisissez le son de notification par défaut et testez les carillons.
                  </p>
                </div>

                {/* Son toujours actif au volume maximum, notifications sur l'appareil */}
                <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[#7024E3] text-white">
                      <Volume2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] block">
                        Alertes sonores : toujours activées, volume maximum
                      </span>
                      <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                        Le volume réel dépend aussi du volume de votre appareil et du mode silencieux.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EDE9FE] dark:border-[#2D1A54]">
                    <span className="text-xs text-[#534674] dark:text-[#A594C9]">
                      Notifications sur l'appareil : <strong>{deviceNotif === 'granted' ? 'activées' : deviceNotif === 'denied' ? 'bloquées dans le navigateur' : deviceNotif === 'unsupported' ? 'non prises en charge' : 'à autoriser'}</strong>
                    </span>
                    {deviceNotif === 'default' && (
                      <button
                        onClick={async () => setDeviceNotif(await requestDeviceNotifications())}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#7024E3] text-white hover:bg-[#5B18C4]"
                      >
                        Autoriser
                      </button>
                    )}
                  </div>
                  {deviceNotif === 'denied' && (
                    <p className="text-[12px] text-[#D97706]">
                      Débloquez-les dans les réglages du site (icône à gauche de l'adresse), puis rechargez la page.
                    </p>
                  )}
                </div>

                {/* Sound Presets Selection */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#7024E3] dark:text-[#C4B5FD]">
                      Sélectionnez votre son par défaut
                    </span>
                    <button
                      onClick={() => handleTestSound()}
                      disabled={!settings.soundEnabled}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#7024E3] text-white text-xs font-bold rounded-lg hover:bg-[#5B18C4] transition-all disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{isPlayingTest ? 'Lecture...' : 'Tester le son sélectionné'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SOUND_OPTIONS.map(opt => {
                      const isSelected = settings.soundType === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            onUpdateSettings({ ...settings, soundType: opt.id });
                            soundManager.setSoundType(opt.id);
                            soundManager.play(opt.id);
                          }}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-white dark:bg-[#28154B] border-[#7024E3] dark:border-[#A78BFA] shadow-xs ring-1 ring-[#7024E3]'
                              : 'bg-white/60 dark:bg-[#180A2E]/60 border-[#EDE9FE] dark:border-[#2D1A54] hover:border-[#DDD6FE]'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="text-xs font-bold flex items-center gap-1.5 text-[#1E084A] dark:text-[#F3EFFF]">
                              {isSelected && <span className="w-2 h-2 rounded-full bg-[#7024E3] dark:bg-[#A78BFA]" />}
                              <span>{opt.label}</span>
                            </div>
                            <p className="text-[12px] text-[#7C709A] dark:text-[#A594C9] leading-relaxed">
                              {opt.description}
                            </p>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestSound(opt.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-[#F5F3FF] dark:hover:bg-[#3B2068] text-[#7024E3] dark:text-[#C4B5FD] shrink-0"
                            title="Écouter cet extrait"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Notification Triggers */}
                <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-3">
                  <h4 className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] uppercase tracking-wider">
                    Déclencheurs d'Alertes Actifs
                  </h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 text-xs text-[#534674] dark:text-[#C4B5FD] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnAnomaly}
                        onChange={e => onUpdateSettings({ ...settings, notifyOnAnomaly: e.target.checked })}
                        className="rounded text-[#7024E3] focus:ring-[#7024E3]"
                      />
                      <span>Alerter lors d'anomalies SYSCOHADA (pièce manquante, compte déséquilibré, espèces)</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-[#534674] dark:text-[#C4B5FD] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnTaxDeadline}
                        onChange={e => onUpdateSettings({ ...settings, notifyOnTaxDeadline: e.target.checked })}
                        className="rounded text-[#7024E3] focus:ring-[#7024E3]"
                      />
                      <span>Rappels des échéances de déclaration fiscale (TVA du 15 du mois)</span>
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-[#534674] dark:text-[#C4B5FD] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifyOnMobileMoneySync}
                        onChange={e => onUpdateSettings({ ...settings, notifyOnMobileMoneySync: e.target.checked })}
                        className="rounded text-[#7024E3] focus:ring-[#7024E3]"
                      />
                      <span>Notification lors des consolidations de transactions Wave & Orange Money</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 5: AFFICHAGE & CABINET ================= */}
            {activeTab === 'display' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                    Affichage, Thème & Identité
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                    Personnalisez le nom de votre espace et les préférences visuelles de travail.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cabinet Name */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                      Nom de votre espace
                    </label>
                    <input
                      type="text"
                      value={settings.cabinetName}
                      onChange={e => onUpdateSettings({ ...settings, cabinetName: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-bold"
                    />
                    <p className="text-[12px] text-[#7C709A]">
                      Apparaît en en-tête des états financiers, bilans et attestations de régularité.
                    </p>
                  </div>

                  {/* License Number */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                      Numéro d'Agrément Ordre (ONECCA)
                    </label>
                    <input
                      type="text"
                      value={settings.expertLicenseNumber}
                      onChange={e => onUpdateSettings({ ...settings, expertLicenseNumber: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs font-mono font-bold"
                    />
                    <p className="text-[12px] text-[#7C709A]">
                      Numéro d'inscription au tableau de l'Ordre des Experts-Comptables.
                    </p>
                  </div>

                  {/* Startup view mode */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                      Espace Actif au Démarrage
                    </label>
                    <select
                      value={settings.defaultStartupView}
                      onChange={e => onUpdateSettings({ ...settings, defaultStartupView: e.target.value as any })}
                      className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs"
                    >
                      <option value="simplified">Mode Entrepreneur (Reçus & Trésorerie)</option>
                      <option value="expert">Mode Comptable (Journal & Grand Livre)</option>
                    </select>
                    <p className="text-[12px] text-[#7C709A]">
                      Définit l'écran principal chargé à l'ouverture de l'application.
                    </p>
                  </div>

                  {/* Currency Format */}
                  <div className="p-4 rounded-xl border border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#190D34] space-y-2">
                    <label className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                      Format d'Affichage des Montants
                    </label>
                    <select
                      value={settings.numberFormatting}
                      onChange={e => onUpdateSettings({ ...settings, numberFormatting: e.target.value as any })}
                      className="w-full p-2.5 bg-white dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl text-xs"
                    >
                      <option value="standard">Standard complet (ex: 1 500 000 FCFA)</option>
                      <option value="compact">Compact abrégé (ex: 1.5M FCFA)</option>
                    </select>
                    <p className="text-[12px] text-[#7C709A]">
                      Style d'affichage des devises sur les cartes de trésorerie.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* ================= TAB 6: DONNÉES & SAUVEGARDES ================= */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black font-heading text-[#1E084A] dark:text-[#F3EFFF]">
                    Données, Sauvegardes & Restauration
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                    Exportez l'intégralité de vos projets et écritures pour archivage ou restaurez une sauvegarde.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export Full JSON Backup */}
                  <div className="p-5 rounded-xl border border-[#DDD6FE] dark:border-[#35225E] bg-[#FAF8FF] dark:bg-[#190D34] space-y-3">
                    <div className="p-2.5 rounded-xl bg-[#7024E3]/10 text-[#7024E3] dark:text-[#C4B5FD] w-fit">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                        Sauvegarde Complète (JSON)
                      </h4>
                      <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-1">
                        Téléchargez un instantané complet contenant vos {dossiers.length} projets, l'ensemble des {entries.length} écritures et tous les réglages.
                      </p>
                    </div>
                    <button
                      onClick={handleExportBackup}
                      className="w-full py-2.5 px-4 bg-[#7024E3] hover:bg-[#5B18C4] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger la sauvegarde complète</span>
                    </button>
                  </div>

                  {/* Import JSON Backup */}
                  <div className="p-5 rounded-xl border border-[#DDD6FE] dark:border-[#35225E] bg-[#FAF8FF] dark:bg-[#190D34] space-y-3">
                    <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981] w-fit">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1E084A] dark:text-[#F3EFFF]">
                        Restaurer une Sauvegarde
                      </h4>
                      <p className="text-xs text-[#7C709A] dark:text-[#A594C9] mt-1">
                        Chargez un fichier de sauvegarde au format JSON pour restaurer instantanément vos projets et écritures.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json"
                      onChange={handleImportFileSelect}
                      className="hidden"
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-4 bg-white dark:bg-[#20103E] border border-[#DDD6FE] dark:border-[#3D216D] hover:border-[#7024E3] text-[#7024E3] dark:text-[#C4B5FD] rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Sélectionner un fichier JSON</span>
                    </button>
                  </div>
                </div>

                {/* Demo retirée */}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EDE9FE] dark:border-[#2D1A54] bg-[#FAF8FF] dark:bg-[#1A0E34] flex items-center justify-between gap-3 text-xs">
          <div className="text-[12px] text-[#7C709A] dark:text-[#A594C9] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span>
              Projet actif actuel : <strong>{activeDossier.name}</strong> ({activeDossier.country})
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#7024E3] hover:bg-[#5B18C4] text-white font-bold rounded-xl transition-all shadow-xs"
          >
            Terminer & Fermer
          </button>
        </div>
      </div>

      {/* ================= MODAL DE CRÉATION / ÉDITION DE PROJET ================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs animate-fadeIn">
          <div 
            className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border p-5 sm:p-6 overflow-y-auto max-h-[90vh] ${
              isDark 
                ? 'bg-[#180C30] border-[#3B2068] text-[#F3EFFF]' 
                : 'bg-white border-[#DDD6FE] text-[#1E084A]'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#EDE9FE] dark:border-[#2D1A54] pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#7024E3] text-white">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black font-heading">
                    {dossiers.find(d => d.id === editingDossierId)?.isMain ? "Modifier les informations de l'entreprise" : 'Modifier le dossier'}
                  </h3>
                  <p className="text-xs text-[#7C709A] dark:text-[#A594C9]">
                    Fiche signalétique, identifiants fiscaux et seuil d'auto-imputation
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveDossier} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="font-bold block mb-1">
                    Nom de l'Entreprise / Raison Sociale *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Société Ivoirienne de Négoce SARL"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl font-bold"
                  />
                </div>

                {/* Manager Name */}
                <div>
                  <label className="font-bold block mb-1">
                    Gérant / Dirigeant
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Amadou Diallo"
                    value={formData.managerName}
                    onChange={e => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl"
                  />
                </div>

                {/* Phone / WhatsApp */}
                <div>
                  <label className="font-bold block mb-1">
                    Téléphone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="+225 07 00 00 00 00"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl font-mono"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="font-bold block mb-1">
                    Pays Membre de l'OHADA
                  </label>
                  <select
                    value={formData.country}
                    onChange={e => handleCountryChange(e.target.value)}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl font-bold"
                  >
                    {OHADA_COUNTRIES.map(c => (
                      <option key={c.code} value={c.name}>
                        {c.flag} {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="font-bold block mb-1">
                    Ville / Commune
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Abidjan, Dakar, Douala..."
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl"
                  />
                </div>

                {/* Sector */}
                <div className="sm:col-span-2">
                  <label className="font-bold block mb-1">
                    Secteur d'Activité
                  </label>
                  <input
                    list="settings-activity-sectors"
                    value={formData.activity}
                    onChange={e => setFormData({ ...formData, activity: e.target.value })}
                    placeholder="Choisissez dans la liste ou saisissez"
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl"
                  />
                  <datalist id="settings-activity-sectors">
                    {ACTIVITY_SECTORS.map(sec => <option key={sec} value={sec} />)}
                  </datalist>
                </div>

                {/* RCCM */}
                <div>
                  <label className="font-bold block mb-1">
                    Numéro RCCM
                  </label>
                  <input
                    type="text"
                    placeholder="ex: CI-ABJ-2024-B-14299"
                    value={formData.rccm}
                    onChange={e => setFormData({ ...formData, rccm: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl font-mono"
                  />
                </div>

                {/* NIF / IFU */}
                <div>
                  <label className="font-bold block mb-1">
                    Numéro IFU / NIF
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 0824911K"
                    value={formData.ifu}
                    onChange={e => setFormData({ ...formData, ifu: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl font-mono"
                  />
                </div>

                {/* Fiscal Regime */}
                <div>
                  <label className="font-bold block mb-1">
                    Régime Fiscal
                  </label>
                  <select
                    value={formData.regimeFiscal}
                    onChange={e => setFormData({ ...formData, regimeFiscal: e.target.value as any })}
                    className="w-full p-2.5 bg-[#FAF8FF] dark:bg-[#150A2A] border border-[#DDD6FE] dark:border-[#35225E] rounded-xl"
                  >
                    {FISCAL_REGIMES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EDE9FE] dark:border-[#2D1A54]">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7024E3] hover:bg-[#5B18C4] text-white rounded-xl font-bold transition-all shadow-xs"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CONFIRMATION DE SUPPRESSION ================= */}
      {dossierToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xs animate-fadeIn">
          <div 
            className={`w-full max-w-md rounded-2xl shadow-2xl border p-5 sm:p-6 space-y-4 ${
              isDark ? 'bg-[#180C30] border-[#4B1924] text-[#F3EFFF]' : 'bg-white border-[#FEE2E2] text-[#1E084A]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-[#FEE2E2] dark:bg-[#3D141F] text-[#EF4444] shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-[#EF4444]">
                  Supprimer ce dossier ?
                </h3>
                <p className="text-xs text-[#534674] dark:text-[#A594C9] leading-relaxed">
                  Vous êtes sur le point de supprimer le dossier <strong>"{dossierToDelete.name}"</strong> (RCCM: {dossierToDelete.rccm}).
                </p>
                <p className="text-[12px] text-[#7C709A] dark:text-[#8E7BB8]">
                  Ce dossier compte actuellement {entries.filter(e => e.clientDossierId === dossierToDelete.id).length} écriture(s) associée(s).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDossierToDelete(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>

              <button
                onClick={handleConfirmDeleteDossier}
                className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
