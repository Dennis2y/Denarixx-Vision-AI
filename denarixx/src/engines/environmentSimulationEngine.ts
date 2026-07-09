// ─── Sprint 18: Environment Simulation Engine ─────────────────────────────────
// Pure functions — no async, no I/O.
// 11 environment profiles for testing Denarixx Vision Glasses in varied conditions.

import type {
  EnvironmentType,
  EnvironmentProfile,
  LightLevel,
  DigitalTwinState,
  SimulatedSensorContext,
} from '@/types/simulator';

// ─── Environment Registry ─────────────────────────────────────────────────────

export const ENVIRONMENT_REGISTRY: Record<EnvironmentType, EnvironmentProfile> = {
  'busy-city': {
    type: 'busy-city',
    label: 'Busy City Street',
    gpsAccuracyM: 8,
    ambientNoiseLevel: 0.85,
    lightLevel: 'normal',
    hazardDensity: 'high',
    indoorMode: false,
    weatherCondition: 'clear',
    typicalHazards: ['pedestrians', 'cyclists', 'vehicles', 'kerbs', 'crossings'],
  },
  'quiet-street': {
    type: 'quiet-street',
    label: 'Quiet Residential Street',
    gpsAccuracyM: 4,
    ambientNoiseLevel: 0.2,
    lightLevel: 'normal',
    hazardDensity: 'low',
    indoorMode: false,
    weatherCondition: 'clear',
    typicalHazards: ['parked cars', 'uneven pavement'],
  },
  'shopping-mall': {
    type: 'shopping-mall',
    label: 'Shopping Mall',
    gpsAccuracyM: 35,
    ambientNoiseLevel: 0.75,
    lightLevel: 'bright',
    hazardDensity: 'high',
    indoorMode: true,
    weatherCondition: 'clear',
    typicalHazards: ['crowds', 'escalators', 'glass doors', 'trolleys'],
  },
  'airport': {
    type: 'airport',
    label: 'Airport Terminal',
    gpsAccuracyM: 40,
    ambientNoiseLevel: 0.80,
    lightLevel: 'bright',
    hazardDensity: 'high',
    indoorMode: true,
    weatherCondition: 'clear',
    typicalHazards: ['luggage trolleys', 'moving walkways', 'crowds', 'announcements'],
  },
  'train-station': {
    type: 'train-station',
    label: 'Train Station',
    gpsAccuracyM: 30,
    ambientNoiseLevel: 0.90,
    lightLevel: 'normal',
    hazardDensity: 'high',
    indoorMode: true,
    weatherCondition: 'clear',
    typicalHazards: ['platform edge', 'crowds', 'moving trains', 'stairs', 'gaps'],
  },
  'rain': {
    type: 'rain',
    label: 'Rainy Conditions',
    gpsAccuracyM: 12,
    ambientNoiseLevel: 0.60,
    lightLevel: 'dim',
    hazardDensity: 'medium',
    indoorMode: false,
    weatherCondition: 'rain',
    typicalHazards: ['wet surfaces', 'puddles', 'reduced visibility', 'umbrellas'],
  },
  'fog': {
    type: 'fog',
    label: 'Foggy Conditions',
    gpsAccuracyM: 10,
    ambientNoiseLevel: 0.30,
    lightLevel: 'dim',
    hazardDensity: 'medium',
    indoorMode: false,
    weatherCondition: 'fog',
    typicalHazards: ['reduced camera visibility', 'vehicles', 'kerbs'],
  },
  'night': {
    type: 'night',
    label: 'Night-time',
    gpsAccuracyM: 6,
    ambientNoiseLevel: 0.15,
    lightLevel: 'dark',
    hazardDensity: 'medium',
    indoorMode: false,
    weatherCondition: 'clear',
    typicalHazards: ['low visibility', 'vehicles with headlights', 'unlit obstacles'],
  },
  'snow': {
    type: 'snow',
    label: 'Snowy Conditions',
    gpsAccuracyM: 15,
    ambientNoiseLevel: 0.25,
    lightLevel: 'dim',
    hazardDensity: 'medium',
    indoorMode: false,
    weatherCondition: 'snow',
    typicalHazards: ['icy surfaces', 'reduced grip', 'obscured kerbs', 'snowdrifts'],
  },
  'strong-sunlight': {
    type: 'strong-sunlight',
    label: 'Strong Sunlight',
    gpsAccuracyM: 3,
    ambientNoiseLevel: 0.35,
    lightLevel: 'bright',
    hazardDensity: 'low',
    indoorMode: false,
    weatherCondition: 'bright',
    typicalHazards: ['camera glare', 'display washout', 'overheating risk'],
  },
  'indoor-navigation': {
    type: 'indoor-navigation',
    label: 'Indoor Navigation',
    gpsAccuracyM: 50,
    ambientNoiseLevel: 0.40,
    lightLevel: 'normal',
    hazardDensity: 'medium',
    indoorMode: true,
    weatherCondition: 'clear',
    typicalHazards: ['doors', 'stairs', 'lifts', 'furniture', 'low ceilings'],
  },
};

