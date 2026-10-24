#!/usr/bin/env python3
"""
Trims initial dead silence from all pre-recorded .wav speech audio files in GeoMastery:
- src/assets/audio/couples/*.wav
- src/assets/audio/countries/*.wav
- src/assets/audio/capitals/*.wav
- src/assets/audio/test/*.wav

Retains a clean 10ms pre-attack cushion and applies a 3ms cosine fade-in
to ensure zero clicks, pops, or consonant clipping while starting speech
almost instantaneously.
"""

import os
import glob
import json
import wave
import numpy as np

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO_DIR = os.path.join(ROOT_DIR, 'src', 'assets', 'audio')

def trim_initial_silence(samples, sr=24000, pre_pad_ms=10, fade_ms=3):
    w_size = int(sr * 0.005) # 5ms window
    n_windows = len(samples) // w_size
    if n_windows == 0:
        return samples, 0

    rms_arr = np.zeros(n_windows)
    peak_arr = np.zeros(n_windows)
    for i in range(n_windows):
        c = samples[i * w_size : (i + 1) * w_size]
        rms_arr[i] = np.sqrt(np.mean(c.astype(float) ** 2))
        peak_arr[i] = np.max(np.abs(c))

    # Look for the speech burst in the first 1.2 seconds
    max_search_win = min(n_windows, int(1.2 / 0.005))
    burst_idx = None
    for i in range(max_search_win):
        if peak_arr[i] > 600 or rms_arr[i] > 180:
            burst_idx = i
            break

    if burst_idx is None:
        burst_idx = np.argmax(peak_arr)

    # Search backward from burst_idx to find the onset where signal emerges from silence
    onset_win = 0
    for i in range(burst_idx, -1, -1):
        if rms_arr[i] < 30 and peak_arr[i] < 100:
            onset_win = i + 1
            break

    onset_sample = onset_win * w_size
    pad_samples = int(sr * (pre_pad_ms / 1000.0))
    cut_start = max(0, onset_sample - pad_samples)

    if cut_start == 0:
        return samples, 0

    trimmed = samples[cut_start:].copy()

    # 3ms cosine fade-in to prevent DC offset clicks
    fade_len = int(sr * (fade_ms / 1000.0))
    if len(trimmed) > fade_len and fade_len > 0:
        fade = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fade_len))
        trimmed[:fade_len] = (trimmed[:fade_len].astype(float) * fade).astype(np.int16)

    return trimmed, cut_start

def process_folder(folder_name):
    folder_path = os.path.join(AUDIO_DIR, folder_name)
    wav_files = sorted(glob.glob(os.path.join(folder_path, '*.wav')))
    print(f"\nProcessing {folder_name} ({len(wav_files)} files)...")

    total_trimmed_ms = 0.0
    processed_count = 0

    for fpath in wav_files:
        with wave.open(fpath, 'rb') as w:
            params = w.getparams()
            sr = params.framerate
            nframes = params.nframes
            raw_frames = w.readframes(nframes)
            samples = np.frombuffer(raw_frames, dtype=np.int16)

        trimmed, cut_start = trim_initial_silence(samples, sr=sr)
        cut_ms = (cut_start / sr) * 1000.0
        total_trimmed_ms += cut_ms

        if cut_start > 0:
            tmp_path = fpath + '.tmp'
            with wave.open(tmp_path, 'wb') as w_out:
                w_out.setparams(params)
                w_out.writeframes(trimmed.tobytes())
            os.replace(tmp_path, fpath)
            processed_count += 1

    avg_ms = total_trimmed_ms / max(1, len(wav_files))
    print(f"  ✓ {folder_name}: trimmed {processed_count}/{len(wav_files)} files (avg cut: {avg_ms:.1f}ms, total saved: {total_trimmed_ms/1000:.2f}s)")

    # Update manifest.json file sizes if manifest exists in the folder
    manifest_path = os.path.join(folder_path, 'manifest.json')
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as mf:
                manifest_data = json.load(mf)

            if isinstance(manifest_data, list):
                for entry in manifest_data:
                    fname = entry.get('file')
                    if fname:
                        f_full = os.path.join(folder_path, fname)
                        if os.path.exists(f_full):
                            entry['size'] = os.path.getsize(f_full)
            elif isinstance(manifest_data, dict):
                for k, v in manifest_data.items():
                    if isinstance(v, dict) and 'file' in v:
                        f_full = os.path.join(folder_path, v['file'])
                        if os.path.exists(f_full):
                            v['size'] = os.path.getsize(f_full)

            with open(manifest_path, 'w', encoding='utf-8') as mf:
                json.dump(manifest_data, mf, indent=2)
            print(f"  ✓ Updated {os.path.basename(manifest_path)}")
        except Exception as e:
            print(f"  Warning: failed to update {manifest_path}: {e}")

def main():
    folders = ['couples', 'countries', 'capitals', 'test']
    for f in folders:
        process_folder(f)
    print("\nAll audio silence trimming completed successfully! 🚀")

if __name__ == '__main__':
    main()
