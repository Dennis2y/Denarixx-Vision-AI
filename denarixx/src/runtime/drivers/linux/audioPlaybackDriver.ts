// ─── Audio Playback Driver ────────────────────────────────────────────────────
// ALSA/PipeWire playback driver for I2S bone-conduction audio output.
//
// Real implementation (physical device required):
//   ALSA path:
//     snd_pcm_open(&handle, "hw:1,0", SND_PCM_STREAM_PLAYBACK, 0)
//     snd_pcm_set_params() → 16-bit, 48000 Hz, mono
//     snd_pcm_writei(handle, pcm_buffer, frames)
//     snd_pcm_drain(handle); snd_pcm_close(handle)
//
//   TTS path (espeak-ng or piper on device):
//     spawn: piper --model /opt/denarixx/tts/en_US-amy-medium.onnx \
//                  --output_raw | aplay -r 22050 -f S16_LE -c 1
//     Or: espeak-ng -v en-us -s 160 "Obstacle ahead" --stdout | aplay -f S16_LE
//
// Audio latency target: < 200 ms from Guardian alert to first audio byte.
// Bone-conduction (YB150): requires 40–80 Hz haptic coupling — keep volume ≥ 70%.

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioPlaybackStatus = 'not-initialized' | 'ready' | 'playing' | 'degraded' | 'failed' | 'closed';

export interface AudioPlaybackConfig {
  alsaDevice: string;          // e.g. hw:1,0
  sampleRateHz: number;        // e.g. 48000
  channelCount: 1 | 2;
  bitDepth: 16 | 32;
  ttsEngine: 'piper' | 'espeak-ng' | 'none';
  ttsModelPath: string | null; // Path to piper model .onnx; null if using espeak
  volumePct: number;           // 0–100
}

export interface AudioPlaybackState {
  config: AudioPlaybackConfig;
  status: AudioPlaybackStatus;
  utterancesPlayed: number;
  currentText: string | null;
  errorCount: number;
  lastErrorMessage: string | null;
  alsaSubsystemAvailable: boolean;
}

export interface AudioPlaybackResult {
  success: boolean;
  latencyMs: number | null;
  error: string | null;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAudioPlaybackState(config: AudioPlaybackConfig): AudioPlaybackState {
  const alsaSubsystemAvailable = fs.existsSync('/proc/asound');
  return {
    config, status: 'not-initialized',
    utterancesPlayed: 0, currentText: null,
    errorCount: 0, lastErrorMessage: null,
    alsaSubsystemAvailable,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeAudioPlaybackDriver(
  state: AudioPlaybackState,
): { state: AudioPlaybackState; error: string | null } {
  if (!state.alsaSubsystemAvailable) {
    const error = `ALSA not available (/proc/asound missing). Not on a Linux audio-capable device.`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  // Verify TTS engine binary exists
  if (state.config.ttsEngine === 'piper' && state.config.ttsModelPath) {
    if (!fs.existsSync(state.config.ttsModelPath)) {
      const error = `Piper TTS model not found at ${state.config.ttsModelPath}. ` +
        `Download from: https://huggingface.co/rhasspy/piper-voices`;
      return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
    }
  }

  // TODO (physical bring-up): snd_pcm_open + configure playback handle
  // For now: report failed with clear instruction
  const error = `Audio playback native binding not yet implemented. ` +
    `Implement via: node-alsa binding, naudiodon, or spawn piper/espeak-ng child process.`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Speak ────────────────────────────────────────────────────────────────────

export function speakText(
  state: AudioPlaybackState,
  text: string,
): { state: AudioPlaybackState; result: AudioPlaybackResult } {
  if (state.status !== 'ready' && state.status !== 'playing') {
    return {
      state,
      result: {
        success: false,
        latencyMs: null,
        error: `Audio driver not ready: ${state.status}. Cannot speak: "${text.slice(0, 40)}"`,
      },
    };
  }

  // TODO (physical bring-up): spawn TTS → pipe to ALSA; measure latency from call to first byte
  return {
    state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: 'speak not yet implemented' },
    result: { success: false, latencyMs: null, error: 'Audio playback not yet implemented.' },
  };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getAudioPlaybackHealth(state: AudioPlaybackState): AudioPlaybackStatus {
  return state.status;
}

export function shutdownAudioPlaybackDriver(state: AudioPlaybackState): AudioPlaybackState {
  // TODO: snd_pcm_drain; snd_pcm_close; kill TTS child process
  return { ...state, status: 'closed', currentText: null };
}
