// Web Audio API synthesized notification sounds - No external file dependencies required

export type SoundType = 'fintech_chime' | 'crystal_bell' | 'soft_chord' | 'alert_warning';

export interface SoundOption {
  id: SoundType;
  label: string;
  description: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'fintech_chime',
    label: 'Carillon AxeCompta (Défaut)',
    description: 'Double note harmonieuse et élégante (D5 → A5)'
  },
  {
    id: 'crystal_bell',
    label: 'Ding Cristallin',
    description: 'Sonnette claire et lumineuse haute fréquence'
  },
  {
    id: 'soft_chord',
    label: 'Accord Doux Discret',
    description: 'Arpège feutré à trois notes apaisantes'
  },
  {
    id: 'alert_warning',
    label: 'Signal Anomalie',
    description: 'Tonalité distinctive pour les alertes comptables'
  }
];

/**
 * Les notifications sonnent toujours, au volume maximum que le navigateur autorise.
 * Une page web ne peut pas monter le volume système de l'appareil (ni passer outre le mode silencieux) :
 * on joue donc à pleine échelle, derrière un limiteur qui évite la saturation.
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private output: AudioNode | null = null;
  private currentSound: SoundType = 'fintech_chime';

  constructor() {
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem('axecompta_sound_type') as SoundType;
      if (savedSound && SOUND_OPTIONS.some(o => o.id === savedSound)) {
        this.currentSound = savedSound;
      }
      // Le navigateur n'autorise le son qu'après un geste : on déverrouille l'audio au premier contact.
      const unlock = () => this.initContext();
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        // Limiteur : volume maximal sans saturation quand les notes se superposent
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -1;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.05;
        limiter.connect(this.ctx.destination);
        this.output = limiter;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getSoundType(): SoundType {
    return this.currentSound;
  }

  public setSoundType(type: SoundType): void {
    this.currentSound = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem('axecompta_sound_type', type);
    }
  }

  /**
   * Plays the default or specified notification sound
   */
  public play(specificType?: SoundType): void {
    const typeToPlay = specificType || this.currentSound;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      switch (typeToPlay) {
        case 'fintech_chime':
          this.synthesizeChime(ctx, now);
          break;
        case 'crystal_bell':
          this.synthesizeCrystal(ctx, now);
          break;
        case 'soft_chord':
          this.synthesizeChord(ctx, now);
          break;
        case 'alert_warning':
          this.synthesizeAlert(ctx, now);
          break;
        default:
          this.synthesizeChime(ctx, now);
      }
    } catch (e) {
      console.warn('Audio playback not permitted or failed', e);
    }
  }

  // Preset 1: Default Fintech Chime (Melodic D5 -> A5)
  private synthesizeChime(ctx: AudioContext, now: number): void {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, now);
    masterGain.connect(this.output ?? ctx.destination);

    // Note 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: 880 Hz (A5) with slight delay
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.85, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.48);

    // Subtle Harmonic overtone
    const oscHarmonic = ctx.createOscillator();
    const gainHarmonic = ctx.createGain();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(1760, now + 0.08);
    gainHarmonic.gain.setValueAtTime(0.001, now + 0.08);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.18, now + 0.1);
    gainHarmonic.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    oscHarmonic.connect(gainHarmonic);
    gainHarmonic.connect(masterGain);
    oscHarmonic.start(now + 0.08);
    oscHarmonic.stop(now + 0.38);
  }

  // Preset 2: Crystal Bell (High-pitched chime)
  private synthesizeCrystal(ctx: AudioContext, now: number): void {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, now);
    masterGain.connect(this.output ?? ctx.destination);

    const freqs = [783.99, 1046.5, 1318.5]; // G5, C6, E6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.6 / (idx + 1), now + idx * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.4);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.45);
    });
  }

  // Preset 3: Soft Chord Arpeggio
  private synthesizeChord(ctx: AudioContext, now: number): void {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, now);
    masterGain.connect(this.output ?? ctx.destination);

    const notes = [440, 554.37, 659.25]; // A4, C#5, E5
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0.001, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.5, now + i * 0.06 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.5);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.55);
    });
  }

  // Preset 4: Warning / Anomaly Alert
  private synthesizeAlert(ctx: AudioContext, now: number): void {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(1, now);
    masterGain.connect(this.output ?? ctx.destination);

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.18);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.7, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.38);
  }
}

export const soundManager = new SoundManager();
