// V16 Denarixx Vision Glasses Hardware Prototype — test suite
// Run: npx tsx tests/denarixxGlassesPrototype.test.ts

import {
  createDefaultGlassesProfile,
  createDenarixxGlassesState,
  connectGlasses,
  disconnectGlasses,
  setConnectionDegraded,
  getDisconnectMessage,
  getEmergencyMessage,
  getConnectionHealthScore,
  getHealthLabel,
  formatHealthScore,
  updateCameraStatus,
  updateAudioStatus,
  updateHapticStatus,
  simulateGlassesTick,
  isGlassesActive,
  requiresPhoneFallback,
  getActiveConnectionProtocol,
} from '../src/engines/denarixxGlassesEngine';

import {
  classifyHardwareMode,
  getHardwareModeLabel,
  getModeDescription,
  getModeGuidance,
  buildEmergencyFallback,
  shouldEnterDegradedMode,
  shouldEnterOfflineSafety,
  assessSubsystemHealth,
  formatComponentStatus,
  getPrototypeSpec,
  buildHardwareBridgeStatus,
} from '../src/engines/hardwarePrototypeEngine';

import {
  createPowerProfile,
  isBatteryCritical,
  isBatteryLow,
  getBatteryWarningMessage,
  getBatteryLabel,
  classifyThermalState,
  shouldThrottleForThermal,
  getThermalLabel,
  getThermalGuidance,
  estimateRemainingMinutes,
  batteryPctToVoltage,
  getRecommendedModeForPower,
  simulateBatteryTick,
  formatPowerSummary,
  formatVoltage,
} from '../src/engines/powerManagementEngine';

import {
  createBoneAudioConfig,
  assessAudioHealth,
  isAudioOperational,
  shouldUsHapticFallback,
  getAudioFallbackMessage,
  selectAudioOutput,
  getRecommendedVolumeDb,
  isVolumeInRange,
  describeAudioConfig,
  isFrequencySupported,
  getOptimalSpeechRate,
  buildAudioStatusSummary,
  describeSensorAudioStatus,
} from '../src/engines/audioWearableEngine';

import {
  createHapticConfig,
  buildHapticPattern,
  getHapticPatternLibrary,
  assessHapticHealth,
  isHapticOperational,
  getHapticFallbackGuidance,
  shouldUsHapticForPriority,
  calculatePatternDurationMs,
  isPatternWithinBudget,
  clampIntensity,
  scaleIntensityForBattery,
  formatHapticStatus,
  describePattern,
  routeAlert,
} from '../src/engines/hapticWearableEngine';

import {
  GLASSES_DISCONNECT_MESSAGE,
  BATTERY_CRITICAL_MESSAGE,
  CAMERA_FAIL_MESSAGE,
  BATTERY_CRITICAL_THRESHOLD,
  BATTERY_LOW_THRESHOLD,
} from '../src/types/denarixxGlasses';

