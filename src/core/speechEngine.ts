// Web Speech API client for geographical pronunciation and vocal reading

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export class SpeechEngine {
  private enabled: boolean = true;
  private volume: number = 1.0;
  // Keep strong reference to current utterance to prevent Chromium garbage collection pause bug
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private getSynthesis(): SpeechSynthesis | null {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis;
    }
    if (typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis) {
      return (globalThis as any).speechSynthesis;
    }
    return null;
  }

  private getUtteranceClass(): (new (text: string) => SpeechSynthesisUtterance) | null {
    if (typeof window !== 'undefined' && typeof (window as any).SpeechSynthesisUtterance !== 'undefined') {
      return (window as any).SpeechSynthesisUtterance;
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).SpeechSynthesisUtterance !== 'undefined') {
      return (globalThis as any).SpeechSynthesisUtterance;
    }
    return null;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public getVolume(): number {
    return this.volume;
  }

  public isSpeaking(): boolean {
    const synth = this.getSynthesis();
    if (!synth) return false;
    return Boolean(synth.speaking);
  }

  public cancel(): void {
    const synth = this.getSynthesis();
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      // Gracefully ignore any browser internal synthesis cancel error
    }
    this.currentUtterance = null;
  }

  /**
   * Pronounces text (e.g. capital city names, including multi-word strings like "Washington, D.C.", "Buenos Aires")
   */
  public speak(text: string, options?: SpeechOptions): void {
    if (!this.enabled) return;
    if (!text || typeof text !== 'string') return;
    
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    const synth = this.getSynthesis();
    const UtteranceClass = this.getUtteranceClass();
    if (!synth || !UtteranceClass) {
      return;
    }

    try {
      // Cancel previous speech to prevent speech backlog accumulation
      this.cancel();

      const utterance = new UtteranceClass(trimmed);
      const targetLang = options?.lang || 'en-US';
      utterance.lang = targetLang;
      // Slightly measured pace (0.95) for foreign and multi-word capital pronunciations
      utterance.rate = options?.rate ?? 0.95;
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = (options?.volume ?? 1.0) * this.volume;

      this.currentUtterance = utterance;

      utterance.onend = () => {
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (options?.onEnd) {
          options.onEnd();
        }
      };

      utterance.onerror = (e) => {
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (options?.onError) {
          options.onError(e);
        }
      };

      // Select highest quality English voice if voices are populated
      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        const preferredVoice =
          voices.find(
            (v) =>
              (v.lang === targetLang || v.lang.startsWith('en')) &&
              (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Enhanced'))
          ) ||
          voices.find((v) => v.lang === targetLang) ||
          voices.find((v) => v.lang.startsWith('en'));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      synth.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis invocation failed:', err);
      this.currentUtterance = null;
    }
  }
}

export const speechEngine = new SpeechEngine();
