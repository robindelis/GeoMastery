import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechEngine, pcmToWavDataUrl } from './speechEngine';

describe('SpeechEngine Multi-Provider Architecture', () => {
  let engine: SpeechEngine;
  let mockAudioPlay: any;
  let mockAudioPause: any;
  let originalAudio: any;
  let createdAudios: any[] = [];

  beforeEach(() => {
    engine = new SpeechEngine();
    createdAudios = [];

    mockAudioPlay = vi.fn().mockReturnValue(Promise.resolve());
    mockAudioPause = vi.fn();

    originalAudio = (globalThis as any).Audio;

    (globalThis as any).Audio = class {
      src: string;
      volume: number = 1;
      paused: boolean = true;
      ended: boolean = false;
      onended: any = null;
      onerror: any = null;
      play = mockAudioPlay;
      pause = mockAudioPause;
      currentTime: number = 0;

      constructor(src: string) {
        this.src = src;
        createdAudios.push(this);
      }
    };
  });

  afterEach(() => {
    (globalThis as any).Audio = originalAudio;
    vi.restoreAllMocks();
  });

  it('initializes with default google-stream provider and volume 1.0', () => {
    expect(engine.isEnabled()).toBe(true);
    expect(engine.getVolume()).toBe(1.0);
    expect(engine.getProvider()).toBe('google-stream');
  });

  it('clamps volume between 0 and 1', () => {
    engine.setVolume(1.5);
    expect(engine.getVolume()).toBe(1.0);

    engine.setVolume(-0.5);
    expect(engine.getVolume()).toBe(0);

    engine.setVolume(0.75);
    expect(engine.getVolume()).toBe(0.75);
  });

  it('cancels playback when setEnabled(false) is called', () => {
    engine.speak('Paris');
    engine.setEnabled(false);
    expect(engine.isEnabled()).toBe(false);
    expect(mockAudioPause).toHaveBeenCalled();
  });

  it('does not speak when disabled', () => {
    engine.setEnabled(false);
    engine.speak('Tokyo');
    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('ignores empty or whitespace strings', () => {
    engine.speak('');
    engine.speak('   ');
    expect(mockAudioPlay).not.toHaveBeenCalled();
  });

  it('speaks via Google stream for unrecorded capitals and encodes multi-word capitals properly', () => {
    const multiWord = 'Sri Jayawardenepura Kotte';
    engine.speak(multiWord);

    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('translate.google.com/translate_tts');
    expect(createdAudios[0].src).toContain(encodeURIComponent(multiWord));
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
  });

  it('caches audio URLs to prevent redundant network string building', () => {
    engine.speakViaGoogleStream('Port of Spain');
    expect(createdAudios.length).toBe(1);

    engine.speakViaGoogleStream('Port of Spain');
    expect(createdAudios.length).toBe(2);
    expect(createdAudios[0].src).toBe(createdAudios[1].src);
  });

  it('falls back to Google audio stream if Gemini TTS fails or lacks API key', async () => {
    engine.setProvider('gemini-tts');
    engine.setGeminiApiKey(''); // No key

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Invalid Key' });

    engine.speak('Kuala Lumpur');

    // Wait microtask tick for async Gemini check
    await new Promise((r) => setTimeout(r, 20));

    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('translate.google.com');
    expect(createdAudios[0].src).toContain(encodeURIComponent('Kuala Lumpur'));
    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('prefers local pre-recorded files for sample capitals with zero API calls', () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    expect(engine.hasLocalRecording('Paris')).toBe(true);
    expect(engine.hasLocalRecording('Washington, D.C.')).toBe(true);
    expect(engine.hasLocalRecording('Tokyo', 'Fenrir')).toBe(true);

    engine.speak('Paris');

    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('paris_');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
  });

  it('successfully invokes Gemini 3.8 Flash TTS when capital is not pre-recorded', async () => {
    engine.setProvider('gemini-tts');
    engine.setGeminiApiKey('AIzaSyValidDummyKey');

    const mockWavBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: mockWavBase64
                  }
                }
              ]
            }
          }
        ]
      })
    });
    globalThis.fetch = mockFetch;

    // Use unrecorded capital to trigger live Gemini TTS API call
    engine.speak('Ulaanbaatar');

    await new Promise((r) => setTimeout(r, 10));

    expect(mockFetch).toHaveBeenCalled();
    const fetchUrl = mockFetch.mock.calls[0][0];
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchUrl).toContain('gemini-3.8-flash-tts:generateContent');
    expect(fetchBody.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Kore');
    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toBe(`data:audio/wav;base64,${mockWavBase64}`);
    expect(mockAudioPlay).toHaveBeenCalled();
  });

  it('wraps raw PCM to valid WAV data URL correctly', () => {
    const rawPcm = 'AAAA'; // 4 bytes of 0x00
    const wavUrl = pcmToWavDataUrl(rawPcm, 24000);
    expect(wavUrl).toContain('data:audio/wav;base64,');
  });

  it('cancels ongoing audio when cancel() is called', () => {
    engine.speak('Paris');
    engine.cancel();
    expect(mockAudioPause).toHaveBeenCalled();
  });
});