// ─── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`); failed++; }
}
function describe(name: string, fn: () => void) { console.log(`\n${name}`); fn(); }
function expect(actual: unknown) {
  const fail = (msg: string) => { throw new Error(msg); };
  return {
    toBe: (e: unknown) => { if (actual !== e) fail(`Expected ${JSON.stringify(e)}, got ${JSON.stringify(actual)}`); },
    toBeTruthy: () => { if (!actual) fail(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) fail(`Expected falsy, got ${JSON.stringify(actual)}`); },
    toBeNull: () => { if (actual !== null) fail(`Expected null, got ${JSON.stringify(actual)}`); },
    not: {
      toBe: (e: unknown) => { if (actual === e) fail(`Expected NOT ${JSON.stringify(e)}`); },
      toBeNull: () => { if (actual === null) fail('Expected not null'); },
      toContain: (s: string) => { if ((actual as string).includes(s)) fail(`Expected NOT to contain "${s}"`); },
    },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) fail(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) fail(`Expected >= ${n}, got ${actual}`); },
    toBeLessThan: (n: number) => { if ((actual as number) >= n) fail(`Expected < ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) fail(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
  };
}

// ─── DENARIXX GLASSES ENGINE ──────────────────────────────────────────────────
describe('createDefaultGlassesProfile', () => {
  test('has product name', () => expect(createDefaultGlassesProfile().productName).toContain('Denarixx'));
  test('has 4 cameras', () => expect(createDefaultGlassesProfile().cameras).toHaveLength(4));
  test('front camera exists', () => {
    const cam = createDefaultGlassesProfile().cameras.find(c => c.position === 'front');
    expect(cam?.id).toBe('front');
  });
  test('downward camera has depth sensor', () => {
    const cam = createDefaultGlassesProfile().cameras.find(c => c.position === 'downward');
    expect(cam?.hasDepthSensor).toBe(true);
  });
  test('has bone audio', () => expect(createDefaultGlassesProfile().boneAudio.driverType).toBeTruthy());
  test('has haptic', () => expect(createDefaultGlassesProfile().haptic.motorCount).toBeGreaterThan(0));
  test('firmware is placeholder channel', () => expect(createDefaultGlassesProfile().firmwareChannel).toBe('dev'));
  test('serial is placeholder', () => expect(createDefaultGlassesProfile().serialPlaceholder).toContain('prototype'));
});

describe('createDenarixxGlassesState', () => {
  test('starts disconnected', () => expect(createDenarixxGlassesState().connection).toBe('disconnected'));
  test('starts in phone_only mode', () => expect(createDenarixxGlassesState().hardwareMode).toBe('phone_only'));
  test('no emergency fallback initially', () => expect(createDenarixxGlassesState().emergencyFallbackActive).toBe(false));
  test('phone companion connected', () => expect(createDenarixxGlassesState().phoneCompanion.connected).toBe(true));
  test('battery starts at 100%', () => expect(createDenarixxGlassesState().power.batteryPct).toBe(100));
});

describe('connectGlasses', () => {
  test('sets connection to connected', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    expect(state.connection).toBe('connected');
  });
  test('sets glasses_primary mode', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    expect(state.hardwareMode).toBe('glasses_primary');
  });
  test('camera status becomes ok', () => {
    expect(connectGlasses(createDenarixxGlassesState()).cameraStatus).toBe('ok');
  });
  test('audio status becomes ok', () => {
    expect(connectGlasses(createDenarixxGlassesState()).audioStatus).toBe('ok');
  });
  test('haptic status becomes ok', () => {
    expect(connectGlasses(createDenarixxGlassesState()).hapticStatus).toBe('ok');
  });
  test('clears emergency fallback', () => {
    expect(connectGlasses(createDenarixxGlassesState()).emergencyFallbackActive).toBe(false);
  });
});

describe('disconnectGlasses', () => {
  test('sets connection to disconnected', () => {
    const state = disconnectGlasses(connectGlasses(createDenarixxGlassesState()));
    expect(state.connection).toBe('disconnected');
  });
  test('sets phone_only mode', () => {
    const state = disconnectGlasses(connectGlasses(createDenarixxGlassesState()));
    expect(state.hardwareMode).toBe('phone_only');
  });
  test('activates emergency fallback', () => {
    const state = disconnectGlasses(connectGlasses(createDenarixxGlassesState()));
    expect(state.emergencyFallbackActive).toBe(true);
  });
  test('sets disconnect message', () => {
    const state = disconnectGlasses(connectGlasses(createDenarixxGlassesState()));
    expect(state.emergencyFallbackReason).toContain('stop');
  });
  test('sets camera offline', () => {
    expect(disconnectGlasses(createDenarixxGlassesState()).cameraStatus).toBe('offline');
  });
});

describe('setConnectionDegraded', () => {
  test('sets degraded connection', () => {
    const state = setConnectionDegraded(connectGlasses(createDenarixxGlassesState()), 'Signal lost');
    expect(state.connection).toBe('degraded');
  });
  test('sets degraded_safety mode', () => {
    const state = setConnectionDegraded(connectGlasses(createDenarixxGlassesState()), 'Signal lost');
    expect(state.hardwareMode).toBe('degraded_safety');
  });
  test('captures reason', () => {
    const state = setConnectionDegraded(connectGlasses(createDenarixxGlassesState()), 'Signal lost');
    expect(state.emergencyFallbackReason).toBe('Signal lost');
  });
});

describe('getDisconnectMessage', () => {
  test('matches constant', () => expect(getDisconnectMessage()).toBe(GLASSES_DISCONNECT_MESSAGE));
  test('contains stop', () => expect(getDisconnectMessage().toLowerCase()).toContain('stop'));
  test('contains check carefully', () => expect(getDisconnectMessage().toLowerCase()).toContain('check carefully'));
});

describe('getConnectionHealthScore', () => {
  test('disconnected → 0', () => {
    expect(getConnectionHealthScore(createDenarixxGlassesState())).toBe(0);
  });
  test('connected + all ok → high score', () => {
    const score = getConnectionHealthScore(connectGlasses(createDenarixxGlassesState()));
    expect(score).toBeGreaterThan(70);
  });
  test('failed camera reduces score', () => {
    const base = connectGlasses(createDenarixxGlassesState());
    const withFail = updateCameraStatus(base, 'failed');
    expect(getConnectionHealthScore(withFail)).toBeLessThan(getConnectionHealthScore(base));
  });
  test('score is clamped 0–100', () => {
    const score = getConnectionHealthScore(connectGlasses(createDenarixxGlassesState()));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getHealthLabel', () => {
  test('100 → excellent', () => expect(getHealthLabel(100)).toBe('excellent'));
  test('70 → good', () => expect(getHealthLabel(70)).toBe('good'));
  test('50 → degraded', () => expect(getHealthLabel(50)).toBe('degraded'));
  test('25 → poor', () => expect(getHealthLabel(25)).toBe('poor'));
  test('5 → critical', () => expect(getHealthLabel(5)).toBe('critical'));
});

describe('isGlassesActive / requiresPhoneFallback', () => {
  test('disconnected → not active', () => expect(isGlassesActive(createDenarixxGlassesState())).toBe(false));
  test('connected → active', () => expect(isGlassesActive(connectGlasses(createDenarixxGlassesState()))).toBe(true));
  test('disconnected → requires fallback', () => expect(requiresPhoneFallback(createDenarixxGlassesState())).toBe(true));
  test('connected → no fallback needed', () => expect(requiresPhoneFallback(connectGlasses(createDenarixxGlassesState()))).toBe(false));
});

describe('simulateGlassesTick', () => {
  test('no change when disconnected', () => {
    const state = createDenarixxGlassesState();
    const after = simulateGlassesTick(state, 5);
    expect(after.connection).toBe('disconnected');
  });
  test('RSSI drifts when connected', () => {
    const connected = connectGlasses(createDenarixxGlassesState());
    const ticked = simulateGlassesTick(connected, 10);
    expect(ticked.phoneCompanion.rssiDbm).not.toBeNull();
  });
});

// ─── HARDWARE PROTOTYPE ENGINE ────────────────────────────────────────────────
describe('classifyHardwareMode', () => {
  test('disconnected → phone_only', () => {
    expect(classifyHardwareMode(createDenarixxGlassesState())).toBe('phone_only');
  });
  test('connected + all ok → glasses_primary', () => {
    expect(classifyHardwareMode(connectGlasses(createDenarixxGlassesState()))).toBe('glasses_primary');
  });
  test('connected + camera failed → degraded_safety', () => {
    const state = updateCameraStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    expect(classifyHardwareMode(state)).toBe('degraded_safety');
  });
  test('connected + low battery → degraded_safety', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    const lowBattery = { ...state, power: { ...state.power, batteryPct: 5 } };
    expect(classifyHardwareMode(lowBattery)).toBe('degraded_safety');
  });
  test('degraded connection → degraded_safety', () => {
    const state = setConnectionDegraded(connectGlasses(createDenarixxGlassesState()), 'x');
    expect(classifyHardwareMode(state)).toBe('degraded_safety');
  });
});

describe('getHardwareModeLabel', () => {
  test('phone_only has label', () => expect(getHardwareModeLabel('phone_only')).toContain('Phone'));
  test('glasses_primary has label', () => expect(getHardwareModeLabel('glasses_primary')).toContain('Primary'));
  test('degraded_safety has warning', () => expect(getHardwareModeLabel('degraded_safety')).toContain('⚠'));
  test('offline_safety has label', () => expect(getHardwareModeLabel('offline_safety')).toContain('Offline'));
});

describe('getModeGuidance', () => {
  test('all modes have guidance', () => {
    const modes = ['phone_only', 'glasses_assisted', 'glasses_primary', 'degraded_safety', 'offline_safety'] as const;
    modes.forEach(m => expect(getModeGuidance(m).length).toBeGreaterThan(0));
  });
  test('degraded contains cautious', () => expect(getModeGuidance('degraded_safety').toLowerCase()).toContain('cautious'));
});

describe('buildEmergencyFallback', () => {
  test('disconnected → active with message', () => {
    const state = disconnectGlasses(connectGlasses(createDenarixxGlassesState()));
    const fb = buildEmergencyFallback(state);
    expect(fb.active).toBe(true);
    expect(fb.message).toContain('stop');
  });
  test('critical battery → active with battery message', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    const lowBat = { ...state, power: { ...state.power, batteryPct: 5 } };
    const fb = buildEmergencyFallback(lowBat);
    expect(fb.active).toBe(true);
    expect(fb.message).toContain('battery');
  });
  test('camera failed → active with camera message', () => {
    const state = updateCameraStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    const fb = buildEmergencyFallback(state);
    expect(fb.active).toBe(true);
    expect(fb.message).toContain('Camera');
  });
  test('normal state → not active', () => {
    const fb = buildEmergencyFallback(connectGlasses(createDenarixxGlassesState()));
    expect(fb.active).toBe(false);
  });
});

describe('shouldEnterDegradedMode', () => {
  test('critical battery → true', () => {
    const state = { ...createDenarixxGlassesState(), power: { ...createDenarixxGlassesState().power, batteryPct: 5 } };
    expect(shouldEnterDegradedMode(state)).toBe(true);
  });
  test('camera failed → true', () => {
    const state = updateCameraStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    expect(shouldEnterDegradedMode(state)).toBe(true);
  });
  test('all ok → false', () => {
    expect(shouldEnterDegradedMode(connectGlasses(createDenarixxGlassesState()))).toBe(false);
  });
});

describe('shouldEnterOfflineSafety', () => {
  test('cloud unavailable + disconnected → true', () => {
    expect(shouldEnterOfflineSafety(false, createDenarixxGlassesState())).toBe(true);
  });
  test('cloud unavailable + connected → false', () => {
    expect(shouldEnterOfflineSafety(false, connectGlasses(createDenarixxGlassesState()))).toBe(false);
  });
  test('cloud available → false', () => {
    expect(shouldEnterOfflineSafety(true, createDenarixxGlassesState())).toBe(false);
  });
});

describe('assessSubsystemHealth', () => {
  test('returns all subsystems', () => {
    const h = assessSubsystemHealth(connectGlasses(createDenarixxGlassesState()));
    expect(h.camera).toBeTruthy();
    expect(h.audio).toBeTruthy();
    expect(h.haptic).toBeTruthy();
    expect(h.connection).toBeTruthy();
    expect(h.power).toBeTruthy();
  });
  test('connected state → camera ok', () => {
    expect(assessSubsystemHealth(connectGlasses(createDenarixxGlassesState())).camera).toBe('ok');
  });
  test('disconnected → connection offline', () => {
    expect(assessSubsystemHealth(createDenarixxGlassesState()).connection).toBe('offline');
  });
});

describe('getPrototypeSpec', () => {
  test('has weight', () => expect(getPrototypeSpec().targetWeight).toContain('g'));
  test('has battery capacity', () => expect(getPrototypeSpec().targetBatteryCapacityMah).toBeGreaterThan(0));
  test('has compute chip', () => expect(getPrototypeSpec().computeChip.length).toBeGreaterThan(0));
  test('has price', () => expect(getPrototypeSpec().targetRetailPrice).toContain('€'));
  test('has prototype date', () => expect(getPrototypeSpec().prototypeTargetDate.length).toBeGreaterThan(0));
});

describe('buildHardwareBridgeStatus', () => {
  test('disconnected → phone_camera', () => {
    const status = buildHardwareBridgeStatus(createDenarixxGlassesState());
    expect(status.visionSource).toBe('phone_camera');
  });
  test('connected + camera ok → denarixx_glasses', () => {
    const status = buildHardwareBridgeStatus(connectGlasses(createDenarixxGlassesState()));
    expect(status.visionSource).toBe('denarixx_glasses');
  });
  test('connected + audio ok → bone_conduction', () => {
    const status = buildHardwareBridgeStatus(connectGlasses(createDenarixxGlassesState()));
    expect(status.audioOutput).toBe('bone_conduction');
  });
  test('disconnected → phone_speaker', () => {
    const status = buildHardwareBridgeStatus(createDenarixxGlassesState());
    expect(status.audioOutput).toBe('phone_speaker');
  });
});

// ─── POWER MANAGEMENT ENGINE ──────────────────────────────────────────────────
describe('createPowerProfile', () => {
  test('clamps battery 0–100', () => expect(createPowerProfile(150, false).batteryPct).toBe(100));
  test('negative clamped to 0', () => expect(createPowerProfile(-5, false).batteryPct).toBe(0));
  test('charging current is negative', () => expect(createPowerProfile(50, true).currentMa).toBeLessThan(0));
  test('discharging current is positive', () => expect(createPowerProfile(50, false).currentMa).toBeGreaterThan(0));
  test('has positive remaining minutes', () => expect(createPowerProfile(80, false).estimatedRemainingMinutes).toBeGreaterThan(0));
});

describe('isBatteryCritical / isBatteryLow', () => {
  test(`${BATTERY_CRITICAL_THRESHOLD}% → critical`, () => expect(isBatteryCritical(BATTERY_CRITICAL_THRESHOLD)).toBe(true));
  test('above threshold → not critical', () => expect(isBatteryCritical(BATTERY_CRITICAL_THRESHOLD + 1)).toBe(false));
  test(`${BATTERY_LOW_THRESHOLD}% → low`, () => expect(isBatteryLow(BATTERY_LOW_THRESHOLD)).toBe(true));
  test('above low threshold → not low', () => expect(isBatteryLow(BATTERY_LOW_THRESHOLD + 1)).toBe(false));
});

describe('getBatteryWarningMessage', () => {
  test('critical → BATTERY_CRITICAL_MESSAGE', () => {
    expect(getBatteryWarningMessage(5)).toBe(BATTERY_CRITICAL_MESSAGE);
  });
  test('low → non-null warning', () => {
    expect(getBatteryWarningMessage(15)).not.toBeNull();
  });
  test('normal → null', () => {
    expect(getBatteryWarningMessage(80)).toBeNull();
  });
  test('critical message mentions phone mode', () => {
    expect(BATTERY_CRITICAL_MESSAGE.toLowerCase()).toContain('phone mode');
  });
  test('critical message mentions battery', () => {
    expect(BATTERY_CRITICAL_MESSAGE.toLowerCase()).toContain('battery');
  });
});

describe('classifyThermalState', () => {
  test('30°C → normal', () => expect(classifyThermalState(30)).toBe('normal'));
  test('39°C → warm', () => expect(classifyThermalState(39)).toBe('warm'));
  test('43°C → hot', () => expect(classifyThermalState(43)).toBe('hot'));
  test('48°C → throttling', () => expect(classifyThermalState(48)).toBe('throttling'));
});

describe('shouldThrottleForThermal', () => {
  test('normal → false', () => expect(shouldThrottleForThermal('normal')).toBe(false));
  test('warm → false', () => expect(shouldThrottleForThermal('warm')).toBe(false));
  test('hot → true', () => expect(shouldThrottleForThermal('hot')).toBe(true));
  test('throttling → true', () => expect(shouldThrottleForThermal('throttling')).toBe(true));
});

describe('getThermalGuidance', () => {
  test('normal → null', () => expect(getThermalGuidance('normal')).toBeNull());
  test('warm → null', () => expect(getThermalGuidance('warm')).toBeNull());
  test('hot → guidance', () => expect(getThermalGuidance('hot')).not.toBeNull());
  test('throttling → guidance', () => expect(getThermalGuidance('throttling')).not.toBeNull());
});

describe('estimateRemainingMinutes', () => {
  test('positive for 80% glasses_primary', () => expect(estimateRemainingMinutes(80, 'glasses_primary')).toBeGreaterThan(0));
  test('phone_only uses less power', () => {
    expect(estimateRemainingMinutes(80, 'phone_only')).toBeGreaterThan(estimateRemainingMinutes(80, 'glasses_primary'));
  });
  test('0% → 0 minutes', () => expect(estimateRemainingMinutes(0, 'glasses_primary')).toBe(0));
});

describe('batteryPctToVoltage', () => {
  test('100% → high voltage', () => expect(batteryPctToVoltage(100)).toBeGreaterThan(4.0));
  test('0% → low voltage', () => expect(batteryPctToVoltage(0)).toBeLessThan(3.5));
  test('50% → mid voltage', () => {
    const v = batteryPctToVoltage(50);
    expect(v).toBeGreaterThan(3.0);
    expect(v).toBeLessThan(4.2);
  });
});

describe('getRecommendedModeForPower', () => {
  test('charging → performance', () => {
    const p = createPowerProfile(50, true);
    expect(getRecommendedModeForPower(p)).toBe('performance');
  });
  test('full battery → performance', () => {
    const p = createPowerProfile(80, false);
    expect(getRecommendedModeForPower(p)).toBe('performance');
  });
  test('40% → balanced', () => {
    const p = createPowerProfile(40, false);
    expect(getRecommendedModeForPower(p)).toBe('balanced');
  });
  test('critical → critical mode', () => {
    const p = createPowerProfile(5, false);
    expect(getRecommendedModeForPower(p)).toBe('critical');
  });
});

describe('simulateBatteryTick', () => {
  test('drains battery when not charging', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    const drained = simulateBatteryTick(state, 0.5);
    expect(drained.power.batteryPct).toBeLessThan(state.power.batteryPct);
  });
  test('no drain when charging', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    const charging = { ...state, power: { ...state.power, isCharging: true } };
    const after = simulateBatteryTick(charging, 0.5);
    expect(after.power.batteryPct).toBe(charging.power.batteryPct);
  });
  test('battery does not go below 0', () => {
    const state = { ...createDenarixxGlassesState(), power: { ...createDenarixxGlassesState().power, batteryPct: 0 } };
    const after = simulateBatteryTick(state, 1);
    expect(after.power.batteryPct).toBeGreaterThanOrEqual(0);
  });
});

// ─── AUDIO WEARABLE ENGINE ────────────────────────────────────────────────────
describe('createBoneAudioConfig', () => {
  test('piezoelectric driver', () => expect(createBoneAudioConfig().driverType).toBe('piezoelectric'));
  test('volume control available', () => expect(createBoneAudioConfig().hasVolumeControl).toBe(true));
  test('max volume > 0', () => expect(createBoneAudioConfig().maxVolumeDb).toBeGreaterThan(0));
  test('frequency range set', () => {
    const [min, max] = createBoneAudioConfig().frequencyRangeHz;
    expect(max).toBeGreaterThan(min);
  });
});

describe('assessAudioHealth', () => {
  test('disconnected → offline', () => expect(assessAudioHealth(createDenarixxGlassesState())).toBe('offline'));
  test('connected + ok → ok', () => expect(assessAudioHealth(connectGlasses(createDenarixxGlassesState()))).toBe('ok'));
  test('connected + failed → failed', () => {
    const state = updateAudioStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    expect(assessAudioHealth(state)).toBe('failed');
  });
});

describe('isAudioOperational', () => {
  test('offline → false', () => expect(isAudioOperational(createDenarixxGlassesState())).toBe(false));
  test('connected ok → true', () => expect(isAudioOperational(connectGlasses(createDenarixxGlassesState()))).toBe(true));
});

describe('shouldUsHapticFallback', () => {
  test('failed → true', () => expect(shouldUsHapticFallback('failed')).toBe(true));
  test('offline → true', () => expect(shouldUsHapticFallback('offline')).toBe(true));
  test('ok → false', () => expect(shouldUsHapticFallback('ok')).toBe(false));
  test('degraded → false', () => expect(shouldUsHapticFallback('degraded')).toBe(false));
});

describe('selectAudioOutput', () => {
  test('audio ok → bone_conduction', () => {
    const state = connectGlasses(createDenarixxGlassesState());
    expect(selectAudioOutput(state, 'critical')).toBe('bone_conduction');
  });
  test('audio failed + critical → phone_speaker', () => {
    const state = updateAudioStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    expect(selectAudioOutput(state, 'critical')).toBe('phone_speaker');
  });
  test('audio failed + haptic ok + low priority → haptic_only', () => {
    const state = updateAudioStatus(connectGlasses(createDenarixxGlassesState()), 'failed');
    expect(selectAudioOutput(state, 'low')).toBe('haptic_only');
  });
});

describe('getRecommendedVolumeDb', () => {
  test('critical → max volume', () => {
    expect(getRecommendedVolumeDb('critical')).toBeGreaterThan(getRecommendedVolumeDb('low'));
  });
  test('all priorities have valid volume', () => {
    ['critical', 'high', 'medium', 'low'].forEach(p => {
      expect(getRecommendedVolumeDb(p as 'critical' | 'high' | 'medium' | 'low')).toBeGreaterThan(0);
    });
  });
});

describe('isFrequencySupported', () => {
  test('1000Hz → supported', () => expect(isFrequencySupported(createBoneAudioConfig(), 1000)).toBe(true));
  test('50Hz → not supported', () => expect(isFrequencySupported(createBoneAudioConfig(), 50)).toBe(false));
  test('20000Hz → not supported', () => expect(isFrequencySupported(createBoneAudioConfig(), 20000)).toBe(false));
});

describe('CAMERA_FAIL_MESSAGE', () => {
  test('contains camera', () => expect(CAMERA_FAIL_MESSAGE.toLowerCase()).toContain('camera'));
  test('contains limited', () => expect(CAMERA_FAIL_MESSAGE.toLowerCase()).toContain('limited'));
  test('non-empty', () => expect(CAMERA_FAIL_MESSAGE.length).toBeGreaterThan(0));
});

// ─── HAPTIC WEARABLE ENGINE ───────────────────────────────────────────────────
describe('createHapticConfig', () => {
  test('has motors', () => expect(createHapticConfig().motorCount).toBeGreaterThan(0));
  test('supports intensity control', () => expect(createHapticConfig().supportsIntensityControl).toBe(true));
  test('max pattern duration > 0', () => expect(createHapticConfig().maxPatternDurationMs).toBeGreaterThan(0));
});

describe('buildHapticPattern', () => {
  test('critical_hazard has high intensity', () => expect(buildHapticPattern('critical_hazard').intensity).toBe(100));
  test('notification has low intensity', () => {
    expect(buildHapticPattern('notification').intensity).toBeLessThan(buildHapticPattern('critical_hazard').intensity);
  });
  test('all alert types return a pattern', () => {
    const types: Array<'critical_hazard' | 'high_hazard' | 'medium_hazard' | 'navigation_turn' | 'crossing_warning' | 'battery_low' | 'disconnected' | 'notification'> = [
      'critical_hazard', 'high_hazard', 'medium_hazard', 'navigation_turn',
      'crossing_warning', 'battery_low', 'disconnected', 'notification'
    ];
    types.forEach(t => expect(buildHapticPattern(t).alertType).toBe(t));
  });
  test('critical_hazard has repeat count ≥ 2', () => {
    expect(buildHapticPattern('critical_hazard').repeatCount).toBeGreaterThanOrEqual(2);
  });
});

describe('getHapticPatternLibrary', () => {
  test('has 8 patterns', () => expect(getHapticPatternLibrary()).toHaveLength(8));
  test('all have descriptions', () => {
    getHapticPatternLibrary().forEach(p => expect(p.description.length).toBeGreaterThan(0));
  });
});

describe('assessHapticHealth', () => {
  test('disconnected → offline', () => expect(assessHapticHealth(createDenarixxGlassesState())).toBe('offline'));
  test('connected → ok', () => expect(assessHapticHealth(connectGlasses(createDenarixxGlassesState()))).toBe('ok'));
});

describe('isHapticOperational', () => {
  test('disconnected → false', () => expect(isHapticOperational(createDenarixxGlassesState())).toBe(false));
  test('connected ok → true', () => expect(isHapticOperational(connectGlasses(createDenarixxGlassesState()))).toBe(true));
});

describe('shouldUsHapticForPriority', () => {
  test('critical_hazard always uses haptic', () => expect(shouldUsHapticForPriority('critical_hazard', true)).toBe(true));
  test('crossing_warning uses haptic', () => expect(shouldUsHapticForPriority('crossing_warning', true)).toBe(true));
  test('notification without audio → haptic', () => expect(shouldUsHapticForPriority('notification', false)).toBe(true));
  test('notification with audio → no extra haptic', () => expect(shouldUsHapticForPriority('notification', true)).toBe(false));
});

describe('calculatePatternDurationMs', () => {
  test('positive duration for critical_hazard', () => {
    expect(calculatePatternDurationMs(buildHapticPattern('critical_hazard'))).toBeGreaterThan(0);
  });
  test('critical longer than notification', () => {
    const critical = calculatePatternDurationMs(buildHapticPattern('critical_hazard'));
    const notification = calculatePatternDurationMs(buildHapticPattern('notification'));
    expect(critical).toBeGreaterThan(notification);
  });
});

describe('isPatternWithinBudget', () => {
  test('notification is within budget', () => {
    const config = createHapticConfig();
    expect(isPatternWithinBudget(buildHapticPattern('notification'), config)).toBe(true);
  });
});

describe('clampIntensity / scaleIntensityForBattery', () => {
  test('clamp above 100 → 100', () => expect(clampIntensity(150)).toBe(100));
  test('clamp below 0 → 0', () => expect(clampIntensity(-10)).toBe(0));
  test('normal battery → full intensity', () => expect(scaleIntensityForBattery(100, 80)).toBe(100));
  test('critical battery → half intensity', () => expect(scaleIntensityForBattery(100, 5)).toBe(50));
  test('low battery → 75% intensity', () => expect(scaleIntensityForBattery(100, 15)).toBe(75));
});

describe('routeAlert', () => {
  test('both available + critical → audio + haptic', () => {
    const result = routeAlert('critical_hazard', true, true);
    expect(result.useAudio).toBe(true);
    expect(result.useHaptic).toBe(true);
  });
  test('audio unavailable → haptic', () => {
    const result = routeAlert('critical_hazard', false, true);
    expect(result.useAudio).toBe(false);
    expect(result.useHaptic).toBe(true);
  });
  test('both unavailable → explanation set', () => {
    const result = routeAlert('notification', false, false);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
  test('notification + both available → audio only', () => {
    const result = routeAlert('notification', true, true);
    expect(result.useAudio).toBe(true);
    expect(result.useHaptic).toBe(false);
  });
});

// ─── SAFETY CONSTANTS ─────────────────────────────────────────────────────────
describe('Safety message constants', () => {
  test('GLASSES_DISCONNECT_MESSAGE contains stop', () => {
    expect(GLASSES_DISCONNECT_MESSAGE.toLowerCase()).toContain('stop');
  });
  test('GLASSES_DISCONNECT_MESSAGE contains check carefully', () => {
    expect(GLASSES_DISCONNECT_MESSAGE.toLowerCase()).toContain('check carefully');
  });
  test('BATTERY_CRITICAL_MESSAGE contains phone mode', () => {
    expect(BATTERY_CRITICAL_MESSAGE.toLowerCase()).toContain('phone mode');
  });
  test('BATTERY_CRITICAL_MESSAGE contains battery', () => {
    expect(BATTERY_CRITICAL_MESSAGE.toLowerCase()).toContain('battery');
  });
  test('CAMERA_FAIL_MESSAGE contains camera', () => {
    expect(CAMERA_FAIL_MESSAGE.toLowerCase()).toContain('camera');
  });
  test('CAMERA_FAIL_MESSAGE contains limited', () => {
    expect(CAMERA_FAIL_MESSAGE.toLowerCase()).toContain('limited');
  });
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