// ─── Query Functions ──────────────────────────────────────────────────────────

export function getEnvironmentProfile(type: EnvironmentType): EnvironmentProfile {
  return ENVIRONMENT_REGISTRY[type];
}

export function getGPSAccuracyForEnvironment(type: EnvironmentType): number {
  return ENVIRONMENT_REGISTRY[type].gpsAccuracyM;
}

export function getNoiseLevelForEnvironment(type: EnvironmentType): number {
  return ENVIRONMENT_REGISTRY[type].ambientNoiseLevel;
}

export function getLightLevelForEnvironment(type: EnvironmentType): LightLevel {
  return ENVIRONMENT_REGISTRY[type].lightLevel;
}

export function getTypicalHazards(type: EnvironmentType): string[] {
  return ENVIRONMENT_REGISTRY[type].typicalHazards;
}

export function isIndoorEnvironment(type: EnvironmentType): boolean {
  return ENVIRONMENT_REGISTRY[type].indoorMode;
}

export function getHazardDensityScore(type: EnvironmentType): number {
  const density = ENVIRONMENT_REGISTRY[type].hazardDensity;
  return density === 'high' ? 1.0 : density === 'medium' ? 0.5 : 0.2;
}

export function getAllEnvironmentTypes(): EnvironmentType[] {
  return Object.keys(ENVIRONMENT_REGISTRY) as EnvironmentType[];
}

// ─── Apply to Twin ────────────────────────────────────────────────────────────

export function applyEnvironment(
  twin: DigitalTwinState,
  type: EnvironmentType
): DigitalTwinState {
  const profile = ENVIRONMENT_REGISTRY[type];
  return {
    ...twin,
    environment: profile,
    cameras: twin.cameras.map(cam => ({
      ...cam,
      lightLevel: profile.lightLevel,
    })),
    gps: {
      ...twin.gps,
      accuracyM: profile.gpsAccuracyM,
      isOfflineMode: profile.indoorMode || profile.gpsAccuracyM > 30,
    },
    microphones: twin.microphones.map(mic => ({
      ...mic,
      noiseLevel: profile.ambientNoiseLevel,
    })),
  };
}

// ─── Sensor Context ───────────────────────────────────────────────────────────

export function buildEnvironmentContext(
  type: EnvironmentType,
  tick: number
): SimulatedSensorContext {
  const profile = ENVIRONMENT_REGISTRY[type];
  return {
    environment: type,
    tick,
    lightLevel: profile.lightLevel,
    noiseLevel: profile.ambientNoiseLevel,
    gpsAvailable: profile.gpsAccuracyM <= 30,
  };
}

export function getEnvironmentCameraChallenge(type: EnvironmentType): number {
  const { lightLevel, weatherCondition } = ENVIRONMENT_REGISTRY[type];
  let challenge = 0;
  if (lightLevel === 'dark') challenge += 0.5;
  else if (lightLevel === 'dim') challenge += 0.25;
  if (weatherCondition === 'fog') challenge += 0.4;
  if (weatherCondition === 'rain') challenge += 0.2;
  if (weatherCondition === 'bright') challenge += 0.15;
  return Math.min(1, challenge);
}

export function needsBoneConductionBoost(type: EnvironmentType): boolean {
  return ENVIRONMENT_REGISTRY[type].ambientNoiseLevel > 0.7;
}
