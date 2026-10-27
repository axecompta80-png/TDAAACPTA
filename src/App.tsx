import React, { useState, useEffect } from 'react';
import { ClientDossier, DossierDirectoryItem, DossierInfo, JournalEntry, AppNotification, NotificationType, NotificationCategory, PlatformSettings, Invoice } from './types';
import { registerCustomAccounts } from './data/syscohadaPlan';
import { showDeviceNotification } from './utils/deviceNotify';
import { DEFAULT_PLATFORM_SETTINGS } from './data/initialSettings';
import { soundManager } from './utils/sound';
import { api } from './utils/api';
import { CurrentUser } from './utils/authApi';
import { Header } from './components/Header';
import { NotificationPanel } from './components/NotificationPanel';
import { SettingsModal } from './components/SettingsModal';
import { ConversationalAgent } from './components/simplified/ConversationalAgent';
import { TreasuryPage } from './components/simplified/TreasuryPage';
import { CreditReadyReport } from './components/simplified/CreditReadyReport';
import { QuickInvoiceModal } from './components/simplified/QuickInvoiceModal';
import { MultiClientPortfolio } from './components/expert/MultiClientPortfolio';
import { JournalValidation } from './components/expert/JournalValidation';
import { GeneralLedger } from './components/expert/GeneralLedger';
import { FinancialStatements } from './components/expert/FinancialStatements';
import { TaxCompliance } from './components/expert/TaxCompliance';
import { AuditTrailModal } from './components/expert/AuditTrailModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { CompanySetup } from './components/onboarding/CompanySetup';
import { AddDossierModal } from './components/AddDossierModal';
import { InvoicesPanel } from './components/expert/InvoicesPanel';
import { ChartOfAccounts } from './components/expert/ChartOfAccounts';
import { 
  Building2, 
  BookOpen, 
  CheckCircle2, 
  Scale, 
  Receipt,
  TrendingUp,
  Sparkles,
  FileText,
  ListTree
} from 'lucide-react';

interface AppProps {
  currentUser: CurrentUser;
  onLogout: () => void;
}

