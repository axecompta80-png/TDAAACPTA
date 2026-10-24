import React, { useState } from 'react';
import { 
  Mic, 
  Square, 
  Send, 
  RotateCcw, 
  Sparkles, 
  Volume2, 
  Globe, 
  AlertCircle, 
  CheckCircle2, 
  Edit3,
  HelpCircle
} from 'lucide-react';
import { UseSpeechRecognitionReturn, SUPPORTED_LANGUAGES } from '../../utils/useSpeechRecognition';
import { soundManager } from '../../utils/sound';

interface VoiceStudioPanelProps {
  speech: UseSpeechRecognitionReturn;
  onSubmitVoiceEntry: (text: string, durationStr: string) => void;
  onCancel?: () => void;
  dossierName: string;
}

export const VoiceStudioPanel: React.FC<VoiceStudioPanelProps> = ({
  speech,
  onSubmitVoiceEntry,
  onCancel,
  dossierName
}) => {
  const [editableText, setEditableText] = useState('');
  const [isEditingManually, setIsEditingManually] = useState(false);

  // Sync speech transcript into editable text when updated
  React.useEffect(() => {
    if (!isEditingManually && speech.fullTranscript) {
      setEditableText(speech.fullTranscript);
    }
  }, [speech.fullTranscript, isEditingManually]);

  const handleStart = async () => {
    soundManager.play('crystal_bell');
    setIsEditingManually(false);
    await speech.startListening();
  };

  const handleStopAndSend = () => {
    const finalTranscript = speech.stopListening();
    const textToSend = isEditingManually ? editableText : (finalTranscript || editableText);
    
    if (textToSend.trim()) {
      soundManager.play('fintech_chime');
      const minutes = Math.floor(speech.elapsedSeconds / 60);
      const seconds = speech.elapsedSeconds % 60;
      const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      onSubmitVoiceEntry(textToSend.trim(), durationStr);
    }
  };

  const handleApplyPreset = (presetText: string) => {
    setEditableText(presetText);
    speech.setTranscript(presetText);
    setIsEditingManually(true);
    soundManager.play('crystal_bell');
  };

  const ORAL_SYSCOHADA_PRESETS = [
    "J'ai vendu 4 sacs de riz à 18 500 FCFA payé en espèces à la boutique",
    "Encaissement Wave de 65 000 FCFA pour livraison de peinture",
    "Achat de carburant camion 15 000 FCFA payé par Orange Money",
    "Paiement facture d'électricité CIE 34 000 FCFA réglé en espèces",
    "Achat 10 sacs de ciment à 45 000 FCFA réglé par virement bancaire",
    "Retrait caisse de 50 000 FCFA pour avance sur salaire de l'employé"
  ];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Generate 20 audio visualizer bars based on speech.audioLevel
  const visualizerBars = Array.from({ length: 24 }).map((_, i) => {
    // Dynamic height calculation with wave dispersion
    const centerFactor = 1 - Math.abs(i - 12) / 12;
    const baseHeight = speech.isListening ? 15 : 8;
    const dynamicLevel = speech.isListening 
      ? Math.max(8, Math.min(100, (speech.audioLevel * 0.9 * centerFactor) + (Math.sin(i + Date.now() / 200) * 12)))
      : 8;
    return Math.round(dynamicLevel + baseHeight);
  });

  return (
    <div className="p-5 bg-gradient-to-b from-[#FAF8FF] to-[#F5F3FF] border-t border-[#DDD6FE] space-y-4">
      {/* Header bar with Language selection & status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EDE9FE]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#7024E3] text-white flex items-center justify-center shadow-xs">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#1E084A] flex items-center gap-1.5">
              <span>Dictée Vocale OHADA pour {dossierName}</span>
              <span className="px-1.5 py-0.5 bg-[#EDE9FE] text-[#7024E3] text-[10px] font-mono rounded font-bold">
                Microphone actif
              </span>
            </h4>
            <p className="text-[12px] text-[#7C709A]">
              Parlez naturellement : l'IA extrait montants, tiers et impute les comptes SYSCOHADA.
            </p>
          </div>
        </div>

        {/* Language selector & permission status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[12px] text-[#1E084A] bg-white border border-[#DDD6FE] px-2.5 py-1 rounded-lg">
            <Globe className="w-3.5 h-3.5 text-[#7024E3]" />
            <select
              value={speech.language}
              onChange={(e) => speech.setLanguage(e.target.value)}
              className="bg-transparent font-medium text-xs focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-[#7C709A] hover:text-[#1E084A] px-2 py-1 rounded hover:bg-[#EDE9FE] transition-colors"
            >
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Permission alert if denied */}
      {speech.permissionStatus === 'denied' && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF4444]" />
          <div className="flex-1">
            <p className="font-bold">Accès au microphone bloqué</p>
            <p className="text-[12px] mt-0.5">
              {speech.permissionError || "Veuillez autoriser l'accès au microphone dans la barre d'adresse de votre navigateur pour dicter vos écritures comptables."}
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-2.5 py-1 bg-[#EF4444] text-white text-[12px] font-bold rounded-lg hover:bg-[#DC2626] transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Central Visualizer & Recording Controls */}
      <div className="bg-white rounded-2xl p-5 border border-[#DDD6FE] shadow-2xs flex flex-col items-center justify-center text-center space-y-4">
        {/* Animated Waveform Visualizer */}
        <div className="h-16 w-full max-w-md flex items-center justify-center gap-1 px-4 bg-[#F8F7FD] rounded-xl border border-[#EDE9FE]">
          {visualizerBars.map((height, idx) => (
            <div
              key={idx}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                speech.isListening
                  ? 'bg-gradient-to-t from-[#7024E3] to-[#A78BFA]'
                  : 'bg-[#DDD6FE]'
              }`}
              style={{
                height: `${Math.max(6, Math.min(60, height))}px`,
                opacity: speech.isListening ? 0.7 + (height / 120) : 0.4
              }}
            />
          ))}
        </div>

        {/* Big Microphone Push Button */}
        <div className="relative">
          {speech.isListening && (
            <div className="absolute inset-0 -m-3 rounded-full bg-[#EF4444]/20 animate-ping" />
          )}
          <button
            onClick={speech.isListening ? speech.stopListening : handleStart}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center text-white transition-all shadow-md active:scale-95 ${
              speech.isListening
                ? 'bg-[#EF4444] hover:bg-[#DC2626] ring-4 ring-[#EF4444]/30'
                : 'bg-gradient-to-tr from-[#7024E3] to-[#9333EA] hover:from-[#5B18C4] hover:to-[#7E22CE] ring-4 ring-[#7024E3]/20 hover:scale-105'
            }`}
            title={speech.isListening ? 'Arrêter la dictée' : 'Démarrer la dictée au microphone'}
          >
            {speech.isListening ? (
              <Square className="w-6 h-6 fill-current" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Status text & timer */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            {speech.isListening ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EF4444]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                En écoute... Parlez distinctement
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#1E084A]">
                {editableText ? "Dictée prête à être validée" : "Cliquez sur le micro pour commencer à dicter"}
              </span>
            )}
            <span className="font-mono text-xs font-bold text-[#7024E3] bg-[#F5F3FF] px-2 py-0.5 rounded">
              {formatTime(speech.elapsedSeconds)}
            </span>
          </div>

          <p className="text-[12px] text-[#7C709A]">
            Ex: "Vente de 2 sacs de ciment à 5 000 FCFA payé en espèces" ou "Achat de carburant 15 000F par Wave"
          </p>
        </div>

        {/* Real-time Transcription Box (Editable) */}
        <div className="w-full text-left">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] font-bold text-[#1E084A] flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5 text-[#7024E3]" />
              <span>Transcription de votre voix :</span>
            </label>
            {editableText && (
              <button
                onClick={() => {
                  setEditableText('');
                  speech.clearTranscript();
                  setIsEditingManually(false);
                }}
                className="text-[11px] text-[#7C709A] hover:text-[#EF4444] flex items-center gap-0.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Effacer</span>
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              value={isEditingManually ? editableText : (speech.fullTranscript || editableText)}
              onChange={(e) => {
                setEditableText(e.target.value);
                setIsEditingManually(true);
              }}
              placeholder="Votre voix apparaîtra ici en temps réel au fur et à mesure que vous parlez..."
              rows={3}
              className="w-full p-3 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl text-xs sm:text-sm text-[#1E084A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30 leading-relaxed placeholder:text-[#9B8EB9]"
            />
            {speech.interimTranscript && !isEditingManually && (
              <span className="absolute bottom-2.5 right-3 text-[11px] font-mono text-[#7024E3] bg-[#EDE9FE] px-1.5 py-0.5 rounded animate-pulse">
                Transcribing...
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full pt-2">
          {speech.isListening && (
            <button
              onClick={() => speech.cancelListening()}
              className="px-3 py-2 text-xs font-bold text-[#7C709A] hover:text-[#EF4444] rounded-xl hover:bg-[#FEF2F2] transition-colors"
            >
              Annuler
            </button>
          )}

          <button
            onClick={handleStopAndSend}
            disabled={!(editableText.trim() || speech.fullTranscript.trim())}
            className="px-5 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] hover:from-[#5B18C4] hover:to-[#7024E3] text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-40 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enregistrer l'écriture SYSCOHADA</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Oral Examples Chips */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#7C709A]">
          <Volume2 className="w-3.5 h-3.5 text-[#7024E3]" />
          <span>Ou essayez une formulation type OHADA en un clic :</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ORAL_SYSCOHADA_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(preset)}
              className="text-left p-2 px-3 bg-white hover:bg-[#EDE9FE] border border-[#DDD6FE] rounded-xl text-xs text-[#1E084A] transition-all flex items-center justify-between group shadow-2xs"
            >
              <span className="truncate pr-2">{preset}</span>
              <span className="text-[11px] text-[#7024E3] font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                Essayer →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
