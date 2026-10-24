import React, { useState } from 'react';
import { AppNotification, NotificationCategory } from '../types';
import { useTheme } from '../context/ThemeContext';
import { soundManager, SOUND_OPTIONS, SoundType } from '../utils/sound';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Play, 
  Sliders, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  ArrowRight, 
  X,
  ShieldAlert,
  Wallet,
  Building2,
  Settings2
} from 'lucide-react';

interface NotificationPanelProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onNavigateAction?: (payload: { mode?: 'simplified' | 'expert'; expertTab?: string }) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAll,
  onNavigateAction
}) => {
  const { isDark } = useTheme();
  const [filter, setFilter] = useState<'all' | 'unread' | 'alerts' | 'fiscal'>('all');
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  
  // Sound manager states
  const [currentSound, setCurrentSound] = useState<SoundType>(soundManager.getSoundType());
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'alerts') return n.type === 'warning' || n.type === 'error' || n.category === 'compta';
    if (filter === 'fiscal') return n.category === 'fiscal' || n.category === 'tresorerie';
    return true;
  });

  const handlePlaySoundTest = (specific?: SoundType) => {
    setIsPlayingTest(true);
    soundManager.play(specific || currentSound);
    setTimeout(() => setIsPlayingTest(false), 500);
  };

  const handleChangeSoundType = (type: SoundType) => {
    setCurrentSound(type);
    soundManager.setSoundType(type);
    soundManager.play(type);
  };

  const getCategoryIcon = (category: NotificationCategory, type: string) => {
    if (type === 'warning' || type === 'error') {
      return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    }
    switch (category) {
      case 'fiscal':
        return <Calendar className="w-4 h-4 text-[#8B5CF6]" />;
      case 'tresorerie':
        return <Wallet className="w-4 h-4 text-[#0EA5E9]" />;
      case 'ia':
        return <Sparkles className="w-4 h-4 text-[#10B981]" />;
      case 'compta':
      default:
        return <Building2 className="w-4 h-4 text-[#7024E3] dark:text-[#A78BFA]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 md:p-6 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Drawer / Modal */}
      <div 
        className={`relative z-10 w-full max-w-md sm:max-w-lg mt-14 sm:mt-12 rounded-2xl shadow-2xl border flex flex-col max-h-[88vh] overflow-hidden transition-all duration-200 ${
          isDark 
            ? 'bg-[#150A2A] border-[#3B2068] text-[#F3EFFF] shadow-black/80' 
            : 'bg-white border-[#DDD6FE] text-[#1E084A] shadow-purple-950/20'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EDE9FE] dark:border-[#2D1A54] flex items-center justify-between gap-3 bg-[#FAF8FF] dark:bg-[#1A0E34]">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 rounded-xl bg-[#7024E3]/10 dark:bg-[#7024E3]/25 text-[#7024E3] dark:text-[#C4B5FD]">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E11D48] text-white text-[11px] font-black rounded-full flex items-center justify-center font-mono animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black font-heading tracking-wide">
                  Centre de Notifications
                </h3>
                {unreadCount > 0 ? (
                  <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#E11D48]/15 text-[#E11D48] dark:text-[#FDA4AF]">
                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#059669] dark:text-[#34D399]">
                    À jour
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#7C709A] dark:text-[#A594C9] mt-0.5">
                Alertes SYSCOHADA, échéances fiscales et flux de trésorerie
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound Settings Toggle */}
            <button
              onClick={() => setShowSoundSettings(!showSoundSettings)}
              className={`p-2 rounded-xl border transition-all ${
                showSoundSettings
                  ? 'bg-[#7024E3] text-white border-[#7024E3]'
                  : 'bg-[#F5F3FF] dark:bg-[#20103E] border-[#DDD6FE] dark:border-[#35225E] text-[#534674] dark:text-[#C4B5FD] hover:text-[#7024E3]'
              }`}
              title="Configurer les sons de notification"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#EDE9FE] dark:hover:bg-[#2D1A54] text-[#7C709A] dark:text-[#A594C9] hover:text-[#1E084A] dark:hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Sound Settings Banner */}
        {showSoundSettings && (
          <div className="p-4 bg-[#F5F3FF] dark:bg-[#1F103A] border-b border-[#DDD6FE] dark:border-[#35225E] space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#7024E3] dark:text-[#C4B5FD] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Paramètres Sonores des Notifications
              </span>
              <button
                onClick={() => handlePlaySoundTest()}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  isPlayingTest
                    ? 'bg-[#10B981] text-white scale-95'
                    : 'bg-[#7024E3] text-white hover:bg-[#5B18C4] shadow-xs disabled:opacity-50'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isPlayingTest ? 'Lecture...' : 'Tester le son'}</span>
              </button>
            </div>

            {/* Sound Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SOUND_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleChangeSoundType(opt.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                    currentSound === opt.id
                      ? 'bg-white dark:bg-[#2C1852] border-[#7024E3] dark:border-[#A78BFA] shadow-xs'
                      : 'bg-white/60 dark:bg-[#180A2E]/60 border-[#EDE9FE] dark:border-[#2D1A54] hover:border-[#DDD6FE]'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold flex items-center gap-1.5 text-[#1E084A] dark:text-[#F3EFFF]">
                      {currentSound === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-[#7024E3] dark:bg-[#A78BFA]" />}
                      <span>{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-[#7C709A] dark:text-[#A594C9] leading-tight">
                      {opt.description}
                    </p>
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaySoundTest(opt.id);
                    }}
                    className="p-1 rounded hover:bg-[#F5F3FF] dark:hover:bg-[#3B2068] text-[#7024E3] dark:text-[#C4B5FD]"
                    title="Écouter cet extrait"
                  >
                    <Play className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>

          </div>
        )}

        {/* Filter Tabs & Quick Action Bar */}
        <div className="px-4 py-2.5 border-b border-[#EDE9FE] dark:border-[#2D1A54] flex flex-wrap items-center justify-between gap-2 text-xs bg-white dark:bg-[#150A2A]">
          <div className="flex items-center gap-1 p-0.5 bg-[#F5F3FF] dark:bg-[#1C0F38] rounded-xl border border-[#DDD6FE] dark:border-[#35225E]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filter === 'all'
                  ? 'bg-white dark:bg-[#2A1550] text-[#7024E3] dark:text-white shadow-2xs'
                  : 'text-[#7C709A] dark:text-[#9B88BF]'
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filter === 'unread'
                  ? 'bg-white dark:bg-[#2A1550] text-[#7024E3] dark:text-white shadow-2xs'
                  : 'text-[#7C709A] dark:text-[#9B88BF]'
              }`}
            >
              Non lues ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('alerts')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filter === 'alerts'
                  ? 'bg-white dark:bg-[#2A1550] text-[#7024E3] dark:text-white shadow-2xs'
                  : 'text-[#7C709A] dark:text-[#9B88BF]'
              }`}
            >
              Alertes OHADA
            </button>
            <button
              onClick={() => setFilter('fiscal')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filter === 'fiscal'
                  ? 'bg-white dark:bg-[#2A1550] text-[#7024E3] dark:text-white shadow-2xs'
                  : 'text-[#7C709A] dark:text-[#9B88BF]'
              }`}
            >
              Fiscal / Trésorerie
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-[12px] font-bold text-[#7024E3] dark:text-[#C4B5FD] hover:underline flex items-center gap-1"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tout marquer comme lu</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 max-h-[50vh] divide-y divide-[#F5F3FF] dark:divide-[#231444]">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F3FF] dark:bg-[#20103E] text-[#7024E3] dark:text-[#A78BFA] mx-auto flex items-center justify-center mb-3">
                <Bell className="w-6 h-6 opacity-60" />
              </div>
              <p className="text-xs font-bold text-[#534674] dark:text-[#C4B5FD]">
                Aucune notification dans cette catégorie
              </p>
              <p className="text-[12px] text-[#7C709A] dark:text-[#A594C9] mt-1">
                Toutes vos alertes comptables et fiscales sont traitées
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.read && onMarkAsRead(notif.id)}
                className={`pt-2.5 first:pt-0 group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                  !notif.read
                    ? isDark 
                      ? 'bg-[#1C0F38] border-[#3F2370] hover:border-[#7024E3]' 
                      : 'bg-[#F9F7FE] border-[#DDD6FE] hover:border-[#7024E3]'
                    : isDark 
                      ? 'bg-[#150A2A]/60 border-transparent hover:border-[#2D1A54] opacity-80' 
                      : 'bg-white border-transparent hover:border-[#EDE9FE] opacity-85'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div className={`p-2 rounded-xl shrink-0 ${
                    notif.type === 'warning' || notif.type === 'error'
                      ? 'bg-[#FEF3C7] dark:bg-[#3D2504] border border-[#FDE68A] dark:border-[#784807]'
                      : notif.type === 'success'
                      ? 'bg-[#DCFCE7] dark:bg-[#0E351F] border border-[#BBF7D0] dark:border-[#1A5B36]'
                      : 'bg-[#F5F3FF] dark:bg-[#26134A] border border-[#DDD6FE] dark:border-[#402377]'
                  }`}>
                    {getCategoryIcon(notif.category, notif.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                        !notif.read ? 'text-[#1E084A] dark:text-[#F3EFFF]' : 'text-[#534674] dark:text-[#C4B5FD]'
                      }`}>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-[#7024E3] dark:bg-[#A78BFA] shrink-0" />
                        )}
                        <span>{notif.title}</span>
                      </h4>
                      <span className="text-[11px] font-mono text-[#7C709A] dark:text-[#9B88BF] shrink-0">
                        {notif.timestamp}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#534674] dark:text-[#A594C9] mt-1 leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Action button if any */}
                    <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-[#EDE9FE]/60 dark:border-[#2D1A54]/60">
                      {notif.actionLabel && onNavigateAction ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notif.id);
                            if (notif.actionPayload) {
                              onNavigateAction(notif.actionPayload);
                            }
                            onClose();
                          }}
                          className="text-[12px] font-bold text-[#7024E3] dark:text-[#C4B5FD] hover:text-[#5B18C4] flex items-center gap-1 group/btn"
                        >
                          <span>{notif.actionLabel}</span>
                          <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                      ) : <div />}

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notif.id);
                            }}
                            className="p-1 rounded hover:bg-[#EDE9FE] dark:hover:bg-[#2D1A54] text-[11px] text-[#7024E3] dark:text-[#C4B5FD] font-bold"
                            title="Marquer comme lu"
                          >
                            Lu
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotification(notif.id);
                          }}
                          className="p-1 rounded hover:bg-[#FEE2E2] dark:hover:bg-[#3D141F] text-gray-400 hover:text-[#EF4444] transition-colors"
                          title="Supprimer cette alerte"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Demo Test & Sound indicator */}
        <div className="p-3 sm:p-4 bg-[#FAF8FF] dark:bg-[#1A0E34] border-t border-[#EDE9FE] dark:border-[#2D1A54] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#7C709A] dark:text-[#A594C9] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>
                Son : <strong>{SOUND_OPTIONS.find(o => o.id === currentSound)?.label}</strong> • volume max
              </span>
            </span>

            <button
              onClick={() => handlePlaySoundTest()}
              className="p-1 rounded hover:bg-[#EDE9FE] dark:hover:bg-[#2D1A54] text-[#7024E3] dark:text-[#C4B5FD]"
              title="Écouter le son par défaut"
            >
              <Play className="w-3 h-3 fill-current" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-[12px] text-gray-400 hover:text-[#EF4444] transition-colors p-1"
                title="Effacer toutes les notifications"
              >
                Effacer tout
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
