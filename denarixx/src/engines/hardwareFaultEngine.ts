// ─── Sprint 18: Hardware Fault Engine ────────────────────────────────────────
// Pure functions — no async, no I/O.
// Fault injection and recovery for the Digital Twin test harness.

import type {
  DigitalTwinState,
  SimulatedFault,
  SimulatorFaultType,
  FaultInjectionResult,
  FaultSeverity,
  SafetyImpact,
} from '@/types/simulator';

// ─── Fault Definitions ────────────────────────────────────────────────────────

interface FaultDefinition {
  type: SimulatorFaultType;
  component: string;
  severity: FaultSeverity;
  safetyImpact: SafetyImpact;
  recoverable: boolean;
  recoveryMessage: string;
  recoverySteps: string[];
}

export const FAULT_DEFINITIONS: Record<SimulatorFaultType, FaultDefinition> = {
  'camera-failure': {
    type: 'camera-failure',
    component: 'front-camera',
    severity: 'critical',
    safetyImpact: 'critical',
    recoverable: true,
    recoveryMessage: 'Camera failure detected. Switching to side cameras if available.',
    recoverySteps: ['Switch to fallback camera', 'Reduce frame rate', 'Alert Guardian'],
  },
  'gps-loss': {
    type: 'gps-loss',
    component: 'gps',
    severity: 'high',
    safetyImpact: 'degraded',
    recoverable: true,
    recoveryMessage: 'GPS signal lost. Activating offline dead-reckoning navigation.',
    recoverySteps: ['Switch to offline navigation', 'Use IMU heading', 'Alert user'],
  },
  'low-battery': {
    type: 'low-battery',
    component: 'battery',
    severity: 'high',
    safetyImpact: 'reduced',
    recoverable: true,
    recoveryMessage: 'Battery critically low. Guardian remains active. Other features reduced.',
    recoverySteps: ['Disable non-essential features', 'Reduce frame rate', 'Warn user'],
  },
  'sensor-drift': {
    type: 'sensor-drift',
    component: 'imu',
    severity: 'medium',
    safetyImpact: 'reduced',
    recoverable: true,
    recoveryMessage: 'IMU sensor drift detected. Heading may be less accurate.',
    recoverySteps: ['Apply drift correction', 'Increase heading uncertainty', 'Log issue'],
  },
  'microphone-failure': {
    type: 'microphone-failure',
    component: 'microphone',
    severity: 'high',
    safetyImpact: 'degraded',
    recoverable: true,
    recoveryMessage: 'Microphone failure. Voice commands unavailable. Touch controls active.',
    recoverySteps: ['Disable voice commands', 'Enable touch fallback', 'Alert user'],
  },
  'speaker-failure': {
    type: 'speaker-failure',
    component: 'bone-conduction-speaker',
    severity: 'critical',
    safetyImpact: 'critical',
    recoverable: true,
    recoveryMessage: 'Bone-conduction speaker failure. Haptic fallback activated.',
    recoverySteps: ['Switch to haptic alerts', 'Reduce alert frequency', 'Emergency stop available'],
  },
  'overheating': {
    type: 'overheating',
    component: 'compute-module',
    severity: 'high',
    safetyImpact: 'reduced',
    recoverable: true,
    recoveryMessage: 'Device overheating. Throttling performance. Guardian unaffected.',
    recoverySteps: ['Reduce CPU load', 'Disable AR overlay', 'Thermal throttle active'],
  },
  'low-light': {
    type: 'low-light',
    component: 'front-camera',
    severity: 'medium',
    safetyImpact: 'reduced',
    recoverable: true,
    recoveryMessage: 'Low light detected. Camera confidence reduced. Use caution.',
    recoverySteps: ['Reduce detection confidence threshold', 'Increase alert sensitivity', 'Warn user'],
  },
  'partial-obstruction': {
    type: 'partial-obstruction',
    component: 'front-camera',
    severity: 'medium',
    safetyImpact: 'reduced',
    recoverable: true,
    recoveryMessage: 'Camera partially obstructed. Field of view reduced.',
    recoverySteps: ['Alert user to clean lens', 'Switch to side cameras', 'Reduce confidence'],
  },
};

// ─── Fault Builder ────────────────────────────────────────────────────────────

function makeFault(type: SimulatorFaultType, tick: number): SimulatedFault {
  const def = FAULT_DEFINITIONS[type];
  return {
    type,
    component: def.component,
    severity: def.severity,
    injectedAtTick: tick,
    isActive: true,
    recoverable: def.recoverable,
    recoveryMessage: def.recoveryMessage,
  };
}

function buildResult(type: SimulatorFaultType): FaultInjectionResult {
  const def = FAULT_DEFINITIONS[type];
  return {
    faultType: type,
    injected: true,
    affectedComponent: def.component,
    safetyImpact: def.safetyImpact,
    recoverySteps: def.recoverySteps,
  };
}

function addFault(twin: DigitalTwinState, fault: SimulatedFault): DigitalTwinState {
  const existing = twin.activeFaults.filter(f => f.type !== fault.type);
  return { ...twin, activeFaults: [...existing, fault] };
}