export default function App({ currentUser, onLogout }: AppProps) {
  // Toutes les données métier (dossiers, écritures, notifications, réglages) vivent en base
  // Postgres et sont chargées au montage via /api/bootstrap. Seul le dossier actif reste en
  // préférence locale de navigateur (choix d'affichage, pas une donnée comptable).
  // Compte principal (dossierId null) : l'entreprise et tous ses dossiers. Propriétaire : son seul dossier.
  const isMainAccount = !currentUser.dossierId;
  const [isLoaded, setIsLoaded] = useState(false);
  // Réglages propres à chaque dossier (ceux de l'entreprise sont recopiés sur tous les dossiers).
  const [settingsByDossier, setSettingsByDossier] = useState<Record<string, PlatformSettings>>({});
  const [currentMode, setCurrentMode] = useState<'simplified' | 'expert'>('simplified');
  // Page dédiée (Trésorerie & Statistiques), indépendante du mode Entrepreneur/Comptable
  const [activePage, setActivePage] = useState<'home' | 'treasury'>('home');
  const [dossiers, setDossiers] = useState<ClientDossier[]>([]);
  const [directory, setDirectory] = useState<DossierDirectoryItem[]>([]);
  const [isAddDossierOpen, setIsAddDossierOpen] = useState(false);
  const [activeDossierId, setActiveDossierId] = useState<string>('');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // Incrémenté quand le plan comptable change (les comptes vivent hors de l'état React).
  const [, setPlanVersion] = useState(0);

  // Chargement initial depuis la base de données
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getBootstrap();
        if (cancelled) return;

        registerCustomAccounts(data.accounts ?? []);
        setInvoices(data.invoices ?? []);
        setSettingsByDossier(data.settingsByDossier);
        setDossiers(data.dossiers);
        setDirectory(data.directory);
        setEntries(data.entries);
        setNotifications(data.notifications);

        let savedId: string | null = null;
        try {
          savedId = localStorage.getItem('axecompta_active_dossier_id');
        } catch (e) { /* ignore */ }
        // Un propriétaire arrive toujours sur son dossier ; le principal reprend le dernier ouvert, sinon l'entreprise.
        const initialId = currentUser.dossierId
          ?? (savedId && data.dossiers.some(d => d.id === savedId) ? savedId : data.dossiers[0]?.id || '');
        setActiveDossierId(initialId);
        setCurrentMode(data.settingsByDossier[initialId]?.defaultStartupView || 'simplified');
      } catch (e) {
        console.error('Erreur de chargement des données AxeCompta', e);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Expert navigation tab
  const [expertTab, setExpertTab] = useState<'portfolio' | 'journal' | 'invoices' | 'accounts' | 'ledger' | 'financials' | 'tax'>('journal');
  const showExpertTab = (tab: typeof expertTab) => setExpertTab(tab === 'portfolio' && !isMainAccount ? 'journal' : tab);
  
  // Modals & Panels
  const [selectedAuditEntry, setSelectedAuditEntry] = useState<JournalEntry | null>(null);
  const [isCreditReadyOpen, setIsCreditReadyOpen] = useState(false);
  const [isQuickInvoiceOpen, setIsQuickInvoiceOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Le dossier actif est une simple préférence d'affichage locale, pas une donnée comptable.
  useEffect(() => {
    if (typeof window !== 'undefined' && activeDossierId) {
      localStorage.setItem('axecompta_active_dossier_id', activeDossierId);
    }
  }, [activeDossierId]);

  const activeDossier = dossiers.find(d => d.id === activeDossierId) || dossiers[0];
  const platformSettings = (activeDossier && settingsByDossier[activeDossier.id]) || DEFAULT_PLATFORM_SETTINGS;
  // Niveau Entreprise : compte principal sur la comptabilité de l'entreprise (vues consolidées).
  const isEntrepriseLevel = isMainAccount && Boolean(activeDossier?.isMain);

  // Sync settings with SoundManager
  useEffect(() => {
    soundManager.setSoundType(platformSettings.soundType);
  }, [platformSettings]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#F8F7FD] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[#1E084A]">
          <div className="w-8 h-8 border-4 border-[#DDD6FE] border-t-[#7024E3] rounded-full animate-spin" />
          <span className="text-sm font-bold">Chargement d'AxeCompta…</span>
        </div>
      </div>
    );
  }

  // Compte principal sans informations d'entreprise (juste après l'inscription) : on les demande,
  // puis il arrive directement dans l'interface comptable en mode Entrepreneur.
  if (!activeDossier) {
    if (!isMainAccount) {
      return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-[#1E084A]">Dossier introuvable. Contactez le compte principal de votre entreprise.</div>;
    }
    return (
      <CompanySetup
        currentUser={currentUser}
        onLogout={onLogout}
        onSubmit={handleSetupCompany}
      />
    );
  }

  // Les écritures annulées restent visibles au journal (traçabilité) mais n'entrent dans aucun calcul.
  const liveEntries = entries.filter(e => e.status !== 'cancelled');

  // Calculated metrics
  const activeEntries = liveEntries.filter(e => e.clientDossierId === activeDossier.id);
  const pendingCount = activeEntries.filter(e => e.status === 'pending_review').length;
  const anomalyCount = activeEntries.filter(e => e.status === 'anomaly').length;
  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  /**
   * Pushes a new notification and triggers the default notification chime
   */
  const pushNotification = (
    title: string,
    message: string,
    type: NotificationType = 'info',
    category: NotificationCategory = 'compta',
    options?: {
      actionLabel?: string;
      actionPayload?: { mode?: 'simplified' | 'expert'; expertTab?: 'portfolio' | 'journal' | 'invoices' | 'accounts' | 'ledger' | 'financials' | 'tax' };
    }
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      timestamp: "À l'instant",
      type,
      category,
      read: false,
      dossierId: activeDossier.id,
      actionLabel: options?.actionLabel,
      actionPayload: options?.actionPayload
    };

    setNotifications(prev => [newNotif, ...prev]);
    api.createNotification(newNotif).catch(e => console.error('Erreur de persistance notification', e));

    // Toujours : carillon au volume maximum + bannière sur l'appareil
    soundManager.play(type === 'warning' || type === 'error' ? 'alert_warning' : undefined);
    showDeviceNotification(title, message, newNotif.id);

    showToast(title);
  };

  // Add new entry
  const handleNewEntry = async (newEntry: JournalEntry): Promise<JournalEntry | null> => {
    try {
      const saved = await api.createEntry(newEntry);
      setEntries(prev => [saved, ...prev]);
      const isAnomaly = saved.status === 'anomaly';

      pushNotification(
        isAnomaly ? 'Alerte Anomalie détectée' : 'Nouvelle opération enregistrée',
        isAnomaly
          ? `Écriture "${saved.label}" (${saved.amount.toLocaleString('fr-FR')} FCFA) : ${saved.detectedAnomaly || 'Anomalie détectée'}`
          : `${saved.label} • ${saved.amount.toLocaleString('fr-FR')} FCFA imputé au débit ${saved.debitAccountCode} / crédit ${saved.creditAccountCode}`,
        isAnomaly ? 'warning' : 'success',
        'compta',
        {
          actionLabel: isAnomaly ? "Examiner l'anomalie" : "Voir l'écriture",
          actionPayload: { mode: 'expert', expertTab: 'journal' }
        }
      );
      return saved;
    } catch (e) {
      console.error('Erreur lors de la création de l\'écriture', e);
      showToast("Erreur lors de l'enregistrement de l'écriture.");
      return null;
    }
  };

  // Import entries from Excel
  const handleImportEntries = async (newEntries: JournalEntry[], targetDossierId: string) => {
    try {
      const saved = await api.importEntries(newEntries);
      setEntries(prev => [...saved, ...prev]);
      const target = dossiers.find(d => d.id === targetDossierId);

      pushNotification(
        'Import Excel réussi',
        `${saved.length} écriture(s) SYSCOHADA importée(s) avec succès pour ${target?.name || 'le dossier'}.`,
        'success',
        'compta',
        {
          actionLabel: 'Consulter le journal',
          actionPayload: { mode: 'expert', expertTab: 'journal' }
        }
      );
    } catch (e: any) {
      console.error('Erreur lors de l\'import Excel', e);
      // Message du serveur (ex. compte inconnu) : l'utilisateur sait quoi corriger.
      showToast(e?.message || "Erreur lors de l'import des écritures.");
    }
  };

  /** Remplace (ou ajoute) des écritures renvoyées par le serveur. */
  const mergeEntries = (changed: JournalEntry[]) => {
    const map = new Map(changed.map(e => [e.id, e]));
    setEntries(prev => [...changed.filter(e => !prev.some(p => p.id === e.id)), ...prev.map(e => map.get(e.id) ?? e)]);
  };

  // Batch validation
  const handleBatchValidate = async (entryIds: string[]) => {
    try {
      const { validated, refused } = await api.batchValidateEntries(entryIds);
      mergeEntries(validated);
      if (validated.length > 0) {
        pushNotification(
          'Validation effectuée',
          `${validated.length} écriture(s) validée(s) et intégrée(s) au Grand Livre.`,
          'success',
          'compta',
          { actionLabel: 'Ouvrir le Grand Livre', actionPayload: { mode: 'expert', expertTab: 'ledger' } }
        );
      }
      if (refused.length > 0) {
        const reasons = [...new Set(refused.map(r => r.reason))].join(' ');
        showToast(`${refused.length} écriture(s) non validée(s) : ${reasons}`);
      }
    } catch (e: any) {
      console.error('Erreur lors de la validation de lot', e);
      showToast(e?.message || 'Erreur lors de la validation des écritures.');
    }
  };

  // Soumission / dévalidation / annulation d'une écriture
  const handleEntryAction = async (action: 'submit' | 'unvalidate' | 'cancel', id: string, reason?: string) => {
    try {
      const saved = action === 'submit' ? await api.submitEntry(id)
        : action === 'unvalidate' ? await api.unvalidateEntry(id, reason)
        : await api.cancelEntry(id, reason);
      mergeEntries([saved]);
      showToast(action === 'submit' ? 'Écriture soumise à validation.' : action === 'unvalidate' ? 'Écriture dévalidée.' : 'Écriture annulée.');
      if (action === 'cancel') {
        // le lettrage éventuel a été supprimé côté serveur
        setInvoices(prev => prev.map(inv => ({ ...inv, payments: inv.payments.filter(p => p.entryId !== id) })));
      }
    } catch (e: any) {
      showToast(e?.message || 'Action impossible.');
    }
  };

  const upsertInvoice = (inv: Invoice) =>
    setInvoices(prev => prev.some(i => i.id === inv.id) ? prev.map(i => i.id === inv.id ? inv : i) : [inv, ...prev]);

  // Single entry update
  const handleUpdateEntry = async (updatedEntry: JournalEntry) => {
    try {
      const saved = await api.updateEntry(updatedEntry);
      setEntries(prev => prev.map(e => e.id === saved.id ? saved : e));
      pushNotification(
        'Écriture mise à jour',
        `L'écriture "${saved.label}" a été modifiée${saved.status === 'validated' ? ' et validée' : ' (en attente de validation)'}.`,
        'success',
        'compta'
      );
    } catch (e: any) {
      console.error('Erreur lors de la mise à jour de l\'écriture', e);
      showToast(e?.message || "Erreur lors de la mise à jour de l'écriture.");
    }
  };

  // Entreprise & dossiers
  async function handleSetupCompany(company: DossierInfo) {
    const main = await api.setupCompany(company);
    const data = await api.getBootstrap();
    setSettingsByDossier(data.settingsByDossier);
    setDirectory(data.directory);
    setDossiers(data.dossiers);
    setActiveDossierId(main.id);
    setCurrentMode('simplified');
  }

  /** Ouvre un dossier de la liste, ou explique qu'il est hors périmètre (le serveur refuse de toute façon). */
  const handleSelectDossier = (id: string) => {
    if (dossiers.some(d => d.id === id)) setActiveDossierId(id);
    else showToast("Vous n'avez pas accès à ce dossier.");
  };

  const handleDossierAdded = (created: ClientDossier) => {
    setDossiers(prev => [...prev, created]);
    setDirectory(prev => [...prev, { id: created.id, name: created.name, isMain: false, ownerName: created.ownerName }]);
    // Réglages recopiés de l'entreprise côté serveur.
    setSettingsByDossier(prev => ({ ...prev, [created.id]: prev[activeDossier.id] ?? DEFAULT_PLATFORM_SETTINGS }));
    setIsAddDossierOpen(false);
    pushNotification(
      'Nouveau dossier créé',
      created.ownerName ? `Le dossier "${created.name}" a été confié à ${created.ownerName}.` : `Le dossier "${created.name}" a été créé.`,
      'success',
      'system',
      { actionLabel: 'Voir le portefeuille', actionPayload: { mode: 'expert', expertTab: 'portfolio' } }
    );
  };

  const handleUpdateDossier = async (updatedDossier: ClientDossier) => {
    try {
      const saved = await api.updateDossier(updatedDossier);
      setDossiers(prev => prev.map(d => d.id === saved.id ? saved : d));
      setDirectory(prev => prev.map(d => d.id === saved.id ? { ...d, name: saved.name } : d));

      pushNotification(
        'Dossier Mis à Jour',
        `Les informations du dossier "${saved.name}" ont été actualisées avec succès.`,
        'info',
        'system'
      );

      showToast(`Dossier "${saved.name}" mis à jour.`);
    } catch (e) {
      console.error('Erreur lors de la mise à jour du dossier', e);
      showToast('Erreur lors de la mise à jour du dossier.');
    }
  };

  const handleDeleteDossier = async (dossierId: string) => {
    const dossierToDelete = dossiers.find(d => d.id === dossierId);
    if (!dossierToDelete || dossierToDelete.isMain) return;
    try {
      await api.deleteDossier(dossierId);
      const remainingDossiers = dossiers.filter(d => d.id !== dossierId);

      if (activeDossierId === dossierId) {
        setActiveDossierId(remainingDossiers.find(d => d.isMain)?.id ?? remainingDossiers[0]?.id ?? '');
      }

      setDossiers(remainingDossiers);
      setDirectory(prev => prev.filter(d => d.id !== dossierId));
      setEntries(prev => prev.filter(e => e.clientDossierId !== dossierId));
      setNotifications(prev => prev.filter(n => n.dossierId !== dossierId));

      pushNotification(
        'Dossier Supprimé',
        `Le dossier "${dossierToDelete.name}" et le compte de son propriétaire ont été supprimés.`,
        'warning',
        'system'
      );

      showToast(`Dossier "${dossierToDelete.name}" supprimé.`);
    } catch (e) {
      console.error('Erreur lors de la suppression du dossier', e);
      showToast('Erreur lors de la suppression du dossier.');
    }
  };

  const handleUpdatePlatformSettings = async (newSettings: PlatformSettings) => {
    try {
      const { settings: saved, propagated } = await api.updateSettings(activeDossier.id, newSettings);
      setSettingsByDossier(prev => propagated
        ? Object.fromEntries(Object.keys({ ...prev, [activeDossier.id]: saved }).map(id => [id, saved]))
        : { ...prev, [activeDossier.id]: saved });
      showToast(propagated ? "Paramètres enregistrés pour l'entreprise et tous ses dossiers." : 'Paramètres du dossier enregistrés.');
    } catch (e) {
      console.error('Erreur lors de la mise à jour des paramètres', e);
      showToast('Erreur lors de l\'enregistrement des paramètres.');
    }
  };

  const handleImportBackup = async (backupData: {
    dossiers?: ClientDossier[];
    entries?: JournalEntry[];
  }) => {
    try {
      const data = await api.importBackup(backupData);
      setSettingsByDossier(data.settingsByDossier);
      setDossiers(data.dossiers);
      setDirectory(data.directory);
      setEntries(data.entries);
      setNotifications(data.notifications);

      soundManager.play('fintech_chime');
      pushNotification(
        'Restauration effectuée',
        'Les dossiers et écritures ont été restaurés depuis votre sauvegarde.',
        'success',
        'system'
      );
      showToast('Sauvegarde restaurée avec succès.');
    } catch (e: any) {
      console.error('Erreur lors de la restauration de la sauvegarde', e);
      showToast(e?.message || 'Erreur lors de la restauration de la sauvegarde.');
    }
  };

  // Notification management handlers
  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    api.markNotificationRead(id).catch(e => console.error('Erreur de mise à jour notification', e));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    soundManager.play('soft_chord');
    api.markAllNotificationsRead().catch(e => console.error('Erreur de mise à jour notifications', e));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    api.deleteNotification(id).catch(e => console.error('Erreur de suppression notification', e));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    api.clearAllNotifications().catch(e => console.error('Erreur de suppression des notifications', e));
  };

  return (
    <div className="min-h-screen bg-[#F8F7FD] text-[#1E084A] flex flex-col font-sans selection:bg-[#7024E3] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#1E084A] dark:bg-[#200E40] text-white px-4 py-3 rounded-xl border border-[#7024E3] shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        currentMode={currentMode}
        onModeChange={(mode) => { setCurrentMode(mode); setActivePage('home'); }}
        directory={directory}
        activeDossier={activeDossier}
        onSelectDossier={handleSelectDossier}
        onAddDossier={isMainAccount ? () => setIsAddDossierOpen(true) : undefined}
        pendingValidationCount={pendingCount}
        anomalyCount={anomalyCount}
        onOpenExcelImport={() => setIsExcelImportOpen(true)}
        unreadNotificationCount={unreadNotificationCount}
        onOpenNotifications={() => setIsNotificationPanelOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentUser={currentUser}
        onLogout={onLogout}
        isTreasuryPageActive={activePage === 'treasury'}
        onOpenTreasuryPage={() => setActivePage('treasury')}
      />

      {/* Main Body Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* ================= PAGE DÉDIÉE : TRÉSORERIE & STATISTIQUES ================= */}
        {activePage === 'treasury' && (
          <TreasuryPage
            entries={liveEntries}
            activeDossier={activeDossier}
            consolidated={isEntrepriseLevel ? dossiers : undefined}
            onOpenCreditReady={() => setIsCreditReadyOpen(true)}
            onOpenNewInvoice={() => setIsQuickInvoiceOpen(true)}
          />
        )}

        {/* ================= MODE ENTREPRENEUR ================= */}
        {activePage === 'home' && currentMode === 'simplified' && (
          <div className="space-y-6">
            {/* Agent conversationnel : seul contenu de cette vue, centré et agrandi
                (les statistiques de trésorerie ont leur propre page dédiée) */}
            <div className="max-w-4xl mx-auto">
              <ConversationalAgent
                activeDossier={activeDossier}
                userName={currentUser.name}
                onNewEntry={handleNewEntry}
                recentEntries={activeEntries}
                onOpenExcelImport={() => setIsExcelImportOpen(true)}
              />
            </div>
          </div>
        )}

        {/* ================= MODE COMPTABLE ================= */}
        {activePage === 'home' && currentMode === 'expert' && (
          <div className="space-y-5">
            {/* Expert Navigation Tabs Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E084A] text-white p-2 rounded-xl border border-[#3B1578] shadow-md">
              <div className="flex flex-wrap items-center gap-1.5">
                {isMainAccount && <button
                  onClick={() => setExpertTab('portfolio')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'portfolio' 
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' 
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Portefeuille Multi-Dossiers</span>
                </button>}

                <button
                  onClick={() => setExpertTab('journal')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                    expertTab === 'journal' 
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' 
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Journal & Validation en Lot</span>
                  {(pendingCount > 0 || anomalyCount > 0) && (
                    <span className="px-1.5 py-0.2 bg-[#F59E0B] text-white font-mono text-[11px] font-bold rounded-full">
                      {pendingCount + anomalyCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setExpertTab('invoices')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'invoices'
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs'
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Factures & Créances</span>
                </button>

                <button
                  onClick={() => setExpertTab('accounts')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'accounts'
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs'
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <ListTree className="w-4 h-4" />
                  <span>Plan comptable</span>
                </button>

                <button
                  onClick={() => setExpertTab('ledger')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'ledger' 
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' 
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  <span>Grand Livre & Balance</span>
                </button>

                <button
                  onClick={() => setExpertTab('financials')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'financials' 
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' 
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Bilan & Compte de Résultat</span>
                </button>

                <button
                  onClick={() => setExpertTab('tax')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    expertTab === 'tax' 
                      ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' 
                      : 'text-[#C4B5FD] hover:bg-[#2A0E68] hover:text-white'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>Fiscalité & TVA</span>
                </button>
              </div>

              {/* Right Side: Dossier Indicator */}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block pr-2">
                  <span className="text-[10.5px] font-mono text-[#A78BFA] uppercase tracking-wider block font-bold">
                    {activeDossier.isMain ? 'Entreprise' : 'Dossier'}
                  </span>
                  <span className="text-xs font-bold text-white">{activeDossier.name}</span>
                </div>
              </div>
            </div>

            {/* Expert View Content */}
            {expertTab === 'portfolio' && isMainAccount && (
              <MultiClientPortfolio
                dossiers={dossiers}
                activeDossier={activeDossier}
                entries={liveEntries}
                onSelectDossier={(d) => {
                  setActiveDossierId(d.id);
                  setExpertTab('journal');
                }}
              />
            )}

            {expertTab === 'journal' && (
              <JournalValidation
                entries={entries}
                activeDossier={activeDossier}
                currentUser={currentUser}
                onBatchValidate={handleBatchValidate}
                onEntryAction={handleEntryAction}
                onUpdateEntry={handleUpdateEntry}
                onViewAuditTrail={(entry) => setSelectedAuditEntry(entry)}
                onOpenExcelImport={() => setIsExcelImportOpen(true)}
              />
            )}

            {expertTab === 'invoices' && (
              <InvoicesPanel
                invoices={invoices.filter(i => i.clientDossierId === activeDossier.id)}
                entries={activeEntries}
                activeDossier={activeDossier}
                currentUser={currentUser}
                onInvoiceChanged={upsertInvoice}
                onEntriesChanged={mergeEntries}
                notify={showToast}
              />
            )}

            {expertTab === 'accounts' && (
              <ChartOfAccounts
                activeDossier={activeDossier}
                entries={activeEntries}
                canEdit
                onChanged={() => setPlanVersion(v => v + 1)}
                notify={showToast}
              />
            )}

            {expertTab === 'ledger' && (
              <GeneralLedger
                entries={liveEntries}
                activeDossier={activeDossier}
              />
            )}

            {expertTab === 'financials' && (
              <FinancialStatements
                entries={liveEntries}
                activeDossier={activeDossier}
              />
            )}

            {expertTab === 'tax' && (
              <TaxCompliance
                entries={liveEntries}
                activeDossier={activeDossier}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-[#EDE9FE] px-4 py-4 mt-8">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#534674] gap-3">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-[#1E084A]">Axe<span className="text-[#7024E3]">Compta</span></span>
            <span className="text-[#7024E3] font-bold">— MAÎTRISE • FIABILITÉ • PERFORMANCE</span>
            <span className="text-[#7C709A]">| Axe Digital (GROWTH KDO Services)</span>
          </div>
          <div className="flex items-center gap-4 text-[12px] font-mono text-[#7C709A]">
            <span>Espace OHADA (17 États)</span>
            <span>Système SYSCOHADA v2026</span>
            <span>UEMOA / CEMAC / RDC / Guinée</span>
          </div>
        </div>
      </footer>

      {/* Audit Trail Modal */}
      {selectedAuditEntry && (
        <AuditTrailModal
          entry={selectedAuditEntry}
          onClose={() => setSelectedAuditEntry(null)}
        />
      )}

      {/* Credit-Ready Financial Report Modal */}
      {isCreditReadyOpen && (
        <CreditReadyReport
          activeDossier={activeDossier}
          entries={liveEntries}
          onClose={() => setIsCreditReadyOpen(false)}
        />
      )}

      {/* Quick Invoicing & Receipt Modal */}
      {isQuickInvoiceOpen && (
        <QuickInvoiceModal
          activeDossier={activeDossier}
          issueDirectly
          onClose={() => setIsQuickInvoiceOpen(false)}
          onCreated={(inv, invEntries) => {
            upsertInvoice(inv);
            mergeEntries(invEntries);
            const issued = inv.status === 'validated';
            pushNotification(issued ? 'Facture émise' : 'Facture enregistrée', `Facture ${inv.number} (${inv.totalTTC.toLocaleString('fr-FR')} FCFA) ${issued ? 'émise et comptabilisée' : 'en attente de validation'}.`, issued ? 'success' : 'info', 'compta',
              { actionLabel: 'Voir les factures', actionPayload: { mode: 'expert', expertTab: 'invoices' } });
          }}
        />
      )}

      {/* Excel / Spreadsheet Importer Modal */}
      {isExcelImportOpen && (
        <ExcelImportModal
          isOpen={isExcelImportOpen}
          onClose={() => setIsExcelImportOpen(false)}
          activeDossier={activeDossier}
          dossiers={dossiers}
          onImportEntries={handleImportEntries}
        />
      )}

      {/* Notification Center & Sound Settings Panel */}
      <NotificationPanel
        isOpen={isNotificationPanelOpen}
        onClose={() => setIsNotificationPanelOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAll={handleClearAllNotifications}
        onNavigateAction={(payload) => {
          if (payload.mode) setCurrentMode(payload.mode);
          if (payload.expertTab) showExpertTab(payload.expertTab as typeof expertTab);
        }}
      />

      {/* Platform & Project Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={platformSettings}
        onUpdateSettings={handleUpdatePlatformSettings}
        dossiers={dossiers}
        activeDossier={activeDossier}
        onSelectDossier={(d) => handleSelectDossier(d.id)}
        onUpdateDossier={handleUpdateDossier}
        onDeleteDossier={handleDeleteDossier}
        entries={entries}
        onImportBackup={handleImportBackup}
        currentUser={currentUser}
      />

      {isAddDossierOpen && (
        <AddDossierModal onClose={() => setIsAddDossierOpen(false)} onCreated={handleDossierAdded} />
      )}
    </div>
  );
}
