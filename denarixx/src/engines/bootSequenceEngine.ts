// ─── Sprint 16: Boot Sequence Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// 7-phase startup sequence for Denarixx Vision Glasses standalone OS.

import type {
  BootPhase,
  BootStepResult,
  BootSequenceResult,
  BootDiagnostic,
  BootStatus,
} from '@/types/glassesOS';
import { BOOT_PHASES_IN_ORDER, WAKE_WORD } from '@/types/glassesOS';

// ─── Step Duration Estimates (ms) ─────────────────────────────────────────────

const PHASE_DURATION_MS: Record<BootPhase, number> = {
  'power-on':       120,
  'hardware-check': 250,
  'sensor-init':    800,
  'ai-load':        1200,
  'guardian-start': 400,
  'wake-word':      200,
  'ready':          50,
};

const PHASE_SUCCESS_MESSAGE: Record<BootPhase, string> = {
  'power-on':       'Glasses compute module powered on. Voltage nominal.',
  'hardware-check': 'Hardware self-test passed. All subsystems responding.',
  'sensor-init':    'Cameras, IMU, GPS, compass, and microphones initialised.',
  'ai-load':        'Edge AI models loaded from glasses flash storage.',
  'guardian-start': 'Cognitive Guardian engine active. Safety monitoring started.',
  'wake-word':      `Wake word listener active. Say "${WAKE_WORD}" to begin.`,
  'ready':          'Glasses OS ready. Standalone operation active.',
};

const PHASE_FAIL_MESSAGE: Record<BootPhase, string> = {
  'power-on':       'Power-on self-test failed. Check battery and hardware.',
  'hardware-check': 'Hardware check failed. Component fault detected.',
  'sensor-init':    'Sensor initialisation failed. Check camera or IMU connection.',
  'ai-load':        'AI model load failed. Flash storage may be corrupted.',
  'guardian-start': 'Guardian engine failed to start. Safety system unavailable.',
  'wake-word':      'Wake word listener failed. Voice commands unavailable — touch input only.',
  'ready':          'Boot finalisation error.',
};

// ─── Phase Label ──────────────────────────────────────────────────────────────

export function getBootPhaseLabel(phase: BootPhase): string {
  const labels: Record<BootPhase, string> = {
    'power-on':       'Power On',
    'hardware-check': 'Hardware Check',
    'sensor-init':    'Sensor Initialisation',
    'ai-load':        'AI Model Load',
    'guardian-start': 'Guardian Engine Start',
    'wake-word':      'Wake Word Listener',
    'ready':          'Ready',
  };
  return labels[phase];
}

export function getBootPhaseIndex(phase: BootPhase): number {
  return BOOT_PHASES_IN_ORDER.indexOf(phase);
}

// ─── Step Simulation ──────────────────────────────────────────────────────────

export function simulateBootStep(
  phase: BootPhase,
  forceFailure = false,
  durationOverrideMs?: number
): BootStepResult {
  const success = !forceFailure;
  return {
    phase,
    success,
    durationMs: durationOverrideMs ?? PHASE_DURATION_MS[phase],
    message: success ? PHASE_SUCCESS_MESSAGE[phase] : PHASE_FAIL_MESSAGE[phase],
    error: success ? null : `Boot phase ${phase} failed`,
  };
}

export function getEstimatedPhaseDurationMs(phase: BootPhase): number {
  return PHASE_DURATION_MS[phase];
}

// ─── Full Boot Sequence ───────────────────────────────────────────────────────

export interface BootConfig {
  failAtPhase?: BootPhase;
  phaseOverrideDurations?: Partial<Record<BootPhase, number>>;
}

export function runBootSequence(config: BootConfig = {}): BootSequenceResult {
  const steps: BootStepResult[] = [];
  let totalDurationMs = 0;
  let failedPhase: BootPhase | null = null;

  for (const phase of BOOT_PHASES_IN_ORDER) {
    if (phase === 'ready' && failedPhase !== null) break;

    const forceFailure = config.failAtPhase === phase;
    const durationOverride = config.phaseOverrideDurations?.[phase];
    const step = simulateBootStep(phase, forceFailure, durationOverride);
    steps.push(step);
    totalDurationMs += step.durationMs;

    if (!step.success) {
      failedPhase = phase;
      break;
    }
  }

  const lastStep = steps[steps.length - 1];
  const success = failedPhase === null && lastStep?.phase === 'ready' && lastStep.success;

  return {
    steps,
    success,
    totalDurationMs,
    failedPhase,
    readyForOperation: success,
  };
}

// ─── Partial Boot (up to a phase) ────────────────────────────────────────────

export function runBootUntilPhase(
  stopAfterPhase: BootPhase,
  config: BootConfig = {}
): BootSequenceResult {
  const stopIndex = getBootPhaseIndex(stopAfterPhase);
  const phases = BOOT_PHASES_IN_ORDER.slice(0, stopIndex + 1);
  const steps: BootStepResult[] = [];
  let totalDurationMs = 0;
  let failedPhase: BootPhase | null = null;

  for (const phase of phases) {
    const forceFailure = config.failAtPhase === phase;
    const step = simulateBootStep(phase, forceFailure);
    steps.push(step);
    totalDurationMs += step.durationMs;
    if (!step.success) { failedPhase = phase; break; }
  }

  return {
    steps,
    success: failedPhase === null,
    totalDurationMs,
    failedPhase,
    readyForOperation: false,
  };
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function buildBootDiagnostic(result: BootSequenceResult): BootDiagnostic {
  const completedPhases = result.steps
    .filter(s => s.success)
    .map(s => s.phase);

  const phaseTimings: Record<string, number> = {};
  for (const step of result.steps) {
    phaseTimings[step.phase] = step.durationMs;
  }

  const errors = result.steps
    .filter(s => !s.success && s.error)
    .map(s => s.error as string);

  const status: BootStatus = result.success
    ? 'ready'
    : result.failedPhase !== null
    ? 'failed'
    : 'booting';

  return {
    status,
    completedPhases,
    failedPhase: result.failedPhase,
    totalDurationMs: result.totalDurationMs,
    phaseTimings,
    errors,
  };
}

export function estimateTotalBootTimeMs(): number {
  return BOOT_PHASES_IN_ORDER.reduce((sum, p) => sum + PHASE_DURATION_MS[p], 0);
}

export function isBootComplete(result: BootSequenceResult): boolean {
  return result.readyForOperation;
}

export function getFailureRecoveryMessage(phase: BootPhase): string {
  const recovery: Record<BootPhase, string> = {
    'power-on':       'Hold the power button for 5 seconds to restart.',
    'hardware-check': 'Remove and reattach glasses. Contact support if persistent.',
    'sensor-init':    'Camera or sensor fault. Restart glasses. Limited mode available.',
    'ai-load':        'Flash storage issue. Guardian will use built-in minimal model.',
    'guardian-start': 'Critical fault. Basic obstacle alerts still active via rule-based system.',
    'wake-word':      'Voice commands unavailable. All Guardian alerts still work normally.',
    'ready':          'Restart glasses to recover.',
  };
  return recovery[phase];
}
