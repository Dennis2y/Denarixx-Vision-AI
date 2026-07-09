// ─── Sprint 18: Glasses Simulator Engine ─────────────────────────────────────
// Pure functions — no async, no I/O.
// Top-level orchestrator for the Denarixx Vision Glasses Digital Twin.

import type {
  DigitalTwinState,
  EnvironmentType,
  VirtualCamera,
  VirtualGPS,
  VirtualIMU,
  VirtualBattery,
  VirtualMicrophone,
  VirtualSpeaker,
  VirtualDisplay,
  SimulatorMode,
} from '@/types/simulator';
import { TWIN_NOTE } from '@/types/simulator';
import { ENVIRONMENT_REGISTRY, applyEnvironment } from './environmentSimulationEngine';
import { simulateBatteryTick } from './virtualSensorEngine';

// ─── Default Component States ─────────────────────────────────────────────────

function defaultCameras(): VirtualCamera[] {
  return [
    { deviceId: 'cam-front',      facing: 'front',      isWorking: true, fps: 30, obstructionLevel: 0, lightLevel: 'normal', faultReason: null },
    { deviceId: 'cam-side-left',  facing: 'side-left',  isWorking: true, fps: 30, obstructionLevel: 0, lightLevel: 'normal', faultReason: null },
    { deviceId: 'cam-side-right', facing: 'side-right', isWorking: true, fps: 30, obstructionLevel: 0, lightLevel: 'normal', faultReason: null },
  ];
}

function defaultGPS(): VirtualGPS {
  return { hasSignal: true, accuracyM: 5, driftM: 0, isOfflineMode: false };
}

function defaultIMU(): VirtualIMU {
  return { isWorking: true, driftFactor: 1.0, temperatureC: 28 };
}

function defaultBattery(): VirtualBattery {
  return { percentage: 85, temperatureC: 30, drainRateMultiplier: 1.0, isCharging: false };
}

function defaultMicrophones(): VirtualMicrophone[] {
  return [
    { deviceId: 'mic-left',  isWorking: true, noiseLevel: 0.1, wakeWordEnabled: true },
    { deviceId: 'mic-right', isWorking: true, noiseLevel: 0.1, wakeWordEnabled: false },
  ];
}

function defaultSpeaker(): VirtualSpeaker {
  return { deviceId: 'bone-spk-0', isWorking: true, volume: 80, isBoneConductionActive: true };
}

function defaultDisplay(): VirtualDisplay {
  return { isOn: true, brightness: 60, mode: 'hud', hasOverheat: false };
}

// ─── Simulator Lifecycle ──────────────────────────────────────────────────────

export function createGlassesSimulator(
  initialEnvironment: EnvironmentType = 'quiet-street'
): DigitalTwinState {
  const env = ENVIRONMENT_REGISTRY[initialEnvironment];
  return {
    platform: 'simulation',
    cameras: defaultCameras(),
    gps: defaultGPS(),
    imu: defaultIMU(),
    battery: defaultBattery(),
    microphones: defaultMicrophones(),
    speaker: defaultSpeaker(),
    display: defaultDisplay(),
    activeFaults: [],
    environment: env,
    tick: 0,
    isBooted: false,
    bootedAtTick: 0,
  };
}

export function bootSimulator(twin: DigitalTwinState, tick: number): DigitalTwinState {
  return { ...twin, isBooted: true, bootedAtTick: tick, tick };
}

export function tickSimulator(twin: DigitalTwinState, tick: number): DigitalTwinState {
  if (!twin.isBooted) return twin;
  const battery = simulateBatteryTick(twin.battery, twin.environment, tick);
  return { ...twin, tick, battery };
}

export function resetSimulator(twin: DigitalTwinState): DigitalTwinState {
  return createGlassesSimulator(twin.environment.type);
}

export function setSimulatorEnvironment(
  twin: DigitalTwinState,
  type: EnvironmentType
): DigitalTwinState {
  return applyEnvironment(twin, type);
}

// ─── Simulator Queries ────────────────────────────────────────────────────────

export function getWorkingCameraCount(twin: DigitalTwinState): number {
  return twin.cameras.filter(c => c.isWorking).length;
}

export function isSimulatorHealthy(twin: DigitalTwinState): boolean {
  const anyCamera = twin.cameras.some(c => c.isWorking);
  const speakerOk = twin.speaker.isWorking;
  const batteryOk = twin.battery.percentage > 10;
  return anyCamera && speakerOk && batteryOk;
}

export function getSimulatorSummary(twin: DigitalTwinState): {
  isBooted: boolean;
  platform: string;
  environment: string;
  batteryPct: number;
  activeFaultCount: number;
  workingCameras: number;
  isHealthy: boolean;
  uptimeTicks: number;
  twinNote: string;
} {
  return {
    isBooted: twin.isBooted,
    platform: twin.platform,
    environment: twin.environment.label,
    batteryPct: twin.battery.percentage,
    activeFaultCount: twin.activeFaults.filter(f => f.isActive).length,
    workingCameras: getWorkingCameraCount(twin),
    isHealthy: isSimulatorHealthy(twin),
    uptimeTicks: twin.isBooted ? twin.tick - twin.bootedAtTick : 0,
    twinNote: TWIN_NOTE,
  };
}

export function getSimulatorMode(twin: DigitalTwinState): SimulatorMode {
  if (twin.activeFaults.length > 5) return 'stress';
  if (twin.activeFaults.length > 0) return 'scripted';
  return 'manual';
}

export function getComponentStatuses(twin: DigitalTwinState): {
  component: string;
  isHealthy: boolean;
}[] {
  return [
    { component: 'camera-front',     isHealthy: twin.cameras[0]?.isWorking ?? false },
    { component: 'camera-side-left', isHealthy: twin.cameras[1]?.isWorking ?? false },
    { component: 'camera-side-right',isHealthy: twin.cameras[2]?.isWorking ?? false },
    { component: 'gps',              isHealthy: twin.gps.hasSignal },
    { component: 'imu',              isHealthy: twin.imu.isWorking },
    { component: 'battery',          isHealthy: twin.battery.percentage > 10 },
    { component: 'microphone-left',  isHealthy: twin.microphones[0]?.isWorking ?? false },
    { component: 'microphone-right', isHealthy: twin.microphones[1]?.isWorking ?? false },
    { component: 'speaker',          isHealthy: twin.speaker.isWorking },
    { component: 'display',          isHealthy: twin.display.isOn },
    { component: 'imu-temperature',  isHealthy: twin.imu.temperatureC < 55 },
  ];
}
