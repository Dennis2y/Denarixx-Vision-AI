/**
 * Sensor Fusion tests (V7)
 *
 * Tests SensorFusionEngine (motion classification, heading fusion,
 * battery mode, urgency modifier) and LocationPrivacyEngine (fuzzing,
 * storage consent, distance, note generation).
 *
 * Run: npx tsx tests/sensorFusion.test.ts
 */

import { SensorFusionEngine } from '../src/engines/sensorFusionEngine';
import { LocationPrivacyEngine } from '../src/engines/locationPrivacyEngine';
import type { MotionReading, GPSReading, CompassReading, BatteryState, SensorPermissions } from '../src/types/sensors';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(actual: T) {
  return {
    toBe(expected: T, label: string) {
      if (actual === expected) { console.log(`  ✓ ${label}`); passed++; }
      else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    received: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toBeTrue(label: string)  { this.toBe(true as unknown as T, label); },
    toBeFalse(label: string) { this.toBe(false as unknown as T, label); },
    toBeNull(label: string)  { this.toBe(null as unknown as T, label); },
    toBeGreaterThan(n: number, label: string) {
      const ok = (actual as unknown as number) > n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: ${actual} not > ${n}`); failed++; }
    },
    toBeLessThan(n: number, label: string) {
      const ok = (actual as unknown as number) < n;
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: ${actual} not < ${n}`); failed++; }
    },
    toContain(s: string, label: string) {
      const ok = String(actual).includes(s);
      if (ok) { console.log(`  ✓ ${label}`); passed++; }
      else { console.error(`  ✗ ${label}: "${actual}" does not contain "${s}"`); failed++; }
    },
  };
}

