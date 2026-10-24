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

  it('prefers local pre-recorded Fenrir files for all capitals with zero API calls', () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    expect(engine.hasLocalRecording('Paris')).toBe(true);
    expect(engine.hasLocalRecording('Washington, D.C.')).toBe(true);
    expect(engine.hasLocalRecording('Tokyo')).toBe(true);
    expect(engine.hasLocalRecording('Sri Jayawardenepura Kotte')).toBe(true);

    engine.speak('Paris');

    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('paris_fenrir');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);

    engine.speak('Washington, D.C.');
    expect(createdAudios.length).toBe(2);
    expect(createdAudios[1].src).toContain('washington_dc_fenrir');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('prefers local pre-recorded Fenrir files for all countries with zero API calls', () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    expect(engine.hasLocalCountryRecording('France')).toBe(true);
    expect(engine.hasLocalCountryRecording('United States')).toBe(true);
    expect(engine.hasLocalCountryRecording('Japan')).toBe(true);
    expect(engine.hasLocalRecording('Germany')).toBe(true);

    engine.speakCountry('France');

    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('france_fenrir');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);

    engine.speakCountry('United States');
    expect(createdAudios.length).toBe(2);
    expect(createdAudios[1].src).toContain('united_states_fenrir');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('caches audio URLs to prevent redundant network string building in stream utility', () => {
    engine.speakViaGoogleStream('Custom Place');
    expect(createdAudios.length).toBe(1);

    engine.speakViaGoogleStream('Custom Place');
    expect(createdAudios.length).toBe(2);
    expect(createdAudios[0].src).toBe(createdAudios[1].src);
  });

  it('invokes speakViaGeminiTTS with Fenrir voice configuration for custom phrases', async () => {
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

    // Use non-capital string so getLocalCapitalAudioUrl is bypassed
    await engine.speakViaGeminiTTS('CustomUnrecordedPhrase');

    expect(mockFetch).toHaveBeenCalled();
    const fetchUrl = mockFetch.mock.calls[0][0];
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchUrl).toContain('gemini-3.8-flash-tts:generateContent');
    expect(fetchBody.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Fenrir');
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

  it('plays country first then capital in sequence with speakCountryAndCapital', async () => {
    vi.useFakeTimers();

    engine.speakCountryAndCapital('France', 'Paris', { gapMs: 200 });

    // 1st audio element created for France
    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('france_fenrir');
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);

    // Simulate country audio ending
    createdAudios[0].onended();

    // Before gap finishes, capital audio should not have started yet
    expect(createdAudios.length).toBe(1);

    // Fast-forward through the 200ms gap
    vi.advanceTimersByTime(200);

    // 2nd audio element created for Paris
    expect(createdAudios.length).toBe(2);
    expect(createdAudios[1].src).toContain('paris_fenrir');
    expect(mockAudioPlay).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('cancels pending sequence timer when cancel() is called', () => {
    vi.useFakeTimers();

    engine.speakCountryAndCapital('France', 'Paris', { gapMs: 300 });
    expect(createdAudios.length).toBe(1);

    // Simulate country audio ending, queueing the gap timer
    createdAudios[0].onended();

    // Cancel while waiting during the gap
    engine.cancel();

    // Advance time past the gap
    vi.advanceTimersByTime(500);

    // Paris should NEVER have been played
    expect(createdAudios.length).toBe(1);

    vi.useRealTimers();
  });

  it('speaks country directly via speakCountry', () => {
    engine.speakCountry('France');
    expect(createdAudios.length).toBe(1);
    expect(createdAudios[0].src).toContain('france_fenrir');
    expect(mockAudioPlay).toHaveBeenCalledTimes(1);
  });
});
