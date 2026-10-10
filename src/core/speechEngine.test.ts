import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechEngine } from './speechEngine';

describe('SpeechEngine', () => {
  let engine: SpeechEngine;
  let mockSpeak: any;
  let mockCancel: any;
  let mockGetVoices: any;
  let originalSpeechSynthesis: any;
  let originalUtterance: any;

  beforeEach(() => {
    engine = new SpeechEngine();

    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockGetVoices = vi.fn().mockReturnValue([
      { name: 'Google US English', lang: 'en-US' },
      { name: 'Microsoft David', lang: 'en-US' },
      { name: 'Amelie', lang: 'fr-FR' }
    ]);

    originalSpeechSynthesis = (globalThis as any).speechSynthesis;
    originalUtterance = (globalThis as any).SpeechSynthesisUtterance;

    (globalThis as any).speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: mockGetVoices,
      speaking: false
    };

    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      lang: string = 'en-US';
      rate: number = 1;
      pitch: number = 1;
      volume: number = 1;
      voice: any = null;
      onend: any = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  afterEach(() => {
    (globalThis as any).speechSynthesis = originalSpeechSynthesis;
    (globalThis as any).SpeechSynthesisUtterance = originalUtterance;
    vi.restoreAllMocks();
  });

  it('initializes in enabled state with volume 1.0', () => {
    expect(engine.isEnabled()).toBe(true);
    expect(engine.getVolume()).toBe(1.0);
  });

  it('clamps volume between 0 and 1', () => {
    engine.setVolume(1.5);
    expect(engine.getVolume()).toBe(1.0);

    engine.setVolume(-0.5);
    expect(engine.getVolume()).toBe(0);

    engine.setVolume(0.75);
    expect(engine.getVolume()).toBe(0.75);
  });

  it('cancels speech when setEnabled(false) is called', () => {
    engine.setEnabled(false);
    expect(engine.isEnabled()).toBe(false);
    expect(mockCancel).toHaveBeenCalled();
  });

  it('does not speak when disabled', () => {
    engine.setEnabled(false);
    engine.speak('Tokyo');
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('ignores empty or whitespace strings', () => {
    engine.speak('');
    engine.speak('   ');
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('cancels existing speech before starting a new utterance', () => {
    engine.speak('Paris');
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('vocalizes multi-word capital cities accurately', () => {
    const multiWordCapitals = [
      'Washington, D.C.',
      'Buenos Aires',
      'Kuala Lumpur',
      'Sri Jayawardenepura Kotte',
      'Andorra la Vella',
      'New Delhi'
    ];

    multiWordCapitals.forEach((capital) => {
      mockSpeak.mockClear();
      engine.speak(capital);
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      const passedUtterance = mockSpeak.mock.calls[0][0];
      expect(passedUtterance.text).toBe(capital);
      expect(passedUtterance.rate).toBe(0.95);
      expect(passedUtterance.lang).toBe('en-US');
    });
  });

  it('selects preferred high-quality natural/Google voice if available', () => {
    engine.speak('Reykjavik');
    expect(mockSpeak).toHaveBeenCalled();
    const passedUtterance = mockSpeak.mock.calls[0][0];
    expect(passedUtterance.voice?.name).toBe('Google US English');
  });

  it('handles environment where speechSynthesis is not available without crashing', () => {
    delete (globalThis as any).speechSynthesis;
    expect(() => engine.speak('Berlin')).not.toThrow();
    expect(() => engine.cancel()).not.toThrow();
    expect(engine.isSpeaking()).toBe(false);
  });
});