function describe(label: string, fn: () => void) {
  console.log(`\n${label}`);
  fn();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date();
const BASE_PERMISSIONS: SensorPermissions = {
  geolocation: 'unavailable',
  deviceOrientation: 'unavailable',
  deviceMotion: 'unavailable',
  vibration: false,
  battery: false,
};

function mkMotion(ax: number, ay: number, az: number, rotGamma = 0): MotionReading {
  return {
    acceleration: { x: ax, y: ay, z: az },
    accelerationIncludingGravity: null,
    rotationRate: { alpha: 0, beta: 0, gamma: rotGamma },
    interval: 50,
    timestamp: NOW,
  };
}

function mkGPS(speed: number | null = null): GPSReading {
  return {
    latitude: 51.505,
    longitude: -0.09,
    accuracy: 10,
    heading: 90,
    speed,
    altitude: null,
    altitudeAccuracy: null,
    timestamp: NOW,
  };
}

function mkCompass(alpha: number): CompassReading {
  return { alpha, beta: 0, gamma: 0, absolute: true, timestamp: NOW };
}

function mkBattery(level: number, charging: boolean): BatteryState {
  return { level, charging, chargingTime: null, dischargingTime: null };
}

// ─── SensorFusionEngine — motion classification ───────────────────────────────

describe('SensorFusionEngine — standing (low acceleration)', () => {
  const engine = new SensorFusionEngine();
  // Fill sliding window with standing-level values
  for (let i = 0; i < 8; i++) {
    engine.classifyMotion(mkMotion(0.1, 0.1, 0.05), null);
  }
  const state = engine.classifyMotion(mkMotion(0.1, 0.1, 0.05), null);
  expect(state).toBe('standing', 'low acceleration → standing');
});

describe('SensorFusionEngine — walking (medium acceleration)', () => {
  const engine = new SensorFusionEngine();
  for (let i = 0; i < 8; i++) {
    engine.classifyMotion(mkMotion(0.8, 0.8, 0.6), null);
  }
  const state = engine.classifyMotion(mkMotion(0.8, 0.8, 0.6), null);
  expect(state).toBe('walking', 'medium acceleration → walking');
});

describe('SensorFusionEngine — running (high acceleration)', () => {
  const engine = new SensorFusionEngine();
  for (let i = 0; i < 8; i++) {
    engine.classifyMotion(mkMotion(3.5, 3.5, 2.5), null);
  }
  const state = engine.classifyMotion(mkMotion(3.5, 3.5, 2.5), null);
  expect(state).toBe('running', 'high acceleration → running');
});

describe('SensorFusionEngine — turning (high rotation rate)', () => {
  const engine = new SensorFusionEngine();
  // High gamma rotation + some acceleration
  for (let i = 0; i < 8; i++) {
    engine.classifyMotion(mkMotion(1.0, 1.0, 0.5, 35), null);
  }
  const state = engine.classifyMotion(mkMotion(1.0, 1.0, 0.5, 35), null);
  expect(state).toBe('turning', 'high rotation rate → turning');
});

describe('SensorFusionEngine — null motion falls back to GPS speed', () => {
  const engine = new SensorFusionEngine();
  expect(engine.classifyMotion(null, null)).toBe('unknown', 'no motion no GPS → unknown');
  expect(engine.classifyMotion(null, mkGPS(0.1))).toBe('standing', 'GPS speed 0.1 → standing');
  expect(engine.classifyMotion(null, mkGPS(1.5))).toBe('walking',  'GPS speed 1.5 → walking');
  expect(engine.classifyMotion(null, mkGPS(3.5))).toBe('running',  'GPS speed 3.5 → running');
  expect(engine.classifyMotion(null, mkGPS(20))).toBe('riding',   'GPS speed 20 → riding');
});

describe('SensorFusionEngine — reset clears window', () => {
  const engine = new SensorFusionEngine();
  for (let i = 0; i < 8; i++) engine.classifyMotion(mkMotion(3.5, 3.5, 2.5), null);
  engine.reset();
  // After reset, a single standing reading should classify as standing
  const state = engine.classifyMotion(mkMotion(0.1, 0.1, 0.05), null);
  expect(state).toBe('standing', 'after reset, single standing reading → standing');
});

// ─── SensorFusionEngine — heading fusion ─────────────────────────────────────

describe('SensorFusionEngine — compass heading preferred', () => {
  const engine = new SensorFusionEngine();
  const heading = engine.fuseHeading(mkCompass(270), mkGPS(1.5));
  expect(heading).toBe(270, 'compass heading = 270 used over GPS');
});

describe('SensorFusionEngine — GPS heading fallback', () => {
  const engine = new SensorFusionEngine();
  const heading = engine.fuseHeading(null, mkGPS(1.5));
  expect(heading).toBe(90, 'no compass → GPS heading (90°) used');
});

describe('SensorFusionEngine — null heading when no sensors', () => {
  const engine = new SensorFusionEngine();
  expect(engine.fuseHeading(null, null)).toBe(null, 'no sensors → null heading');
});

describe('SensorFusionEngine — headingToDirection', () => {
  const engine = new SensorFusionEngine();
  expect(engine.headingToDirection(0)).toBe('N', '0° → N');
  expect(engine.headingToDirection(45)).toBe('NE', '45° → NE');
  expect(engine.headingToDirection(90)).toBe('E', '90° → E');
  expect(engine.headingToDirection(135)).toBe('SE', '135° → SE');
  expect(engine.headingToDirection(180)).toBe('S', '180° → S');
  expect(engine.headingToDirection(225)).toBe('SW', '225° → SW');
  expect(engine.headingToDirection(270)).toBe('W', '270° → W');
  expect(engine.headingToDirection(315)).toBe('NW', '315° → NW');
});

// ─── SensorFusionEngine — battery mode ───────────────────────────────────────

describe('SensorFusionEngine — isLowPowerMode', () => {
  const engine = new SensorFusionEngine();
  expect(engine.isLowPowerMode(mkBattery(0.15, false), true)).toBeTrue('15% discharging → low power');
  expect(engine.isLowPowerMode(mkBattery(0.15, true), true)).toBeFalse('15% but charging → not low power');
  expect(engine.isLowPowerMode(mkBattery(0.5, false), true)).toBeFalse('50% → not low power');
  expect(engine.isLowPowerMode(mkBattery(0.15, false), false)).toBeFalse('battery aware off → not low power');
  expect(engine.isLowPowerMode(null, true)).toBeFalse('null battery → not low power');
});

// ─── SensorFusionEngine — urgency modifier ────────────────────────────────────

describe('SensorFusionEngine — urgencyModifier', () => {
  const engine = new SensorFusionEngine();
  expect(engine.urgencyModifier('running')).toBe('elevate', 'running → elevate');
  expect(engine.urgencyModifier('riding')).toBe('elevate',  'riding → elevate');
  expect(engine.urgencyModifier('walking')).toBe('normal',  'walking → normal');
  expect(engine.urgencyModifier('turning')).toBe('normal',  'turning → normal');
  expect(engine.urgencyModifier('standing')).toBe('reduce', 'standing → reduce');
  expect(engine.urgencyModifier('unknown')).toBe('normal',  'unknown → normal');
});

// ─── SensorFusionEngine — frame interval ─────────────────────────────────────

describe('SensorFusionEngine — recommendedFrameInterval', () => {
  const engine = new SensorFusionEngine();
  expect(engine.recommendedFrameInterval('walking', false)).toBe(3000, 'walking normal → 3000ms');
  expect(engine.recommendedFrameInterval('standing', false)).toBe(5000, 'standing → 5000ms');
  expect(engine.recommendedFrameInterval('running', false)).toBe(2000, 'running → 2000ms');
  expect(engine.recommendedFrameInterval('walking', true)).toBe(8000, 'low power → 8000ms');
});

// ─── SensorFusionEngine — motionNote ─────────────────────────────────────────

describe('SensorFusionEngine — motionNote', () => {
  const engine = new SensorFusionEngine();
  expect(engine.motionNote('running')).toContain('quickly', 'running note mentions speed');
  expect(engine.motionNote('turning')).toContain('Turning', 'turning note mentions turning');
  expect(engine.motionNote('walking')).toBe(null, 'walking → null (no note)');
  expect(engine.motionNote('standing')).toBe(null, 'standing → null');
});

// ─── SensorFusionEngine — fuse() ─────────────────────────────────────────────

describe('SensorFusionEngine — fuse() produces valid context', () => {
  const engine = new SensorFusionEngine();
  const ctx = engine.fuse(mkGPS(1.5), mkCompass(90), mkMotion(0.8, 0.8, 0.6), mkBattery(0.6, false), BASE_PERMISSIONS, true);
  expect(ctx.headingDegrees).toBe(90, 'fused heading = compass alpha 90');
  expect(ctx.isActive).toBeTrue('has readings → isActive true');
  expect(ctx.isLowPowerMode).toBeFalse('60% battery → not low power');
  expect(typeof ctx.motionState).toBe('string', 'motionState is a string');
});

describe('SensorFusionEngine — fuse() with no sensors → inactive context', () => {
  const engine = new SensorFusionEngine();
  const ctx = engine.fuse(null, null, null, null, BASE_PERMISSIONS, true);
  expect(ctx.isActive).toBeFalse('no readings → isActive false');
  expect(ctx.headingDegrees).toBe(null, 'no sensors → null heading');
  expect(ctx.isLowPowerMode).toBeFalse('null battery → not low power');
});

// ─── LocationPrivacyEngine — filter ──────────────────────────────────────────

describe('LocationPrivacyEngine — none level → null', () => {
  const engine = new LocationPrivacyEngine();
  const result = engine.filter(mkGPS(), 'none');
  expect(result).toBe(null, 'privacy level none → null');
});

describe('LocationPrivacyEngine — precise level → unchanged coords', () => {
  const engine = new LocationPrivacyEngine();
  const gps = mkGPS();
  const result = engine.filter(gps, 'precise');
  expect(result?.latitude).toBe(51.505, 'precise → original latitude');
  expect(result?.longitude).toBe(-0.09, 'precise → original longitude');
  expect(result?.privacyLevel).toBe('precise', 'precise → privacyLevel precise');
});

describe('LocationPrivacyEngine — fuzzy level → grid-snapped coords', () => {
  const engine = new LocationPrivacyEngine();
  const gps = mkGPS();
  const result = engine.filter(gps, 'fuzzy');
  expect(result !== null).toBeTrue('fuzzy → non-null result');
  expect(result?.privacyLevel).toBe('fuzzy', 'fuzzy → privacyLevel fuzzy');
  // Fuzzy snaps to 0.01° grid — latitude should round-trip back to itself
  const snapped = Math.round(result!.latitude / 0.01) * 0.01;
  const diff = Math.abs(snapped - result!.latitude);
  expect(diff < 0.0001).toBeTrue('fuzzy lat snapped to 0.01° grid');
  expect(result!.accuracy).toBeGreaterThan(gps.accuracy, 'fuzzy accuracy inflated');
});

// ─── LocationPrivacyEngine — mayStore ────────────────────────────────────────

describe('LocationPrivacyEngine — mayStore', () => {
  const engine = new LocationPrivacyEngine();
  expect(engine.mayStore('fuzzy', true)).toBeTrue('fuzzy + memory enabled → may store');
  expect(engine.mayStore('precise', true)).toBeTrue('precise + memory enabled → may store');
  expect(engine.mayStore('none', true)).toBeFalse('none level → cannot store');
  expect(engine.mayStore('fuzzy', false)).toBeFalse('memory disabled → cannot store');
  expect(engine.mayStore('precise', false)).toBeFalse('precise but memory off → cannot store');
});

// ─── LocationPrivacyEngine — distance ────────────────────────────────────────

describe('LocationPrivacyEngine — distanceMetres', () => {
  const engine = new LocationPrivacyEngine();
  // London to Paris is ~340 km
  const dist = engine.distanceMetres(51.505, -0.09, 48.856, 2.352);
  expect(dist).toBeGreaterThan(300_000, 'London-Paris > 300 km');
  expect(dist).toBeLessThan(400_000, 'London-Paris < 400 km');
  // Same point → 0 distance
  expect(engine.distanceMetres(51.0, -0.1, 51.0, -0.1)).toBe(0, 'same point → 0m');
});

// ─── LocationPrivacyEngine — locationNote ────────────────────────────────────

describe('LocationPrivacyEngine — locationNote', () => {
  const engine = new LocationPrivacyEngine();
  expect(engine.locationNote(null)).toBe('Location not available.', 'null → not available string');
  const note = engine.locationNote({ latitude: 51.51, longitude: -0.09, accuracy: 500, privacyLevel: 'fuzzy' });
  expect(note).toContain('51.51', 'note contains latitude');
  expect(note).toContain('N', 'positive latitude → N');
});

// ─── LocationPrivacyEngine — describe ────────────────────────────────────────

describe('LocationPrivacyEngine — describe', () => {
  const engine = new LocationPrivacyEngine();
  expect(engine.describe('none')).toContain('disabled', 'none → mentions disabled');
  expect(engine.describe('fuzzy')).toContain('1 km', 'fuzzy → mentions 1 km');
  expect(engine.describe('precise')).toContain('Precise', 'precise → mentions Precise');
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
