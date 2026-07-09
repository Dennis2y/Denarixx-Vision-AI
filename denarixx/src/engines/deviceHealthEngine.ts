// ─── Sprint 16: Device Health Engine ─────────────────────────────────────────
// Pure functions — no async, no I/O.
// Assesses overall health of the Denarixx Vision Glasses standalone system.

import type {
  ComponentName,
  ComponentHealth,
  ComponentStatus,
  DeviceHealth,
  GlassesOSSensor,
  PowerProfile,
  RuntimeMode,
} from '@/types/glassesOS';

// ─── Component Scoring ────────────────────────────────────────────────────────

export function componentStatusToScore(status: ComponentStatus): number {
  switch (status) {
    case 'healthy':  return 100;
    case 'degraded': return 60;
    case 'critical': return 25;
    case 'offline':  return 0;
  }
}

export function scoreToComponentStatus(score: number): ComponentStatus {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'degraded';
  if (score >= 10) return 'critical';
  return 'offline';
}

export function getHealthColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

// ─── Per-Component Assessment ─────────────────────────────────────────────────

export function assessComputeModule(
  bootSuccess: boolean,
  sessionTick: number
): ComponentHealth {
  const score = bootSuccess ? 95 : 20;
  const issues: string[] = [];
  if (!bootSuccess) issues.push('Boot sequence failed — compute module may be faulty');
  if (sessionTick === 0) issues.push('Not yet initialised');
  return {
    component: 'compute-module',
    score,
    status: scoreToComponentStatus(score),
    issues,
  };
}

export function assessCameraSystem(sensors: GlassesOSSensor[]): ComponentHealth {
  const cams = sensors.filter(s => s.type.startsWith('camera'));
  const activeCams = cams.filter(s => s.status === 'active');
  const issues: string[] = [];

  let score: number;
  if (activeCams.length === cams.length) {
    score = 100;
  } else if (activeCams.length >= 1) {
    score = Math.round((activeCams.length / cams.length) * 70);
    issues.push(`${cams.length - activeCams.length} camera(s) not active`);
  } else {
    score = 0;
    issues.push('No cameras active — vision input unavailable');
  }

  const avgConf = cams.length > 0
    ? cams.reduce((sum, c) => sum + c.confidence, 0) / cams.length
    : 0;
  if (avgConf < 0.5 && cams.length > 0) {
    score = Math.min(score, 40);
    issues.push('Camera confidence low');
  }

  return { component: 'camera-system', score, status: scoreToComponentStatus(score), issues };
}

export function assessAudioSystem(sensors: GlassesOSSensor[]): ComponentHealth {
  const mics = sensors.filter(s => s.type.startsWith('microphone'));
  const activeMics = mics.filter(s => s.status === 'active');
  const issues: string[] = [];

  let score = activeMics.length > 0 ? Math.round((activeMics.length / mics.length) * 100) : 0;
  if (activeMics.length === 0) issues.push('No microphones active — voice input unavailable');
  else if (activeMics.length < mics.length) issues.push(`${mics.length - activeMics.length} microphone(s) not active`);

  return { component: 'audio-system', score, status: scoreToComponentStatus(score), issues };
}

export function assessSensorArray(sensors: GlassesOSSensor[]): ComponentHealth {
  const nonCamNonMic = sensors.filter(
    s => !s.type.startsWith('camera') && !s.type.startsWith('microphone')
  );
  const active = nonCamNonMic.filter(s => s.status === 'active');
  const issues: string[] = [];

  const score = nonCamNonMic.length > 0
    ? Math.round((active.length / nonCamNonMic.length) * 100)
    : 100;

  const errorSensors = nonCamNonMic.filter(s => s.status === 'error');
  for (const s of errorSensors) {
    issues.push(`Sensor error: ${s.type}`);
  }

  return { component: 'sensor-array', score, status: scoreToComponentStatus(score), issues };
}

export function assessPowerSystem(power: PowerProfile): ComponentHealth {
  const issues: string[] = [];
  let score = 100;

  if (power.batteryPct <= 10) {
    score = 20;
    issues.push('Battery critically low');
  } else if (power.batteryPct <= 20) {
    score = 55;
    issues.push('Battery low — charge soon');
  } else {
    score = Math.round(50 + power.batteryPct / 2);
  }

  if (power.thermalThrottle) {
    score = Math.min(score, 60);
    issues.push('Thermal throttling active');
  }
  if (power.temperatureC >= 55) {
    score = Math.min(score, 20);
    issues.push('Critical temperature — shutdown risk');
  }

  return { component: 'power-system', score, status: scoreToComponentStatus(score), issues };
}

export function assessStorage(bootSuccess: boolean): ComponentHealth {
  const score = bootSuccess ? 90 : 30;
  const issues = bootSuccess ? [] : ['AI model load may have failed — check flash storage'];
  return { component: 'storage', score, status: scoreToComponentStatus(score), issues };
}

export function assessGuardianEngine(
  guardianActive: boolean,
  bootSuccess: boolean
): ComponentHealth {
  const score = guardianActive ? 100 : bootSuccess ? 10 : 0;
  const issues: string[] = [];
  if (!guardianActive) issues.push('Guardian engine not running — safety system inactive');
  return { component: 'guardian-engine', score, status: scoreToComponentStatus(score), issues };
}

// ─── Full Health Report ───────────────────────────────────────────────────────

export function buildDeviceHealthReport(
  sensors: GlassesOSSensor[],
  power: PowerProfile,
  bootSuccess: boolean,
  guardianActive: boolean,
  sessionTick: number
): DeviceHealth {
  const components: ComponentHealth[] = [
    assessComputeModule(bootSuccess, sessionTick),
    assessCameraSystem(sensors),
    assessAudioSystem(sensors),
    assessSensorArray(sensors),
    assessPowerSystem(power),
    assessStorage(bootSuccess),
    assessGuardianEngine(guardianActive, bootSuccess),
  ];

  const overallScore = Math.round(
    components.reduce((sum, c) => sum + c.score, 0) / components.length
  );

  const criticalIssues = components
    .filter(c => c.status === 'critical' || c.status === 'offline')
    .flatMap(c => c.issues);

  const isOperational = overallScore >= 30 && guardianActive;

  return {
    overallScore,
    components,
    criticalIssues,
    isOperational,
    lastAssessedTick: sessionTick,
  };
}

export function identifyDegradedComponents(health: DeviceHealth): ComponentName[] {
  return health.components
    .filter(c => c.status === 'degraded' || c.status === 'critical')
    .map(c => c.component);
}

export function isHealthCritical(health: DeviceHealth): boolean {
  return health.overallScore < 30 || !health.isOperational;
}
