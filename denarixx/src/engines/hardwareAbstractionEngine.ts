// ─── Sprint 17: Hardware Abstraction Engine ───────────────────────────────────
// Pure functions — no async, no I/O.
// Top-level HAL coordinator. AI communicates here — never directly to hardware.
// Supports: simulation, prototype, android-xr, linux-wearable, denarixx-v1.

import type {
  HardwarePlatform,
  HALRegistration,
  HALSystemState,
  HALComponentType,
  SensorHealthReport,
} from '@/types/hardwareHAL';
import {
  SIMULATION_DRIVER,
  SUPPORTED_PLATFORMS,
  HAL_SAFETY_NOTE,
} from '@/types/hardwareHAL';
import { getCameraDriver } from './cameraHAL';
import { getMicDriver } from './microphoneHAL';
import { getSpeakerDriver } from './speakerHAL';
import { getIMUDriver } from './imuHAL';
import { getGPSDriver } from './gpsHAL';
import { getBatteryDriver } from './batteryHAL';
import { getDisplayDriver } from './displayHAL';

// ─── HAL System ───────────────────────────────────────────────────────────────

export interface HALSystem {
  platform: HardwarePlatform;
  initialized: boolean;
  registrations: HALRegistration[];
  tick: number;
}

export function createHALSystem(platform: HardwarePlatform = 'simulation'): HALSystem {
  return {
    platform,
    initialized: false,
    registrations: [],
    tick: 0,
  };
}

export function initializeHALSystem(system: HALSystem, tick: number): HALSystem {
  const defaultDrivers: { component: HALComponentType; getDriver: (p: string) => string }[] = [
    { component: 'camera',     getDriver: getCameraDriver },
    { component: 'microphone', getDriver: getMicDriver },
    { component: 'speaker',    getDriver: getSpeakerDriver },
    { component: 'imu',        getDriver: getIMUDriver },
    { component: 'gps',        getDriver: getGPSDriver },
    { component: 'battery',    getDriver: getBatteryDriver },
    { component: 'display',    getDriver: getDisplayDriver },
  ];

  const registrations: HALRegistration[] = defaultDrivers.map(({ component, getDriver }) => ({
    component,
    deviceId: `${system.platform}-${component}-0`,
    platform: system.platform,
    driver: getDriver(system.platform),
  }));

  return { ...system, initialized: true, registrations, tick };
}

export function registerDriver(
  system: HALSystem,
  registration: HALRegistration
): HALSystem {
  const existing = system.registrations.findIndex(
    r => r.component === registration.component && r.deviceId === registration.deviceId
  );
  if (existing >= 0) {
    const updated = [...system.registrations];
    updated[existing] = registration;
    return { ...system, registrations: updated };
  }
  return { ...system, registrations: [...system.registrations, registration] };
}

export function getRegisteredDrivers(system: HALSystem): HALRegistration[] {
  return system.registrations;
}

export function getDriverForComponent(
  system: HALSystem,
  component: HALComponentType
): HALRegistration | null {
  return system.registrations.find(r => r.component === component) ?? null;
}

// ─── Platform Support ─────────────────────────────────────────────────────────

export function isSupportedPlatform(platform: string): platform is HardwarePlatform {
  return SUPPORTED_PLATFORMS.includes(platform as HardwarePlatform);
}

export function getPlatformLabel(platform: HardwarePlatform): string {
  const labels: Record<HardwarePlatform, string> = {
    simulation:       'Software Simulation',
    prototype:        'Raspberry Pi Prototype',
    'android-xr':     'Android XR Smart Glasses',
    'linux-wearable': 'Linux Wearable',
    'denarixx-v1':    'Denarixx Vision Glasses v1',
  };
  return labels[platform];
}

export function getPlatformNotes(platform: HardwarePlatform): string[] {
  const notes: Record<HardwarePlatform, string[]> = {
    simulation: [
      'All hardware simulated in software.',
      'Suitable for development and automated testing.',
      'No real sensor data — confidence values are synthetic.',
    ],
    prototype: [
      'Raspberry Pi or compatible ARM compute module.',
      'V4L2 camera driver (USB or CSI camera).',
      'ALSA audio, gpsd for GNSS, IIO for IMU.',
      'Suitable for lab prototyping and early field trials.',
    ],
    'android-xr': [
      'Android XR API / Camera2 / AudioRecord / LocationManager.',
      'Full OS power management via Android battery intent.',
      'Suitable for off-the-shelf Android XR hardware partnerships.',
    ],
    'linux-wearable': [
      'Custom Linux-based smart glasses hardware.',
      'V4L2 + ALSA + gpsd + IIO driver stack.',
      'Full control over hardware, suitable for production builds.',
    ],
    'denarixx-v1': [
      'First Denarixx custom hardware (Q4 2027 target).',
      'All native Denarixx drivers — bone conduction, 4-camera array, integrated GNSS.',
      'HAL connects AI directly to proprietary hardware layer.',
    ],
  };
  return notes[platform];
}

// ─── HAL System State ─────────────────────────────────────────────────────────

export function buildHALSystemState(
  system: HALSystem,
  healthyCount: number
): HALSystemState {
  return {
    platform: system.platform,
    initialized: system.initialized,
    registrations: system.registrations,
    healthyCount,
    totalCount: system.registrations.length,
    lastHealthCheckTick: system.tick,
  };
}

export function buildHALIntegrationBridge(system: HALSystem): {
  glassesRuntime: boolean;
  guardian: boolean;
  navigation: boolean;
  offlineEngine: boolean;
  visionEngine: boolean;
  voiceEngine: boolean;
  memory: boolean;
  privacy: boolean;
} {
  const ready = system.initialized;
  return {
    glassesRuntime: ready,
    guardian:       ready,
    navigation:     ready,
    offlineEngine:  ready,
    visionEngine:   ready,
    voiceEngine:    ready,
    memory:         ready,
    privacy:        ready,
  };
}

export function getHALNote(): string {
  return HAL_SAFETY_NOTE;
}

export function getHALComponentCount(system: HALSystem): number {
  return system.registrations.length;
}

export function advanceTick(system: HALSystem): HALSystem {
  return { ...system, tick: system.tick + 1 };
}
