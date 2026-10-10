// Robust multi-provider Speech Synthesis Engine:
// 1. Google Audio Stream: Native HTTP audio stream (Zero setup, free, instant, verified on Linux & Electron)
// 2. Gemini 3.8 Flash TTS: Google's new state-of-the-art neural speech generation model (Studio quality)
// 3. Web Speech API: Platform native fallback

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
  private geminiVoice: string = 'Kore';

  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private abortController: AbortController | null = null;
  private audioCache = new Map<string, string>(); // key -> playable URL

  private apiKeyExplicitlySet: boolean = false;

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
    if (this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended) {
      return true;
    }
    const synth = this.getSynthesis();
    if (synth && synth.speaking) {
      return true;
    }
    return false;
  }

  public cancel(): void {
    // 1. Abort any ongoing network request
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch {}
      this.abortController = null;
    }

    // 2. Stop HTML5 audio playback
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

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
   * Pronounces text using the active or requested provider, with automatic failover.
   */
  public speak(text: string, options?: SpeechOptions): void {
    if (!this.enabled) return;
    if (!text || typeof text !== 'string') return;

    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    // Disarm previous speech immediately
    this.cancel();

    const providerToUse = options?.provider || this.provider;

    if (providerToUse === 'gemini-tts') {
      this.speakViaGeminiTTS(trimmed, options).then((ok) => {
        if (!ok) {
          // Transparent fallback to Google Audio stream if Gemini TTS fails
          this.speakViaGoogleStream(trimmed, options);
        }
      });
      return;
    }

    if (providerToUse === 'web-speech') {
      const ok = this.speakViaWebSpeech(trimmed, options);
      if (!ok) {
        this.speakViaGoogleStream(trimmed, options);
      }
      return;
    }

    // Default: Google stream
    this.speakViaGoogleStream(trimmed, options);
  }

  /**
   * Solution 1: Google Audio Stream
   * Native audio stream - Zero setup, works immediately on Linux/Electron
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

    return this.playAudioUrl(streamUrl, options);
  }

  /**
   * Solution 2: Google Gemini 3.8 Flash TTS
   * Studio neural speech generation via Gemini API
   */
  public async speakViaGeminiTTS(text: string, options?: SpeechOptions): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return false;
    }

    const voice = options?.voice || this.geminiVoice || 'Kore';
    const cacheKey = `gemini-tts:${voice}:${text.toLowerCase()}`;
    const cachedDataUrl = this.audioCache.get(cacheKey);

    if (cachedDataUrl) {
      return this.playAudioUrl(cachedDataUrl, options);
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
      return this.playAudioUrl(audioUrl, options);
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
  private playAudioUrl(url: string, options?: SpeechOptions): boolean {
    if (typeof Audio === 'undefined') {
      return false;
    }

    try {
      const audio = new Audio(url);
      audio.volume = (options?.volume ?? 1.0) * this.volume;
      this.currentAudio = audio;

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onEnd) options.onEnd();
      };

      audio.onerror = (e) => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onError) options.onError(e);
      };

      audio.play().catch((err) => {
        console.warn('HTML5 Audio playback error:', err);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
        if (options?.onError) options.onError(err);
      });
      return true;
    } catch (err) {
      console.warn('Failed to initialize Audio element:', err);
      this.currentAudio = null;
      return false;
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
