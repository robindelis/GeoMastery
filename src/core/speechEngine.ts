import { getLocalCapitalAudioUrl, hasLocalCapitalAudio, normalizeCapitalKey } from '../assets/audio/capitalRecordings';
import { getLocalCountryAudioUrl, hasLocalCountryAudio, normalizeCountryKey } from '../assets/audio/countryRecordings';
import { getLocalCoupleAudioUrl, hasLocalCoupleAudio } from '../assets/audio/coupleRecordings';
export { normalizeCapitalKey, normalizeCountryKey };

// Robust multi-provider Speech Synthesis Engine:
// 1. Local Pre-recorded Files: Instant, 0 API calls, high fidelity
// 2. Google Audio Stream: Native HTTP audio stream (Zero setup, free, instant, verified on Linux & Electron)
// 3. Gemini 3.8 Flash TTS: Google's new state-of-the-art neural speech generation model (Studio quality)
// 4. Web Speech API: Platform native fallback

export type TTSProvider = 'google-stream' | 'gemini-tts' | 'web-speech';

export interface SpeechOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  provider?: TTSProvider;
  voice?: string;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

/**
 * Wraps raw 16-bit 24kHz mono PCM data into a playable standard WAV Data URL
 */
export function pcmToWavDataUrl(base64Pcm: string, sampleRate = 24000): string {
  try {
    const binaryStr =
      typeof atob !== 'undefined'
        ? atob(base64Pcm)
        : typeof (globalThis as any).Buffer !== 'undefined'
        ? (globalThis as any).Buffer.from(base64Pcm, 'base64').toString('binary')
        : '';
    const pcmLen = binaryStr.length;
    const buffer = new ArrayBuffer(44 + pcmLen);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + pcmLen, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // "fmt " sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true); // NumChannels (1 = mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcmLen, true);

    const bytes = new Uint8Array(buffer, 44);
    for (let i = 0; i < pcmLen; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    let binary = '';
    const fullBytes = new Uint8Array(buffer);
    for (let i = 0; i < fullBytes.byteLength; i++) {
      binary += String.fromCharCode(fullBytes[i]);
    }
    const b64 =
      typeof btoa !== 'undefined'
        ? btoa(binary)
        : typeof (globalThis as any).Buffer !== 'undefined'
        ? (globalThis as any).Buffer.from(binary, 'binary').toString('base64')
        : '';
    return 'data:audio/wav;base64,' + b64;
  } catch (err) {
    console.warn('Failed to wrap PCM to WAV:', err);
    return 'data:audio/wav;base64,' + base64Pcm;
  }
}

export class SpeechEngine {
  private enabled: boolean = true;
  private volume: number = 1.0;
  private provider: TTSProvider = 'google-stream';
  private geminiApiKey: string = '';
  private geminiVoice: string = 'Fenrir';

  private currentAudio: HTMLAudioElement | null = null;
  private activeAudios = new Set<HTMLAudioElement>();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private abortController: AbortController | null = null;
  private audioCache = new Map<string, string>(); // key -> playable URL

  private apiKeyExplicitlySet: boolean = false;
  private sequenceTimer: any = null;
  private rate: number = 1.3;

  constructor() {
    this.initKey();
  }

  private initKey() {
    const proc = (globalThis as any).process;
    if (proc?.env?.GEMINI_API_KEY) {
      this.geminiApiKey = proc.env.GEMINI_API_KEY;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.getGeminiKey) {
      window.electronAPI.getGeminiKey().then((key) => {
        if (key && !this.geminiApiKey) {
          this.geminiApiKey = key;
        }
      }).catch(() => {});
    }
  }

  private getApiKey(): string {
    if (this.apiKeyExplicitlySet) return this.geminiApiKey;
    if (this.geminiApiKey) return this.geminiApiKey;
    const proc = (globalThis as any).process;
    if (proc?.env?.GEMINI_API_KEY) {
      return proc.env.GEMINI_API_KEY;
    }
    return '';
  }

  public setGeminiApiKey(key: string): void {
    this.geminiApiKey = key.trim();
    this.apiKeyExplicitlySet = true;
  }

  public getGeminiApiKey(): string {
    return this.getApiKey();
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
    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.5, rate));
    if (this.currentAudio) {
      this.currentAudio.playbackRate = this.rate;
    }
  }

  public getRate(): number {
    return this.rate;
  }

  public setProvider(provider: TTSProvider): void {
    this.provider = provider;
  }

  public getProvider(): TTSProvider {
    return this.provider;
  }

  public setGeminiVoice(voice: string): void {
    this.geminiVoice = voice;
  }

  public getGeminiVoice(): string {
    return this.geminiVoice;
  }

  public isSpeaking(): boolean {
    if (this.activeAudios.size > 0) {
      for (const a of this.activeAudios) {
        if (!a.paused && !a.ended) return true;
      }
    }
    const synth = this.getSynthesis();
    if (synth && synth.speaking) {
      return true;
    }
    return false;
  }

  public cancel(): void {
    // 0. Clear any active sequence chain
    if (this.sequenceTimer) {
      clearTimeout(this.sequenceTimer);
      this.sequenceTimer = null;
    }

    // 1. Abort any ongoing network request
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }

    // 2. Stop HTML5 audio playback on all active audio elements
    this.activeAudios.forEach((audio) => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    });
    this.activeAudios.clear();
    this.currentAudio = null;

    // 3. Cancel Web Speech API
    const synth = this.getSynthesis();
    if (synth) {
      try {
        synth.cancel();
      } catch {}
    }
    this.currentUtterance = null;
  }

  /**
   * Pronounces text using the pre-recorded local studio audio (Fenrir).
   * Checks pre-recorded capital audio first, then pre-recorded country audio.
   * Operates completely offline with zero API calls or network requests during app usage.
   */
  public speak(text: string, options?: SpeechOptions): void {
    if (!this.enabled) return;
    if (!text || typeof text !== 'string') return;

    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    // Disarm previous speech immediately
    this.cancel();

    // 1. Check local pre-recorded capital audio file
    const localCapitalUrl = getLocalCapitalAudioUrl(trimmed);
    if (localCapitalUrl) {
      this.playAudioUrl(localCapitalUrl, options);
      return;
    }

    // 2. Check local pre-recorded country audio file
    const localCountryUrl = getLocalCountryAudioUrl(trimmed);
    if (localCountryUrl) {
      this.playAudioUrl(localCountryUrl, options);
      return;
    }

    if (options?.onError) {
      options.onError(new Error(`No local audio file found for "${trimmed}"`));
    }
  }

  /**
   * Pronounces a sovereign country name using the pre-recorded local studio audio (Fenrir).
   */
  public speakCountry(country: string, options?: SpeechOptions): void {
    if (!this.enabled) return;
    if (!country || typeof country !== 'string') return;

    const trimmed = country.trim();
    if (trimmed.length === 0) return;

    this.cancel();

    const localCountryUrl = getLocalCountryAudioUrl(trimmed);
    if (localCountryUrl) {
      this.playAudioUrl(localCountryUrl, options);
      return;
    }

    if (options?.onError) {
      options.onError(new Error(`No local country audio file found for "${trimmed}"`));
    }
  }

  /**
   * Pronounces country name first, followed by its capital city name with a smooth pause.
   * Gives full geographic context: e.g. "France... Paris".
   */
  public speakCountryAndCapital(
    country: string,
    capital: string,
    options?: SpeechOptions & { gapMs?: number; overlapMs?: number }
  ): void {
    if (!this.enabled) return;

    const trimmedCountry = country && typeof country === 'string' ? country.trim() : '';
    const trimmedCapital = capital && typeof capital === 'string' ? capital.trim() : '';

    if (!trimmedCountry && !trimmedCapital) return;

    if (!trimmedCountry) {
      this.speak(trimmedCapital, options);
      return;
    }

    if (!trimmedCapital) {
      this.speakCountry(trimmedCountry, options);
      return;
    }

    this.cancel();

    // 1. Prefer tailored, pre-rendered couple audio file (exact silence analysis & 1.3x speed)
    if (options?.gapMs === undefined) {
      const coupleUrl = getLocalCoupleAudioUrl(trimmedCountry, trimmedCapital);
      if (coupleUrl) {
        this.playAudioUrl(coupleUrl, { ...options, rate: 1.0 });
        return;
      }
    }

    const countryUrl = getLocalCountryAudioUrl(trimmedCountry);
    const capitalUrl = getLocalCapitalAudioUrl(trimmedCapital);

    // Both audio files are available: play country with intersection into capital
    if (countryUrl && capitalUrl) {
      // If caller explicitly requested a traditional sequential gapMs:
      if (options?.gapMs !== undefined) {
        this.playAudioUrl(countryUrl, {
          ...options,
          onEnd: () => {
            this.sequenceTimer = setTimeout(() => {
              this.sequenceTimer = null;
              this.playAudioUrl(capitalUrl, options);
            }, options.gapMs);
          }
        });
        return;
      }

      // Default: Play with intersection (early trigger before country's trailing silence finishes)
      const countryAudio = this.playAudioUrl(countryUrl, options);
      if (!countryAudio) {
        this.playAudioUrl(capitalUrl, options);
        return;
      }

      let scheduled = false;
      const scheduleOverlap = () => {
        if (scheduled) return;
        const durSec = countryAudio.duration;
        if (!Number.isFinite(durSec) || durSec <= 0) return;
        scheduled = true;

        const effectiveMs = (durSec / this.rate) * 1000;
        // Default overlap: ~380ms blends country trailing silence into capital leading silence
        const overlapMs = options?.overlapMs ?? 380;
        const delay = Math.max(20, effectiveMs - overlapMs);

        this.sequenceTimer = setTimeout(() => {
          this.sequenceTimer = null;
          this.playAudioUrl(capitalUrl, options);
        }, delay);
      };

      if (Number.isFinite(countryAudio.duration) && countryAudio.duration > 0) {
        scheduleOverlap();
      } else if (countryAudio.addEventListener) {
        countryAudio.addEventListener('loadedmetadata', scheduleOverlap, { once: true });
        countryAudio.addEventListener(
          'ended',
          () => {
            if (!scheduled) {
              this.playAudioUrl(capitalUrl, options);
            }
          },
          { once: true }
        );
      }
      return;
    }

    // Fallback: if only capital audio exists
    if (capitalUrl) {
      this.playAudioUrl(capitalUrl, options);
      return;
    }

    // Fallback: if only country audio exists
    if (countryUrl) {
      this.playAudioUrl(countryUrl, options);
      return;
    }

    if (options?.onError) {
      options.onError(
        new Error(`No local audio file found for country "${trimmedCountry}" or capital "${trimmedCapital}"`)
      );
    }
  }

  /**
   * Returns true if a local studio recording is available for the given capital or country name.
   */
  public hasLocalRecording(name: string): boolean {
    return hasLocalCapitalAudio(name) || hasLocalCountryAudio(name);
  }

  /**
   * Returns true if a local studio recording is available for the given capital.
   */
  public hasLocalCapitalRecording(capital: string): boolean {
    return hasLocalCapitalAudio(capital);
  }

  /**
   * Returns true if a local studio recording is available for the given country.
   */
  public hasLocalCountryRecording(country: string): boolean {
    return hasLocalCountryAudio(country);
  }

  /**
   * Returns true if a pre-rendered tailored couple recording is available for the given country and capital.
   */
  public hasLocalCoupleRecording(country: string, capital: string): boolean {
    return hasLocalCoupleAudio(country, capital);
  }

  /**
   * Solution 1: Google Audio Stream
   * Native audio stream utility
   */
  public speakViaGoogleStream(text: string, options?: SpeechOptions): boolean {
    const lang = options?.lang || 'en';
    const cacheKey = `google-stream:${lang}:${text.toLowerCase()}`;
    const cachedUrl = this.audioCache.get(cacheKey);

    const streamUrl =
      cachedUrl ||
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(text)}`;

    if (!cachedUrl) {
      this.audioCache.set(cacheKey, streamUrl);
    }

    return Boolean(this.playAudioUrl(streamUrl, options));
  }

  /**
   * Solution 2: Google Gemini 3.8 Flash TTS
   * Studio neural speech generation via Gemini API (prefers local recording if exists)
   */
  public async speakViaGeminiTTS(text: string, options?: SpeechOptions): Promise<boolean> {
    const voice = 'Fenrir';

    // 1. Check local pre-recorded audio file first (zero API calls)
    const localAudioUrl = getLocalCapitalAudioUrl(text);
    if (localAudioUrl) {
      return Boolean(this.playAudioUrl(localAudioUrl, options));
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }

    const cacheKey = `gemini-tts:${voice}:${text.toLowerCase()}`;
    const cachedDataUrl = this.audioCache.get(cacheKey);

    if (cachedDataUrl) {
      return Boolean(this.playAudioUrl(cachedDataUrl, options));
    }

    this.abortController = new AbortController();

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${encodeURIComponent(apiKey)}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        return false;
      }

      const json = await response.json();
      const inlineData = json?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!inlineData || !inlineData.data) {
        return false;
      }

      const mimeType = inlineData.mimeType || 'audio/wav';
      const audioUrl = mimeType.includes('pcm')
        ? pcmToWavDataUrl(inlineData.data)
        : `data:${mimeType};base64,${inlineData.data}`;

      this.audioCache.set(cacheKey, audioUrl);
      return Boolean(this.playAudioUrl(audioUrl, options));
    } catch (err: any) {
      return false;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Solution 3: Native Web Speech API
   */
  public speakViaWebSpeech(text: string, options?: SpeechOptions): boolean {
    const synth = this.getSynthesis();
    const UtteranceClass = this.getUtteranceClass();
    if (!synth || !UtteranceClass) return false;

    const voices = synth.getVoices();
    // In Linux environments without speech-dispatcher, voices array is 0 and speak() fails
    if (!voices || voices.length === 0) {
      return false;
    }

    try {
      const utterance = new UtteranceClass(text);
      const targetLang = options?.lang || 'en-US';
      utterance.lang = targetLang;
      utterance.rate = options?.rate ?? 0.95;
      utterance.pitch = options?.pitch ?? 1.0;
      utterance.volume = (options?.volume ?? 1.0) * this.volume;

      this.currentUtterance = utterance;

      utterance.onend = () => {
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (options?.onEnd) options.onEnd();
      };

      utterance.onerror = (e) => {
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
        }
        if (options?.onError) options.onError(e);
      };

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

      synth.speak(utterance);
      return true;
    } catch (err) {
      console.warn('Web Speech API speak failed:', err);
      return false;
    }
  }

  /**
   * Plays a playable audio URL (data URI, blob URL, or HTTPS stream) via HTML5 Audio
   */
  private playAudioUrl(url: string, options?: SpeechOptions): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') {
      return null;
    }

    try {
      const audio = new Audio(url);
      audio.volume = (options?.volume ?? 1.0) * this.volume;
      audio.playbackRate = options?.rate ?? this.rate;
      if ('preservesPitch' in audio) {
        audio.preservesPitch = true;
      }
      this.currentAudio = audio;
      this.activeAudios.add(audio);

      audio.onended = () => {
        this.activeAudios.delete(audio);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onEnd) options.onEnd();
      };

      audio.onerror = (e) => {
        this.activeAudios.delete(audio);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onError) options.onError(e);
      };

      audio.play().catch((err) => {
        console.warn('HTML5 Audio playback error:', err);
        this.activeAudios.delete(audio);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onError) options.onError(err);
      });
      return audio;
    } catch (err) {
      console.warn('Failed to initialize Audio element:', err);
      this.currentAudio = null;
      return null;
    }
  }

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
}

export const speechEngine = new SpeechEngine();
