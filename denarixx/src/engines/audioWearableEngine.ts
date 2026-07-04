// ─── V16 Audio Wearable Engine ────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Bone-conduction audio config, health assessment, fallback to haptic.

import type {
  BoneAudioConfig,
  ComponentStatus,
  DenarixxGlassesState,
} from '@/types/denarixxGlasses';
import { CAMERA_FAIL_MESSAGE } from '@/types/denarixxGlasses';

// ─── Config Factory ───────────────────────────────────────────────────────────

export function createBoneAudioConfig(): BoneAudioConfig {
  return {
    driverType: 'piezoelectric',
    maxVolumeDb: 85,
    frequencyRangeHz: [200, 8000],
    hasVolumeControl: true,
    status: 'ok',
  };
}

// ─── Health Assessment ────────────────────────────────────────────────────────

export function assessAudioHealth(state: DenarixxGlassesState): ComponentStatus {
  if (state.connection === 'disconnected') return 'offline';
  if (state.audioStatus === 'failed') return 'failed';
  if (state.audioStatus === 'degraded') return 'degraded';
  return state.audioStatus;
}

export function isAudioOperational(state: DenarixxGlassesState): boolean {
  const health = assessAudioHealth(state);
  return health === 'ok' || health === 'degraded';
}

// ─── Fallback Logic ───────────────────────────────────────────────────────────

export function shouldUsHapticFallback(audioStatus: ComponentStatus): boolean {
  return audioStatus === 'failed' || audioStatus === 'offline';
}

export function getAudioFallbackMessage(): string {
  return 'Bone-conduction audio unavailable. Haptic alerts activated.';
}

export function getCameraFailMessage(): string {
  return CAMERA_FAIL_MESSAGE;
}

// ─── Guidance Priority ────────────────────────────────────────────────────────

export type AudioPriority = 'critical' | 'high' | 'medium' | 'low';

export function selectAudioOutput(
  state: DenarixxGlassesState,
  priority: AudioPriority,
): 'bone_conduction' | 'phone_speaker' | 'haptic_only' | 'none' {
  const audioOk = isAudioOperational(state);

  if (audioOk) return 'bone_conduction';

  // Bone audio failed — route to phone speaker for critical/high
  if (priority === 'critical' || priority === 'high') return 'phone_speaker';

  // Medium/low → haptic only if audio unavailable
  if (state.hapticStatus === 'ok') return 'haptic_only';

  return 'none'; // both failed — log silently, never crash
}

// ─── Volume Management ────────────────────────────────────────────────────────

export function getRecommendedVolumeDb(priority: AudioPriority): number {
  const volumes: Record<AudioPriority, number> = {
    critical: 85,
    high: 75,
    medium: 65,
    low: 55,
  };
  return volumes[priority];
}

export function isVolumeInRange(config: BoneAudioConfig, volumeDb: number): boolean {
  return volumeDb <= config.maxVolumeDb && volumeDb > 0;
}

// ─── Bone-Conduction Characteristics ─────────────────────────────────────────

export function describeAudioConfig(config: BoneAudioConfig): string {
  const [minHz, maxHz] = config.frequencyRangeHz;
  return `${config.driverType} · ${minHz}–${maxHz}Hz · ${config.maxVolumeDb}dB max`;
}

export function isFrequencySupported(config: BoneAudioConfig, hz: number): boolean {
  return hz >= config.frequencyRangeHz[0] && hz <= config.frequencyRangeHz[1];
}

// ─── Speech Optimization for Bone-Conduction ──────────────────────────────────

export function getOptimalSpeechRate(): number {
  // Bone conduction clarity peaks at slightly slower speech
  return 0.9; // relative to normal TTS rate
}

export function buildAudioStatusSummary(state: DenarixxGlassesState): string {
  const health = assessAudioHealth(state);
  if (health === 'ok') return '🔊 Bone-conduction active';
  if (health === 'degraded') return '🔊 Bone-conduction degraded — phone speaker on standby';
  if (health === 'failed') return '🔇 Bone-conduction failed — phone speaker active';
  return '🔇 Audio offline';
}

// ─── Audio + Camera Combined Status ──────────────────────────────────────────

export function describeSensorAudioStatus(
  cameraOk: boolean,
  audioOk: boolean,
): string {
  if (!cameraOk && !audioOk) return 'Both camera and audio unavailable. Maximum caution required.';
  if (!cameraOk) return CAMERA_FAIL_MESSAGE;
  if (!audioOk) return getAudioFallbackMessage();
  return '';
}
