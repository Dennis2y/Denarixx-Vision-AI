// ─── Sprint 18: Diagnostics Engine ───────────────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware diagnostics, sensor health dashboard, performance monitor, fault history.

import type {
  DigitalTwinState,
  SensorHealthEntry,
  SensorReadingQuality,
  DiagnosticsReport,
  AIValidationResult,
  ManufacturingReadinessScore,
  SimulatedFault,
} from '@/types/simulator';
import { getActiveFaults, getFaultBySeverity } from './hardwareFaultEngine';
import { getTwinHealthScore, runAllAIValidations, buildManufacturingReadinessScore } from './digitalTwinEngine';
import { getMicQuality } from './virtualSensorEngine';

// ─── Sensor Health ────────────────────────────────────────────────────────────

function cameraQuality(isWorking: boolean, obstruction: number, lightLevel: string): SensorReadingQuality {
  if (!isWorking) return 'failed';
  if (obstruction > 0.5) return 'degraded';
  if (lightLevel === 'dark') return 'degraded';
  if (obstruction > 0.2 || lightLevel === 'dim') return 'good';
  return 'perfect';
}

function gpsQuality(hasSignal: boolean, accuracyM: number, offline: boolean): SensorReadingQuality {
  if (!hasSignal && !offline) return 'failed';
  if (offline) return 'degraded';
  if (accuracyM <= 5) return 'perfect';
  if (accuracyM <= 15) return 'good';
  return 'degraded';
}

function imuQuality(isWorking: boolean, driftFactor: number): SensorReadingQuality {
  if (!isWorking) return 'failed';
  if (driftFactor > 3) return 'degraded';
  if (driftFactor > 1.5) return 'good';
  return 'perfect';
}

function batteryQuality(pct: number, tempC: number): SensorReadingQuality {
  if (pct <= 0) return 'failed';
  if (pct <= 10 || tempC >= 55) return 'degraded';
  if (pct <= 20 || tempC >= 45) return 'good';
  return 'perfect';
}

export function buildSensorHealthDashboard(twin: DigitalTwinState): SensorHealthEntry[] {
  const entries: SensorHealthEntry[] = [];

  twin.cameras.forEach((cam, i) => {
    const quality = cameraQuality(cam.isWorking, cam.obstructionLevel, cam.lightLevel);
    const issues: string[] = [];
    if (!cam.isWorking) issues.push(`Camera ${cam.facing} offline`);
    if (cam.obstructionLevel > 0.3) issues.push(`Obstruction level: ${Math.round(cam.obstructionLevel * 100)}%`);
    if (cam.lightLevel === 'dark' || cam.lightLevel === 'dim') issues.push(`Low light: ${cam.lightLevel}`);
    entries.push({ component: `camera-${cam.facing}`, isHealthy: cam.isWorking, quality, issues });
  });

  const gpsQ = gpsQuality(twin.gps.hasSignal, twin.gps.accuracyM, twin.gps.isOfflineMode);
  const gpsIssues: string[] = [];
  if (!twin.gps.hasSignal) gpsIssues.push('No GPS signal');
  if (twin.gps.isOfflineMode) gpsIssues.push('Offline dead-reckoning mode');
  if (twin.gps.driftM > 0) gpsIssues.push(`GPS drift: ${twin.gps.driftM}m`);
  entries.push({ component: 'gps', isHealthy: twin.gps.hasSignal, quality: gpsQ, issues: gpsIssues });

  const imuQ = imuQuality(twin.imu.isWorking, twin.imu.driftFactor);
  const imuIssues: string[] = [];
  if (!twin.imu.isWorking) imuIssues.push('IMU offline');
  if (twin.imu.driftFactor > 1.5) imuIssues.push(`Drift factor: ${twin.imu.driftFactor.toFixed(1)}`);
  entries.push({ component: 'imu', isHealthy: twin.imu.isWorking, quality: imuQ, issues: imuIssues });

  const batQ = batteryQuality(twin.battery.percentage, twin.battery.temperatureC);
  const batIssues: string[] = [];
  if (twin.battery.percentage <= 10) batIssues.push('Critical battery level');
  if (twin.battery.temperatureC >= 55) batIssues.push(`Overheating: ${twin.battery.temperatureC}°C`);
  entries.push({ component: 'battery', isHealthy: twin.battery.percentage > 10, quality: batQ, issues: batIssues });

  twin.microphones.forEach((mic) => {
    const quality = getMicQuality(mic, twin.environment) as SensorReadingQuality;
    const issues: string[] = [];
    if (!mic.isWorking) issues.push(`Microphone ${mic.deviceId} offline`);
    if (mic.noiseLevel > 0.7) issues.push('High noise level');
    entries.push({ component: `mic-${mic.deviceId}`, isHealthy: mic.isWorking, quality, issues });
  });

  const spkQ: SensorReadingQuality = twin.speaker.isWorking ? 'perfect' : 'failed';
  const spkIssues = twin.speaker.isWorking ? [] : ['Bone-conduction speaker offline'];
  entries.push({ component: 'speaker', isHealthy: twin.speaker.isWorking, quality: spkQ, issues: spkIssues });

  const dispQ: SensorReadingQuality = twin.display.isOn ? (twin.display.hasOverheat ? 'degraded' : 'perfect') : 'failed';
  const dispIssues = [];
  if (!twin.display.isOn) dispIssues.push('Display off');
  if (twin.display.hasOverheat) dispIssues.push('Display overheating');
  entries.push({ component: 'display', isHealthy: twin.display.isOn, quality: dispQ, issues: dispIssues });

  return entries;
}