// ─── Fault Injection Functions ────────────────────────────────────────────────

export function injectCameraFailure(
  twin: DigitalTwinState,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, cameras: twin.cameras.map((c, i) => i === 0 ? { ...c, isWorking: false, faultReason: 'camera-failure' } : c) },
    makeFault('camera-failure', tick)
  );
  return { twin: updated, result: buildResult('camera-failure') };
}

export function injectGPSLoss(
  twin: DigitalTwinState,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, gps: { ...twin.gps, hasSignal: false, isOfflineMode: true } },
    makeFault('gps-loss', tick)
  );
  return { twin: updated, result: buildResult('gps-loss') };
}

export function injectLowBattery(
  twin: DigitalTwinState,
  percentage: number,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const pct = Math.max(0, Math.min(100, percentage));
  const updated = addFault(
    { ...twin, battery: { ...twin.battery, percentage: pct, drainRateMultiplier: 1.5 } },
    makeFault('low-battery', tick)
  );
  return { twin: updated, result: buildResult('low-battery') };
}

export function injectSensorDrift(
  twin: DigitalTwinState,
  driftFactor: number,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, imu: { ...twin.imu, driftFactor: Math.max(1, driftFactor) } },
    makeFault('sensor-drift', tick)
  );
  return { twin: updated, result: buildResult('sensor-drift') };
}

export function injectMicrophoneFailure(
  twin: DigitalTwinState,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, microphones: twin.microphones.map(m => ({ ...m, isWorking: false })) },
    makeFault('microphone-failure', tick)
  );
  return { twin: updated, result: buildResult('microphone-failure') };
}

export function injectSpeakerFailure(
  twin: DigitalTwinState,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, speaker: { ...twin.speaker, isWorking: false } },
    makeFault('speaker-failure', tick)
  );
  return { twin: updated, result: buildResult('speaker-failure') };
}

export function injectOverheat(
  twin: DigitalTwinState,
  temperatureC: number,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    {
      ...twin,
      battery: { ...twin.battery, temperatureC },
      imu: { ...twin.imu, temperatureC },
      display: { ...twin.display, hasOverheat: temperatureC >= 50, mode: temperatureC >= 55 ? 'low-power' : twin.display.mode },
    },
    makeFault('overheating', tick)
  );
  return { twin: updated, result: buildResult('overheating') };
}

export function injectLowLight(
  twin: DigitalTwinState,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const updated = addFault(
    { ...twin, cameras: twin.cameras.map(c => ({ ...c, lightLevel: 'dark' as const })) },
    makeFault('low-light', tick)
  );
  return { twin: updated, result: buildResult('low-light') };
}

export function injectPartialObstruction(
  twin: DigitalTwinState,
  obstructionLevel: number,
  tick: number
): { twin: DigitalTwinState; result: FaultInjectionResult } {
  const level = Math.max(0, Math.min(1, obstructionLevel));
  const updated = addFault(
    { ...twin, cameras: twin.cameras.map((c, i) => i === 0 ? { ...c, obstructionLevel: level } : c) },
    makeFault('partial-obstruction', tick)
  );
  return { twin: updated, result: buildResult('partial-obstruction') };
}

// ─── Recovery ─────────────────────────────────────────────────────────────────

export function clearFault(twin: DigitalTwinState, type: SimulatorFaultType): DigitalTwinState {
  return {
    ...twin,
    activeFaults: twin.activeFaults.filter(f => f.type !== type),
  };
}

export function recoverFromCameraFault(twin: DigitalTwinState): DigitalTwinState {
  return {
    ...clearFault(twin, 'camera-failure'),
    cameras: twin.cameras.map((c, i) => i === 0 ? { ...c, isWorking: true, faultReason: null } : c),
  };
}

export function recoverFromGPSLoss(twin: DigitalTwinState): DigitalTwinState {
  return {
    ...clearFault(twin, 'gps-loss'),
    gps: { ...twin.gps, hasSignal: true, isOfflineMode: false },
  };
}

export function recoverFromDrift(twin: DigitalTwinState): DigitalTwinState {
  return {
    ...clearFault(twin, 'sensor-drift'),
    imu: { ...twin.imu, driftFactor: 1.0 },
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getActiveFaults(twin: DigitalTwinState): SimulatedFault[] {
  return twin.activeFaults.filter(f => f.isActive);
}

export function isCriticalFaultActive(twin: DigitalTwinState): boolean {
  return twin.activeFaults.some(f => f.isActive && (f.severity === 'critical' || f.severity === 'high'));
}

export function getFaultBySeverity(twin: DigitalTwinState, severity: FaultSeverity): SimulatedFault[] {
  return twin.activeFaults.filter(f => f.isActive && f.severity === severity);
}

export function hasActiveFault(twin: DigitalTwinState, type: SimulatorFaultType): boolean {
  return twin.activeFaults.some(f => f.type === type && f.isActive);
}
