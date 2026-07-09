// ─── Sprint 20: Prototype Integration Engine ──────────────────────────────────

import type {
  HardwareInterface,
  HardwareInterfaceType,
  IntegrationStatus,
  PrototypeIntegrationState,
} from '@/types/prototype';

import {
  INTEGRATION_DISCLAIMER,
  TOTAL_HARDWARE_INTERFACES,
  INTEGRATION_SCORE_EVT_THRESHOLD,
} from '@/types/prototype';

// ─── Interface registry ────────────────────────────────────────────────────────

export const INTERFACE_REGISTRY: HardwareInterface[] = [
  {
    type: 'camera',
    protocol: 'MIPI CSI-2 (4-lane)',
    halDriver: 'cameraHAL.ts',
    status: 'not-started',
    requiredSprint: 14,
    notes: '4-camera array; fallback chain front-wide → front-tele → side-left → side-right',
  },
  {
    type: 'microphone',
    protocol: 'PDM (3.072 MHz)',
    halDriver: 'microphoneHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: '3× MEMS mic; always-on DSP wake word path',
  },
  {
    type: 'bone-audio',
    protocol: 'I2S (48 kHz, 24-bit)',
    halDriver: 'speakerHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: '2× bone-conduction transducer; priority queue; emergency override',
  },
  {
    type: 'battery',
    protocol: 'I2C (fuel gauge)',
    halDriver: 'batteryHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: 'Li-Po 2500 mAh; CRITICAL_BATTERY_ANNOUNCEMENT at ≤10%',
  },
  {
    type: 'gps',
    protocol: 'UART (9600 bps)',
    halDriver: 'gpsHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: 'Multi-constellation GNSS; dead-reckoning via IMU when unavailable',
  },
  {
    type: 'imu',
    protocol: 'SPI (or I2C)',
    halDriver: 'imuHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: '6-axis accel + gyro; 200 Hz; fall detection',
  },
  {
    type: 'compass',
    protocol: 'I2C (400 kHz)',
    halDriver: 'imuHAL.ts (getHeading)',
    status: 'not-started',
    requiredSprint: 17,
    notes: '3-axis magnetometer; hard/soft iron calibration on boot',
  },
  {
    type: 'display',
    protocol: 'MIPI DSI',
    halDriver: 'displayHAL.ts',
    status: 'not-started',
    requiredSprint: 17,
    notes: 'Optional HUD; modes: hud/low-power/off/ar-overlay; may be absent in EVT',
  },
  {
    type: 'button',
    protocol: 'GPIO (digital input)',
    halDriver: 'buttonHAL.ts (planned)',
    status: 'not-started',
    requiredSprint: 20,
    notes: '2 physical buttons: power, guardian trigger',
  },
  {
    type: 'touch',
    protocol: 'I2C (capacitive controller)',
    halDriver: 'touchHAL.ts (planned)',
    status: 'not-started',
    requiredSprint: 20,
    notes: 'Capacitive strip on temple arms; 5 gestures',
  },
  {
    type: 'usb-c',
    protocol: 'USB 3.2 Gen 1',
    halDriver: 'host OS (kernel driver)',
    status: 'not-started',
    requiredSprint: 20,
    notes: 'Charging PD 45W; ADB debugging; DisplayPort alt mode',
  },
  {
    type: 'wireless',
    protocol: 'PCIe/SDIO → Wi-Fi 6 + BT 5.3',
    halDriver: 'host OS (kernel driver)',
    status: 'not-started',
    requiredSprint: 20,
    notes: 'OTA model updates; phone companion link; optional eSIM/LTE',
  },
];

// ─── Critical interfaces that must be validated for EVT ───────────────────────

const CRITICAL_INTERFACE_TYPES: HardwareInterfaceType[] = [
  'camera',
  'bone-audio',
  'battery',
  'gps',
  'imu',
  'microphone',
];

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createPrototypeIntegrationState(deviceId: string): PrototypeIntegrationState {
  const interfaces = INTERFACE_REGISTRY.map(iface => ({ ...iface }));
  return {
    deviceId,
    platform: 'prototype',
    interfaces,
    overallStatus: 'not-started',
    validatedInterfaces: 0,
    totalInterfaces: TOTAL_HARDWARE_INTERFACES,
    integrationScore: 0,
    readyForEVT: false,
  };
}

// ─── Status management ────────────────────────────────────────────────────────

export function updateInterfaceStatus(
  state: PrototypeIntegrationState,
  type: HardwareInterfaceType,
  status: IntegrationStatus,
): PrototypeIntegrationState {
  const interfaces = state.interfaces.map(iface =>
    iface.type === type ? { ...iface, status } : iface,
  );
  return recomputeState({ ...state, interfaces });
}

export function recomputeState(state: PrototypeIntegrationState): PrototypeIntegrationState {
  const validated = state.interfaces.filter(i => i.status === 'validated').length;
  const inProgress = state.interfaces.filter(i => i.status === 'in-progress').length;
  const failed = state.interfaces.filter(i => i.status === 'failed').length;
  const total = state.interfaces.length;

  const score = total === 0 ? 0 : Math.round((validated / total) * 100);

  let overallStatus: IntegrationStatus = 'not-started';
  if (failed > 0) {
    overallStatus = 'failed';
  } else if (validated === total) {
    overallStatus = 'validated';
  } else if (validated > 0 || inProgress > 0) {
    overallStatus = 'in-progress';
  }

  const criticalValidated = CRITICAL_INTERFACE_TYPES.every(type =>
    state.interfaces.find(i => i.type === type)?.status === 'validated',
  );

  const readyForEVT = score >= INTEGRATION_SCORE_EVT_THRESHOLD && criticalValidated;

  return {
    ...state,
    validatedInterfaces: validated,
    integrationScore: score,
    overallStatus,
    readyForEVT,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getInterfaceByType(
  state: PrototypeIntegrationState,
  type: HardwareInterfaceType,
): HardwareInterface | undefined {
  return state.interfaces.find(i => i.type === type);
}

export function getCriticalInterfaces(
  state: PrototypeIntegrationState,
): HardwareInterface[] {
  return state.interfaces.filter(i =>
    CRITICAL_INTERFACE_TYPES.includes(i.type as HardwareInterfaceType),
  );
}

export function getFailedInterfaces(
  state: PrototypeIntegrationState,
): HardwareInterface[] {
  return state.interfaces.filter(i => i.status === 'failed');
}

export function getUnstartedInterfaces(
  state: PrototypeIntegrationState,
): HardwareInterface[] {
  return state.interfaces.filter(i => i.status === 'not-started');
}

export function allCriticalValidated(state: PrototypeIntegrationState): boolean {
  return CRITICAL_INTERFACE_TYPES.every(type =>
    state.interfaces.find(i => i.type === type)?.status === 'validated',
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getIntegrationSummary(state: PrototypeIntegrationState): string {
  const { validatedInterfaces, totalInterfaces, integrationScore, readyForEVT } = state;
  const evtLabel = readyForEVT ? 'EVT-ready' : 'not EVT-ready';
  return (
    `Device ${state.deviceId}: ${validatedInterfaces}/${totalInterfaces} interfaces validated ` +
    `(score ${integrationScore}/100, ${evtLabel})`
  );
}

export function getIntegrationDisclaimer(): string {
  return INTEGRATION_DISCLAIMER;
}

export { CRITICAL_INTERFACE_TYPES };
