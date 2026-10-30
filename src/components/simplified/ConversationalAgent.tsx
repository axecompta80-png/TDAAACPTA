import React, { useState, useRef, useEffect } from 'react';
import { JournalEntry, ClientDossier } from '../../types';
import { 
  Send, 
  Mic, 
  Square, 
  Camera, 
  UploadCloud, 
  Smartphone, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  HelpCircle, 
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Trash2,
  Volume2
} from 'lucide-react';
import { useSpeechRecognition } from '../../utils/useSpeechRecognition';
import { VoiceStudioPanel } from './VoiceStudioPanel';
import { soundManager } from '../../utils/sound';

interface ConversationalAgentProps {
  activeDossier: ClientDossier;
  /** Nom du compte connecté, utilisé pour la salutation de l'agent. */
  userName?: string;
  /** Enregistre l'écriture ; retourne false si l'enregistrement a échoué. */
  /** Renvoie l'écriture enregistrée (statut définitif), ou null en cas d'échec. */
  onNewEntry: (entry: JournalEntry) => Promise<JournalEntry | null>;
  recentEntries: JournalEntry[];
  onOpenExcelImport?: () => void;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'agent';
  time: string;
  text: string;
  entries?: JournalEntry[];
  type?: 'text' | 'voice' | 'photo' | 'mobile_money';
  audioDuration?: string;
  photoUrl?: string;
  documentName?: string;
  quickActions?: string[];
}

/** Salutation de l'agent : utilise le nom du compte connecté, jamais celui du gérant du dossier. */
function buildGreetingMessage(dossier: ClientDossier, displayName?: string): MessageItem {
  const who = (displayName && displayName.trim()) || dossier.managerName;
  return {
    id: `msg-init-${dossier.id}`,
    sender: 'agent',
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    text: `Bonjour ${who} ! Je suis votre agent AxeCompta. Qu'avez-vous vendu ou acheté aujourd'hui pour ${dossier.name} ? Dites-moi aussi comment c'était payé (espèces, chèque, virement, Orange Money, MTN, Wave, Moov) : j'enregistre dans le bon compte. Vous pouvez écrire, parler, coller un SMS Mobile Money, photographier un reçu ou me poser une question sur vos chiffres.`,
    quickActions: ["Combien j'ai en caisse ?", 'Mes ventes du mois', "Qui me doit de l'argent ?"]
  };
}

type UploadedDocument = { data: string; mimeType: string };

// Réduit les photos de reçus (max 1600 px) pour un envoi rapide sur réseau mobile
async function prepareDocument(file: File): Promise<{ previewUrl?: string; document: UploadedDocument }> {
  const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  if (file.type === 'application/pdf') {
    const dataUrl = await readAsDataUrl(file);
    return { document: { data: dataUrl.split(',')[1], mimeType: file.type } };
  }

  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = original;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const resized = canvas.toDataURL('image/jpeg', 0.85);
    return { previewUrl: resized, document: { data: resized.split(',')[1], mimeType: 'image/jpeg' } };
  } catch {
    // Format non décodable par le navigateur : on envoie le fichier tel quel
    return { previewUrl: original, document: { data: original.split(',')[1], mimeType: file.type || 'image/jpeg' } };
  }
}