// ─── Diagnostics Report ───────────────────────────────────────────────────────

export function runDiagnostics(twin: DigitalTwinState): DiagnosticsReport {
  const sensors = buildSensorHealthDashboard(twin);
  const faults = getActiveFaults(twin);
  const criticalFaults = getFaultBySeverity(twin, 'critical');
  const healthScore = getTwinHealthScore(twin);
  const mfgScore = buildManufacturingReadinessScore(twin);

  let recommendation = '';
  if (!twin.isBooted) {
    recommendation = 'Simulator not booted. Call bootSimulator() first.';
  } else if (criticalFaults.length > 0) {
    recommendation = `${criticalFaults.length} critical fault(s) active. Address before manufacturing.`;
  } else if (faults.length > 0) {
    recommendation = `${faults.length} fault(s) active. Run recovery procedures.`;
  } else if (healthScore < 70) {
    recommendation = 'Health score below manufacturing threshold. Investigate sensor issues.';
  } else {
    recommendation = mfgScore.isReady
      ? 'All systems nominal. Manufacturing readiness confirmed.'
      : `${mfgScore.blockers.length} blocker(s) remain before manufacturing.`;
  }

  return {
    tick: twin.tick,
    overallHealthScore: healthScore,
    sensors,
    activeFaultCount: faults.length,
    criticalFaultCount: criticalFaults.length,
    isManufacturingReady: mfgScore.isReady,
    recommendation,
  };
}

// ─── AI Validation Report ─────────────────────────────────────────────────────

export function validateAISystems(twin: DigitalTwinState): AIValidationResult[] {
  return runAllAIValidations(twin);
}

// ─── Performance Monitor ──────────────────────────────────────────────────────

export function buildPerformanceSummary(
  twin: DigitalTwinState,
  startTick: number
): {
  uptimeTicks: number;
  batteryPct: number;
  healthScore: number;
  faultCount: number;
  environmentLabel: string;
} {
  return {
    uptimeTicks: twin.isBooted ? twin.tick - startTick : 0,
    batteryPct: twin.battery.percentage,
    healthScore: getTwinHealthScore(twin),
    faultCount: getActiveFaults(twin).length,
    environmentLabel: twin.environment.label,
  };
}

// ─── Fault History ────────────────────────────────────────────────────────────

export function getFaultHistory(twin: DigitalTwinState): SimulatedFault[] {
  return twin.activeFaults;
}

export function buildManufacturingReadinessReport(
  twin: DigitalTwinState
): ManufacturingReadinessScore {
  return buildManufacturingReadinessScore(twin);
}
