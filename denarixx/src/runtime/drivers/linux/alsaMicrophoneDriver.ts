// ─── ALSA Microphone Driver ───────────────────────────────────────────────────
// Linux Advanced Linux Sound Architecture capture driver for I2S PDM microphone.
//
// Real implementation (physical device required):
//   - Open: snd_pcm_open(&handle, "hw:0,0", SND_PCM_STREAM_CAPTURE, 0)
//   - Configure: snd_pcm_set_params() → 16-bit signed, 16000 Hz, mono
//   - Read: snd_pcm_readi(handle, buffer, frames)
//   - Close: snd_pcm_close(handle)
//
// Node.js binding options:
//   npm install naudiodon    (requires PortAudio on Linux, reads ALSA via PA backend)
//   npm install node-alsa    (direct ALSA binding, requires alsa-lib-dev)
//   child_process: arecord -D hw:0,0 -f S16_LE -r 16000 -c 1 -t raw → pipe
//
// Wake word detection:
//   Run Porcupine or Kaldi small-footprint model on audio chunks.
//   This driver provides raw PCM; wake word engine is a separate concern.

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlsaMicDriverStatus = 'not-initialized' | 'initializing' | 'capturing' | 'degraded' | 'failed' | 'closed';

export interface AlsaMicConfig {
  alsaDevice: string;      // e.g. hw:0,0
  sampleRateHz: number;    // e.g. 16000
  channelCount: 1 | 2;
  bitDepth: 16 | 32;
  periodSizeFrames: number; // frames per read, e.g. 1024
}

export interface AlsaMicDriverState {
  config: AlsaMicConfig;
  status: AlsaMicDriverStatus;
  framesRead: number;
  errorCount: number;
  lastErrorMessage: string | null;
}

export interface AlsaAudioChunk {
  pcmSamples: Int16Array;
  sampleRateHz: number;
  channelCount: number;
  frameCount: number;
  timestampMs: number;
  peakAmplitudeNormalized: number;  // 0.0–1.0; measured from actual samples
  isSimulated: false;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAlsaMicDriverState(config: AlsaMicConfig): AlsaMicDriverState {
  return { config, status: 'not-initialized', framesRead: 0, errorCount: 0, lastErrorMessage: null };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeAlsaMicDriver(
  state: AlsaMicDriverState,
): { state: AlsaMicDriverState; error: string | null } {
  // TODO (physical bring-up): snd_pcm_open + snd_pcm_set_params + snd_pcm_prepare
  // Check if ALSA device is reachable via /proc/asound/devices or arecord -l output.
  const procSoundExists = fs.existsSync('/proc/asound');
  if (!procSoundExists) {
    const error = `ALSA subsystem not available (/proc/asound not found). ` +
      `Not running on a Linux device with ALSA support.`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  const error = `ALSA microphone native binding not yet implemented. ` +
    `Install naudiodon or node-alsa, or use arecord child process.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Read PCM Chunk ───────────────────────────────────────────────────────────

export function readAlsaChunk(
  state: AlsaMicDriverState,
): { state: AlsaMicDriverState; chunk: AlsaAudioChunk | null; error: string | null } {
  if (state.status !== 'capturing') {
    const error = `Cannot read audio: driver status is '${state.status}'.`;
    return { state, chunk: null, error };
  }
  const error = `ALSA read not yet implemented.`;
  return { state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error }, chunk: null, error };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getAlsaMicHealth(state: AlsaMicDriverState): AlsaMicDriverStatus {
  return state.status;
}

export function shutdownAlsaMicDriver(state: AlsaMicDriverState): AlsaMicDriverState {
  // TODO: snd_pcm_close(handle)
  return { ...state, status: 'closed' };
}
