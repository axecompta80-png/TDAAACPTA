import React from 'react';
import { BrandLogo } from './BrandLogo';
import { ClientDossier } from '../types';
import { CurrentUser } from '../utils/authApi';
import {
  Building2,
  Store,
  ChevronDown,
  Check,
  FileSpreadsheet,
  Bell,
  Settings,
  LogOut,
  Wallet,
  ShieldCheck
} from 'lucide-react';

interface HeaderProps {
  currentMode: 'simplified' | 'expert';
  onModeChange: (mode: 'simplified' | 'expert') => void;
  dossiers: ClientDossier[];
  activeDossier: ClientDossier;
  onSelectDossier: (dossier: ClientDossier) => void;
  pendingValidationCount: number;
  anomalyCount: number;
  onOpenExcelImport?: () => void;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
  onOpenSettings?: () => void;
  currentUser?: CurrentUser;
  onLogout?: () => void;
  isTreasuryPageActive?: boolean;
  onOpenTreasuryPage?: () => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

const roleLabel: Record<CurrentUser['role'], string> = {
  ADMIN: 'Administrateur',
  COMPTABLE: 'Comptable',
};

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  dossiers,
  activeDossier,
  onSelectDossier,
  pendingValidationCount,
  anomalyCount,
  onOpenExcelImport,
  unreadNotificationCount = 0,
  onOpenNotifications,
  onOpenSettings,
  currentUser,
  onLogout,
  isTreasuryPageActive = false,
  onOpenTreasuryPage
}) => {
  const [dossierMenuOpen, setDossierMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Ferme les menus déroulants au clic extérieur, comportement attendu de tout menu contextuel.
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setDossierMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <header className="w-full bg-white/95 dark:bg-[#120726]/95 backdrop-blur-md border-b border-[#EDE9FE] dark:border-[#2C184D] px-4 lg:px-8 py-3.5 sticky top-0 z-40 shadow-xs transition-colors">
      <div ref={rootRef} className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-y-3 gap-x-4">
        {/* Zone 1 — Identité : logo + dossier en cours */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo variant="full" className="shrink-0" />

          <span className="hidden sm:block w-px h-8 bg-[#EDE9FE] dark:bg-[#2C184D] shrink-0" />

          <div className="relative shrink-0">
            <button
              onClick={() => { setDossierMenuOpen(v => !v); setUserMenuOpen(false); }}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 hover:bg-[#F5F3FF] dark:hover:bg-[#1C0F38] rounded-lg text-left transition-all"
            >
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wider text-[#7C709A] dark:text-[#A78BFA] font-bold">
                  Dossier
                </span>
                <span className="text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] truncate max-w-[160px] sm:max-w-[220px]">
                  {activeDossier.name}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-[#7024E3] dark:text-[#A78BFA] shrink-0 transition-transform ${dossierMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {dossierMenuOpen && (
              <div className="absolute left-0 mt-1.5 w-80 bg-white dark:bg-[#180D33] border border-[#DDD6FE] dark:border-[#35225E] shadow-xl z-50 rounded-xl py-1 overflow-hidden">
                <div className="px-3.5 py-2 border-b border-[#EDE9FE] dark:border-[#2D1A54] bg-[#F8F7FD] dark:bg-[#140A28]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#7024E3] dark:text-[#C4B5FD]">
                    Mes dossiers
                  </span>
                </div>
                {dossiers.map(d => {
                  const isSelected = d.id === activeDossier.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        onSelectDossier(d);
                        setDossierMenuOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs flex flex-col border-b border-[#F5F3FF] dark:border-[#231444] hover:bg-[#F5F3FF] dark:hover:bg-[#231444] transition-colors ${
                        isSelected ? 'bg-[#EDE9FE]/50 dark:bg-[#2D1855] font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E084A] dark:text-[#F3EFFF] flex items-center gap-1.5">
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#7024E3] dark:text-[#A78BFA]" />}
                          {d.name}
                        </span>
                        <span className="text-[11px] text-[#7024E3] dark:text-[#A78BFA] font-mono font-bold bg-[#EDE9FE] dark:bg-[#2A164F] px-1.5 py-0.5 rounded">
                          {d.country}
                        </span>
                      </div>
                      <span className="text-[12px] text-[#534674] dark:text-[#A594C9] truncate mt-0.5">{d.activity}</span>
                      <span className="text-[10px] text-[#7C709A] dark:text-[#8E7BB8] font-mono mt-0.5">RCCM: {d.rccm}</span>
                      {d.ownerName && currentUser && d.ownerId !== currentUser.id && (
                        <span className="text-[10px] text-[#7024E3] dark:text-[#C4B5FD] font-bold mt-0.5">Attribué par {d.ownerName}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Zone 2 — Navigation principale : bascule de persona, toujours centrée */}
        <div className="flex-1 flex justify-center order-3 basis-full lg:order-none lg:basis-auto">
          <div className="flex items-center gap-1.5 bg-[#F5F3FF] dark:bg-[#1C0F38] p-1.5 rounded-xl border border-[#DDD6FE] dark:border-[#35225E]">
            <button
              onClick={() => onModeChange('simplified')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                currentMode === 'simplified'
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-sm'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:text-[#1E084A] dark:hover:text-white hover:bg-[#EDE9FE] dark:hover:bg-[#2A174E]'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Mode Simple</span>
              <span className="sm:hidden">Simple</span>
            </button>

            <button
              onClick={() => onModeChange('expert')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all relative ${
                currentMode === 'expert'
                  ? 'bg-[#1E084A] dark:bg-[#2A1054] text-white shadow-sm'
                  : 'text-[#534674] dark:text-[#C4B5FD] hover:text-[#1E084A] dark:hover:text-white hover:bg-[#EDE9FE] dark:hover:bg-[#2A174E]'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Mode Avancé</span>
              <span className="sm:hidden">Avancé</span>
              {(pendingValidationCount > 0 || anomalyCount > 0) && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[11px] font-mono font-bold bg-[#F59E0B] text-white rounded-full shadow-xs">
                  {pendingValidationCount + anomalyCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Zone 3 — Actions & compte */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {onOpenTreasuryPage && (
            <button
              onClick={onOpenTreasuryPage}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                isTreasuryPageActive
                  ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white'
                  : 'border border-[#DDD6FE] dark:border-[#35225E] bg-[#F5F3FF] dark:bg-[#1C0F38] text-[#7024E3] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#2A174E]'
              }`}
              title="Trésorerie & Statistiques"
            >
              <Wallet className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Trésorerie</span>
            </button>
          )}

          {onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs"
              title="Importer un document Excel (.xlsx, .xls, .csv)"
            >
              <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
              <span className="hidden md:inline">Importer Excel</span>
            </button>
          )}

          <button
            onClick={onOpenNotifications}
            className="relative p-2.5 rounded-xl border border-[#DDD6FE] dark:border-[#35225E] bg-[#F5F3FF] dark:bg-[#1C0F38] text-[#7024E3] dark:text-[#C4B5FD] hover:bg-[#EDE9FE] dark:hover:bg-[#2A174E] transition-all shadow-2xs"
            title="Centre de notifications et alertes sonores"
            aria-label="Centre de notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#E11D48] text-white text-[11px] font-black rounded-full flex items-center justify-center font-mono shadow-xs animate-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {/* Menu compte : regroupe identité, paramètres et déconnexion pour ne pas multiplier les icônes */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => { setUserMenuOpen(v => !v); setDossierMenuOpen(false); }}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl border border-[#DDD6FE] dark:border-[#35225E] bg-[#F5F3FF] dark:bg-[#1C0F38] hover:bg-[#EDE9FE] dark:hover:bg-[#2A174E] transition-all shadow-2xs"
                title={currentUser.email}
              >
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7024E3] to-[#8B5CF6] text-white text-[12px] font-black flex items-center justify-center shrink-0">
                  {getInitials(currentUser.name)}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#7024E3] dark:text-[#A78BFA] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-[#180D33] border border-[#DDD6FE] dark:border-[#35225E] shadow-xl z-50 rounded-xl py-1.5 overflow-hidden">
                  <div className="px-3.5 py-2.5 border-b border-[#EDE9FE] dark:border-[#2D1A54]">
                    <span className="block text-xs font-bold text-[#1E084A] dark:text-[#F3EFFF] truncate">
                      {currentUser.name}
                    </span>
                    <span className="block text-[11px] text-[#7C709A] dark:text-[#A594C9] truncate">
                      {currentUser.email}
                    </span>
                    <span className="inline-block mt-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#EDE9FE] dark:bg-[#2A164F] text-[#7024E3] dark:text-[#C4B5FD] rounded">
                      {roleLabel[currentUser.role]}
                    </span>
                  </div>

                  {currentUser.role === 'ADMIN' && (
                    <a
                      href="/admin"
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-[#7024E3] dark:text-[#C4B5FD] hover:bg-[#F5F3FF] dark:hover:bg-[#231444] transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Espace admin</span>
                    </a>
                  )}

                  {onOpenSettings && (
                    <button
                      onClick={() => { setUserMenuOpen(false); onOpenSettings(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-[#534674] dark:text-[#C4B5FD] hover:bg-[#F5F3FF] dark:hover:bg-[#231444] hover:text-[#1E084A] dark:hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Paramètres de la plateforme</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      onClick={() => { setUserMenuOpen(false); onLogout(); }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold text-[#534674] dark:text-[#C4B5FD] hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Se déconnecter</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
