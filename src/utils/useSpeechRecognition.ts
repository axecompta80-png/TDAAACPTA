import { useState, useRef, useEffect, useCallback } from 'react';

// SpeechRecognition interfaces for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => any) | null;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unsupported';
  permissionError: string | null;
  transcript: string;
  interimTranscript: string;
  fullTranscript: string;
  audioLevel: number; // 0 to 100
  elapsedSeconds: number;
  language: string;
  setLanguage: (lang: string) => void;
  startListening: () => Promise<boolean>;
  stopListening: () => string;
  cancelListening: () => void;
  setTranscript: (text: string) => void;
  clearTranscript: () => void;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'fr-FR', label: 'Français (Standard)' },
  { code: 'fr-CI', label: 'Français (Côte d\'Ivoire / OHADA)' },
  { code: 'fr-SN', label: 'Français (Sénégal)' },
  { code: 'fr-CM', label: 'Français (Cameroun)' }
];

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [language, setLanguage] = useState('fr-FR');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<any>(null);
  const isStoppingRef = useRef(false);

  // Check Web Speech API support
  const isSpeechRecognitionSupported = typeof window !== 'undefined' && Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );

  // Check MediaDevices support
  const isMediaDevicesSupported = typeof navigator !== 'undefined' && Boolean(
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  );

  const isSupported = isSpeechRecognitionSupported || isMediaDevicesSupported;

  // Cleanup audio tracks and analyser
  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Update volume analyser loop
  const startAudioMeter = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        // Scale to 0-100 with sensitivity
        const scaled = Math.min(100, Math.round((average / 120) * 100));
        setAudioLevel(scaled);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('Unable to initialize Web Audio meter:', e);
    }
  }, []);

  // Start listening with real microphone access
  const startListening = useCallback(async (): Promise<boolean> => {
    cleanupAudio();
    isStoppingRef.current = false;
    setPermissionError(null);
    setInterimTranscript('');
    setElapsedSeconds(0);

    // 1. Request microphone permission
    let stream: MediaStream | null = null;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        mediaStreamRef.current = stream;
        setPermissionStatus('granted');
        startAudioMeter(stream);
      } else {
        setPermissionStatus('unsupported');
        setPermissionError("L'accès au microphone n'est pas supporté par ce navigateur.");
      }
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setPermissionError("Accès au microphone refusé. Veuillez autoriser le microphone dans les paramètres de votre navigateur.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionStatus('denied');
        setPermissionError("Aucun microphone détecté sur votre appareil.");
      } else {
        setPermissionStatus('denied');
        setPermissionError(`Erreur microphone: ${err.message || 'Impossible d\'activer le micro'}`);
      }
      return false;
    }

    // 2. Setup SpeechRecognition if supported
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        const recognition: SpeechRecognitionInstance = new SpeechRecognitionClass();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.maxAlternatives = 1;

        let accumulated = '';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterim = '';
          let currentFinal = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const item = event.results[i];
            if (item.isFinal) {
              currentFinal += item[0].transcript + ' ';
            } else {
              currentInterim += item[0].transcript;
            }
          }

          if (currentFinal) {
            accumulated += currentFinal;
            setTranscript(prev => (prev + ' ' + currentFinal).trim());
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('SpeechRecognition error:', event.error);
          if (event.error === 'not-allowed') {
            setPermissionStatus('denied');
            setPermissionError("Permission de reconnaissance vocale refusée par le navigateur.");
          } else if (event.error === 'network') {
            setPermissionError("Erreur réseau lors de la reconnaissance vocale.");
          }
        };

        recognition.onend = () => {
          // If still marked as listening and not explicitly stopped, restart recognition
          if (!isStoppingRef.current && mediaStreamRef.current) {
            try {
              recognition.start();
            } catch {
              // Ignore restart if already active
            }
          }
        };

        recognition.start();
      } catch (err: any) {
        console.warn('Failed to start SpeechRecognition:', err);
      }
    } else {
      // SpeechRecognition is not supported natively, but microphone stream is active!
      // Provide a helpful note
      setPermissionError(
        "Ce navigateur ne dispose pas du moteur natif SpeechRecognition (ex: Chrome, Edge, Safari recommandés). Le microphone fonctionne et vous pouvez dicter ou utiliser un modèle oral."
      );
    }

    setIsListening(true);

    // Timer loop
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);

    return true;
  }, [cleanupAudio, language, startAudioMeter]);

  // Stop listening and return the full text
  const stopListening = useCallback((): string => {
    isStoppingRef.current = true;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    cleanupAudio();

    // Determine final text
    const full = (transcript + ' ' + interimTranscript).trim();
    setTranscript(full);
    setInterimTranscript('');
    return full;
  }, [cleanupAudio, interimTranscript, transcript]);

  // Cancel and discard
  const cancelListening = useCallback(() => {
    isStoppingRef.current = true;
    setIsListening(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    cleanupAudio();
    setInterimTranscript('');
  }, [cleanupAudio]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [cleanupAudio]);

  const fullTranscript = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  return {
    isListening,
    isSupported,
    permissionStatus,
    permissionError,
    transcript,
    interimTranscript,
    fullTranscript,
    audioLevel,
    elapsedSeconds,
    language,
    setLanguage,
    startListening,
    stopListening,
    cancelListening,
    setTranscript,
    clearTranscript
  };
}