export const ConversationalAgent: React.FC<ConversationalAgentProps> = ({
  activeDossier,
  onNewEntry,
  recentEntries,
  onOpenExcelImport,
  userName
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'voice' | 'photo' | 'sms'>('chat');
  const [smsRawText, setSmsRawText] = useState('');
  const [showTechnicalSYSCOHADA, setShowTechnicalSYSCOHADA] = useState<Record<string, boolean>>({});
  
  // Real-time microphone speech recognition hook
  const speech = useSpeechRecognition();
  
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<MessageItem[]>(() => [buildGreetingMessage(activeDossier, userName)]);
  // Message en attente de précision (ex : montant manquant) : la réponse suivante le complète
  const [pendingText, setPendingText] = useState<string | undefined>();

  // La salutation suit l'utilisateur connecté et le dossier actif : elle est reconstruite à chaque changement.
  useEffect(() => {
    setMessages(prev => [buildGreetingMessage(activeDossier, userName), ...prev.filter(m => !m.id.startsWith('msg-init'))]);
    setPendingText(undefined);
  }, [activeDossier.id, userName]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, speech.isListening]);

  // Voice recording toggle via Web Speech API & Microphone
  const handleToggleVoiceInput = async () => {
    if (!speech.isListening) {
      soundManager.play('crystal_bell');
      await speech.startListening();
    } else {
      const transcribedText = speech.stopListening();
      const minutes = Math.floor(speech.elapsedSeconds / 60);
      const seconds = speech.elapsedSeconds % 60;
      const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      
      if (transcribedText.trim()) {
        soundManager.play('fintech_chime');
        handleProcessInput(transcribedText.trim(), 'voice', durationStr);
      }
    }
  };

  const handleStopVoiceAndSubmit = () => {
    const transcribedText = speech.stopListening();
    const minutes = Math.floor(speech.elapsedSeconds / 60);
    const seconds = speech.elapsedSeconds % 60;
    const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (transcribedText.trim()) {
      soundManager.play('fintech_chime');
      handleProcessInput(transcribedText.trim(), 'voice', durationStr);
    }
  };

  // Envoie le message à l'agent : il comprend une opération, répond à une question ou demande une précision
  const handleProcessInput = async (
    textToProcess: string,
    inputType: 'text' | 'voice' | 'photo' | 'mobile_money' = 'text',
    duration?: string,
    upload?: { previewUrl?: string; document: UploadedDocument; fileName: string },
    fresh: boolean = false
  ) => {
    if (!textToProcess.trim() && !upload) return;

    const nowTime = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, {
      id: `usr-${Date.now()}`,
      sender: 'user',
      time: nowTime(),
      text: textToProcess || (upload ? 'Document envoyé' : ''),
      type: inputType,
      audioDuration: duration,
      photoUrl: upload?.previewUrl,
      documentName: upload && !upload.previewUrl ? upload.fileName : undefined
    }]);
    setInputText('');
    setIsLoading(true);

    const addAgentMessage = (msg: Omit<MessageItem, 'id' | 'sender' | 'time'>) =>
      setMessages(prev => [...prev, { id: `agt-${Date.now()}-${Math.random()}`, sender: 'agent', time: nowTime(), ...msg }]);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId: activeDossier.id,
          message: textToProcess,
          inputType: upload ? 'photo' : inputType,
          pendingText: fresh || upload ? undefined : pendingText,
          image: upload?.document
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPendingText(undefined);
        addAgentMessage({ text: result.error || `Je n'ai pas pu traiter ce message (erreur ${response.status}).` });
        return;
      }

      setPendingText(result.pendingText);
      const entries: JournalEntry[] = result.entries ?? [];

      if (entries.length > 0) {
        let failed = 0;
        const savedEntries: JournalEntry[] = [];
        for (const entry of entries) {
          const saved = await onNewEntry(entry);
          if (saved) savedEntries.push(saved); else failed++;
        }
        addAgentMessage({
          text: failed
            ? `${result.reply}\n\n⚠️ ${failed} écriture(s) n'ont pas pu être enregistrées. Réessayez dans un instant.`
            : result.reply,
          entries: savedEntries,
          quickActions: result.quickActions
        });
      } else {
        addAgentMessage({ text: result.reply || "Je n'ai rien à enregistrer pour ce message.", quickActions: result.quickActions });
      }
    } catch (err) {
      console.error(err);
      setPendingText(undefined);
      addAgentMessage({ text: "Connexion impossible pour le moment : rien n'a été enregistré. Vérifiez votre réseau et réessayez." });
    } finally {
      setIsLoading(false);
    }
  };

  // Photo ou PDF : envoyé tel quel à l'agent qui lit le document (fournisseur, date, TVA, total)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const prepared = await prepareDocument(file);
      setActiveTab('chat');
      await handleProcessInput(inputText.trim(), 'photo', undefined, { ...prepared, fileName: file.name }, true);
    } catch {
      setMessages(prev => [...prev, {
        id: `agt-${Date.now()}`, sender: 'agent',
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        text: "Impossible de lire ce fichier. Essayez une photo JPEG/PNG ou un PDF."
      }]);
    }
  };

  // Quick preset shortcuts
  const PRESET_PROMPTS = [
    "J'ai vendu 3 sacs de ciment à 5000F, payé cash",
    "Paiement facture CIE électricité 48 500F par Orange Money",
    "Achat 15 paquets de fer à béton chez Sotaci 180 000F par virement",
    "Retrait espèces 350 000F sans justificatif précis",
    "Combien j'ai en caisse ?",
    "Puis-je payer mon loyer ce mois-ci ?"
  ];

  return (
    <div className="flex flex-col w-full min-w-0 h-[calc(100vh-220px)] min-h-[560px] max-h-[840px] bg-white border border-[#DDD6FE] rounded-2xl shadow-xs overflow-hidden">
      {/* Top Bar: Conversational WhatsApp-like Header */}
      <div className="bg-[#1E084A] text-white px-5 py-3.5 border-b border-[#3B1578] flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar Agent */}
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-white border border-white/20 flex items-center justify-center shadow-xs overflow-hidden p-1">
              <img src="/logo.png" alt="AxeCompta" className="w-full h-full object-contain" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10B981] border-2 border-[#1E084A] rounded-full" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-bold text-white leading-tight">
                Agent AxeCompta
              </h3>
              <span className="px-2 py-0.5 bg-[#7024E3] text-white text-[10.5px] font-bold uppercase rounded font-mono">
                IA OHADA
              </span>
            </div>
            <p className="text-[12px] text-[#C4B5FD] flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Prêt pour vos ventes, achats et reçus (WhatsApp & Web)
            </p>
          </div>
        </div>

        {/* Action Tabs for input modalities */}
        <div className="flex items-center justify-center gap-1 self-center max-w-full bg-[#2A0E68] p-1.5 rounded-xl border border-white/10 shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)] overflow-x-auto">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all shrink-0 ${
              activeTab === 'chat' ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            Direct
          </button>
          <button
            onClick={() => setActiveTab('voice')}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
              activeTab === 'voice' ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>Dictée Vocale</span>
            {speech.isListening && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('photo')}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
              activeTab === 'photo' ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>Reçu / Photo</span>
          </button>
          <button
            onClick={() => setActiveTab('sms')}
            className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
              activeTab === 'sms' ? 'bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white shadow-xs' : 'text-[#C4B5FD] hover:text-white'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>SMS MoMo</span>
          </button>
          {onOpenExcelImport && (
            <button
              onClick={onOpenExcelImport}
              className="px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all bg-[#10B981]/20 hover:bg-[#10B981] text-[#34D399] hover:text-white border border-[#10B981]/40 shrink-0"
              title="Importer un fichier Excel (.xlsx, .csv)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Tableur Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversation Feed */}
      <div 
        ref={chatScrollRef}
        className="flex-1 min-w-0 p-5 overflow-y-auto overflow-x-hidden space-y-4 bg-brand-mesh"
      >
        {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          return (
            <div
              key={msg.id}
              className={`flex flex-col w-full min-w-0 ${isAgent ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[78%] min-w-0 overflow-hidden break-words p-4 text-sm ${
                  isAgent
                    ? 'bg-gradient-to-br from-[#1E084A] to-[#2E1065] text-white rounded-bubble-agent border border-[#3B1578] shadow-xs'
                    : 'bg-white text-[#1E084A] rounded-bubble-user border border-[#DDD6FE] shadow-2xs'
                }`}
              >
                {/* Voice note layout */}
                {msg.type === 'voice' && (
                  <div className={`flex items-center justify-between gap-2.5 mb-2.5 pb-2 border-b ${isAgent ? 'border-white/20' : 'border-[#EDE9FE]'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#7024E3] text-white flex items-center justify-center shadow-xs">
                        <Mic className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold">Dictée vocale transcrite</span>
                        <span className="text-[12px] opacity-75">({msg.audioDuration || '00:04'})</span>
                      </div>
                    </div>
                    {/* Audio track waveform visual representation */}
                    <div className="flex items-center gap-0.5 h-3.5 px-2 py-0.5 bg-[#EDE9FE] rounded-full">
                      {[6, 12, 8, 14, 10, 15, 9, 13, 7, 11].map((h, i) => (
                        <span
                          key={i}
                          className="w-0.5 bg-[#7024E3] rounded-full"
                          style={{ height: `${h}px` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Photo attached */}
                {msg.photoUrl && (
                  <div className="mb-2.5 rounded-xl overflow-hidden border border-white/20 shadow-xs">
                    <img 
                      src={msg.photoUrl} 
                      alt="Reçu scanné" 
                      className="w-full max-h-48 object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {msg.documentName && (
                  <div className="mb-2.5 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-[12px] flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{msg.documentName}</span>
                  </div>
                )}

                <p className="leading-relaxed font-normal whitespace-pre-line break-words [overflow-wrap:anywhere]">{msg.text}</p>

                {/* Generated SYSCOHADA Entry Card if present */}
                {(msg.entries ?? []).map(entry => (
                  <div key={entry.id} className={`mt-3 pt-3 border-t text-xs ${isAgent ? 'border-white/15' : 'border-[#EDE9FE]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {entry.status === 'validated' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#10B981] text-white font-bold text-[11px] rounded">
                            <CheckCircle2 className="w-3 h-3" /> Validée
                          </span>
                        )}
                        {entry.status === 'pending_review' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#F59E0B] text-[#1E084A] font-bold text-[11px] rounded">
                            <Clock className="w-3 h-3" /> À vérifier
                          </span>
                        )}
                        {entry.status === 'anomaly' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#EF4444] text-white font-bold text-[11px] rounded">
                            <AlertTriangle className="w-3 h-3" /> Anomalie signalée
                          </span>
                        )}
                      </div>

                      <span className="font-tabular font-extrabold text-base tracking-tight text-[#A78BFA]">
                        {entry.amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>

                    {entry.detectedAnomaly && (
                      <div className="bg-[#EF4444]/20 text-[#FCA5A5] p-2.5 rounded-lg my-2 text-[12px] flex items-start gap-2 border border-[#EF4444]/40">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#F87171]" />
                        <span>{entry.detectedAnomaly}</span>
                      </div>
                    )}

                    {/* Toggle accounting details */}
                    <div className="mt-2">
                      <button
                        onClick={() => setShowTechnicalSYSCOHADA(prev => ({ ...prev, [msg.id + entry.id]: !prev[msg.id + entry.id] }))}
                        className="text-[11px] font-semibold underline flex items-center gap-1 text-[#C4B5FD] hover:text-white transition-colors"
                      >
                        {showTechnicalSYSCOHADA[msg.id + entry.id] ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        <span>{showTechnicalSYSCOHADA[msg.id + entry.id] ? 'Masquer écriture SYSCOHADA' : 'Voir imputation comptable OHADA'}</span>
                      </button>

                      {showTechnicalSYSCOHADA[msg.id + entry.id] && (
                        <div className="mt-2 p-2.5 bg-[#130432] text-white rounded-lg font-mono text-[11px] space-y-1.5 border border-[#3B1578] overflow-hidden break-words">
                          {entry.lines.map((l, i) => (
                            <div key={i} className="flex justify-between">
                              <span className={l.debit ? 'text-[#A78BFA] font-bold' : 'text-[#C4B5FD]'}>
                                {l.debit ? 'Débit' : 'Crédit'} : {l.accountCode}{l.accountLabel ? ` - ${l.accountLabel}` : ''}
                              </span>
                              <span className="text-[#10B981] font-bold">{(l.debit || l.credit).toLocaleString('fr-FR')} F</span>
                            </div>
                          ))}
                          <div className="text-[10px] text-[#A78BFA]/80 pt-1 border-t border-[#3B1578]">
                            Réf pièce: {entry.pieceRef} • Conforme SYSCOHADA Révisé
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}


                {isAgent && msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {msg.quickActions.map(q => (
                      <button
                        key={q}
                        onClick={() => handleProcessInput(q, 'text', undefined, undefined, true)}
                        disabled={isLoading}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                <span
                  className={`block text-[10px] mt-1.5 font-mono ${
                    isAgent ? 'text-[#C4B5FD]' : 'text-[#7C709A]'
                  }`}
                >
                  {msg.time}
                </span>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start">
            <div className="p-3.5 bg-[#1E084A] text-white border border-[#3B1578] rounded-bubble-agent text-xs flex items-center gap-2.5 shadow-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-[#7024E3]" />
              <span>AxeCompta lit votre message et prépare l'écriture SYSCOHADA...</span>
            </div>
          </div>
        )}
      </div>

      {/* Modality View: Voice Studio */}
      {activeTab === 'voice' && (
        <VoiceStudioPanel
          speech={speech}
          onSubmitVoiceEntry={(spokenText, durationStr) => {
            handleProcessInput(spokenText, 'voice', durationStr);
            setActiveTab('chat');
          }}
          onCancel={() => setActiveTab('chat')}
          dossierName={activeDossier.name}
        />
      )}

      {/* Modality View: Photo/Receipt Dropzone */}
      {activeTab === 'photo' && (
        <div className="p-4 bg-[#FAF8FF] border-t border-[#DDD6FE] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E084A] flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#7024E3]" />
              Scanner un Reçu, une Facture ou un PDF
            </span>
            <button 
              onClick={() => setActiveTab('chat')} 
              className="text-xs text-[#7024E3] underline hover:text-[#5B18C4]"
            >
              Retour au chat
            </button>
          </div>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#7024E3]/40 bg-white p-6 text-center cursor-pointer hover:bg-[#F5F3FF] rounded-xl transition-all"
          >
            <UploadCloud className="w-8 h-8 text-[#7024E3] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#1E084A]">Cliquez pour sélectionner un reçu ou glissez une photo</p>
            <p className="text-[12px] text-[#7C709A] mt-1">Lecture automatique : fournisseur, date, TVA, total. Ajoutez le mode de paiement dans le message si le reçu ne le dit pas.</p>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*,application/pdf" 
              className="hidden" 
              onChange={handlePhotoUpload}
            />
          </div>
        </div>
      )}

      {/* Modality View: Mobile Money SMS Import */}
      {activeTab === 'sms' && (
        <div className="p-4 bg-[#FAF8FF] border-t border-[#DDD6FE] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E084A] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#7024E3]" />
              Coller un SMS Mobile Money (Orange Money, MTN, Wave)
            </span>
            <button 
              onClick={() => setActiveTab('chat')} 
              className="text-xs text-[#7024E3] underline hover:text-[#5B18C4]"
            >
              Retour au chat
            </button>
          </div>
          <textarea
            value={smsRawText}
            onChange={(e) => setSmsRawText(e.target.value)}
            placeholder="Ex: 'Vous avez reçu 35000 FCFA de KOUADIO MARCEL. Solde restant 240000 FCFA. Ref: MP260914.0921.A0012' ou 'Paiement Wave de 18500 FCFA effectué...'"
            rows={2}
            className="w-full text-xs p-2.5 bg-white border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
          />
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (smsRawText.trim()) {
                  handleProcessInput(smsRawText, 'mobile_money', undefined, undefined, true);
                  setSmsRawText('');
                  setActiveTab('chat');
                }
              }}
              disabled={!smsRawText.trim()}
              className="px-4 py-2 bg-[#7024E3] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 hover:bg-[#5B18C4] transition-colors"
            >
              Analyser le SMS & Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Preset Quick Chips */}
      <div className="px-4 py-2.5 bg-[#F5F3FF] border-t border-[#EDE9FE] flex items-center gap-2 overflow-x-auto whitespace-nowrap max-w-full min-w-0">
        <span className="text-[11px] uppercase font-bold text-[#7C709A] shrink-0">
          Exemples :
        </span>
        {onOpenExcelImport && (
          <button
            onClick={onOpenExcelImport}
            className="px-2.5 py-1 bg-[#10B981]/15 text-[#065F46] hover:bg-[#10B981] hover:text-white border border-[#10B981]/30 text-[12px] font-bold rounded-lg transition-all shadow-2xs shrink-0 flex items-center gap-1"
          >
            <FileSpreadsheet className="w-3 h-3" />
            <span>Importer fichier Excel (.xlsx)</span>
          </button>
        )}
        {PRESET_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleProcessInput(prompt, 'text', undefined, undefined, true)}
            className="px-2.5 py-1 bg-white text-[#1E084A] hover:bg-[#7024E3] hover:text-white border border-[#DDD6FE] text-[12px] font-medium rounded-lg transition-all shadow-2xs shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Microphone Permission Warning if denied */}
      {speech.permissionStatus === 'denied' && (
        <div className="px-4 py-2 bg-[#FEF2F2] border-t border-[#FCA5A5] text-[#991B1B] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span>{speech.permissionError || "Microphone non autorisé : veuillez autoriser le micro dans votre navigateur pour dicter vos écritures."}</span>
          </div>
          <button
            onClick={() => speech.startListening()}
            className="px-2.5 py-1 bg-[#EF4444] text-white rounded text-[12px] font-bold hover:bg-[#DC2626] transition-colors shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3.5 bg-white border-t border-[#DDD6FE] flex items-center gap-2.5">
        {/* Voice Note Microphone Button */}
        <button
          type="button"
          onClick={handleToggleVoiceInput}
          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
            speech.isListening
              ? 'bg-[#EF4444] text-white animate-pulse ring-2 ring-[#EF4444]/30 border-[#EF4444]'
              : 'bg-[#F5F3FF] text-[#7024E3] border-[#DDD6FE] hover:bg-[#EDE9FE]'
          }`}
          title={speech.isListening ? 'Arrêter et imputer la dictée' : 'Dicter oralement une opération (Microphone)'}
        >
          {speech.isListening ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
        </button>

        {speech.isListening ? (
          <div className="flex-1 min-w-0 px-3.5 py-2 bg-gradient-to-r from-[#1E084A] to-[#2E1065] border border-[#3B1578] text-white rounded-xl text-xs flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping shrink-0" />
              <div className="flex items-center gap-1 shrink-0">
                <span className="font-bold text-[#A78BFA] hidden sm:inline">Microphone :</span>
                {/* Audio visualizer bars bouncing dynamically */}
                <div className="flex items-center gap-0.5 h-4 px-1">
                  {[4, 9, 14, 11, 15, 12, 7, 13, 8].map((h, i) => {
                    const dynamic = Math.max(3, Math.min(16, Math.round(h * (0.3 + (speech.audioLevel / 65)))));
                    return (
                      <span
                        key={i}
                        className="w-1 bg-[#10B981] rounded-full transition-all duration-75"
                        style={{ height: `${dynamic}px` }}
                      />
                    );
                  })}
                </div>
              </div>
              <p className="truncate text-white font-medium pl-1 text-[12px] sm:text-xs">
                {speech.fullTranscript ? (
                  <span className="font-semibold text-white">"{speech.fullTranscript}"</span>
                ) : (
                  <span className="italic text-[#C4B5FD]">Parlez maintenant (ex: Vente de 3 cartons à 15 000 FCFA cash)...</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-xs bg-[#130432] text-[#A78BFA] px-2 py-0.5 rounded border border-[#3B1578]">
                {String(Math.floor(speech.elapsedSeconds / 60)).padStart(2, '0')}:
                {String(speech.elapsedSeconds % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => speech.cancelListening()}
                className="p-1 text-[#C4B5FD] hover:text-[#EF4444] transition-colors"
                title="Annuler l'enregistrement"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleStopVoiceAndSubmit}
                disabled={!speech.fullTranscript.trim()}
                className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] disabled:opacity-40 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1 shadow-2xs"
                title="Valider la dictée et imputer l'écriture"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Valider</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleProcessInput(inputText, 'text');
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ex : 'J'ai vendu 5 sacs à 18 000F par Orange Money' — ou posez une question : 'Combien j'ai en caisse ?'"
              className="flex-1 bg-[#F8F7FD] text-[#1E084A] text-xs lg:text-sm px-4 py-2.5 border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30 placeholder:text-[#9B8EB9]"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="px-4 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white hover:from-[#5B18C4] hover:to-[#7024E3] disabled:opacity-50 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Envoyer</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
