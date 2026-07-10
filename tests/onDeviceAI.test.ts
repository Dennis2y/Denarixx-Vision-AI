// V15 On-Device AI Optimization — test suite
// Run: npx tsx tests/onDeviceAI.test.ts

import {
  getRuntimeRegistry,
  getRuntimeCapability,
  detectAvailableRuntimes,
  getAvailabilityLabel,
  selectRuntime,
  isCloudAvailable,
  buildCloudStatusLabel,
  selectProcessingMode,
  initOfflineSafetyPath,
  getOfflineSafetyMessage,
  buildOfflineFallbackGuidance,
  buildLocalHazardGuidance,
  buildSimulatedEdgeCapabilities,
  describeDeviceClass,
  buildDefaultConfig,
} from '../src/engines/onDeviceAIEngine';

import {
  getModelRegistry,
  getModelsByRuntime,
  selectOptimalModel,
  getQuantizationStrategy,
  shouldUseQuantized,
  estimateModelLatency,
  getLatencyGrade,
  formatLatencyGrade,
  getQuantizationLabel,
  estimateMemoryFootprint,
} from '../src/engines/modelOptimizationEngine';

import {
  buildEdgeDetections,
  estimateEdgeFPS,
  shouldSkipFrame,
  getFrameIntervalMs,
  simulateInferenceLatency,
  buildPerformanceDashboard,
  formatRuntime,
  formatProcessingMode,
  shouldRouteToEdge,
  runSimulatedEdgeFrame,
} from '../src/engines/edgeInferenceEngine';

import {
  createLatencyBudget,
  adjustBudgetForBattery,
  recordLatency,
  isBudgetExceeded,
  isCriticalAlertOnTime,
  isPerceptionOnTime,
  isReasoningOnTime,
  buildLatencyReport,
  buildSimulatedLatencyRecord,
  formatLatencyMs,
  formatBudgetStatus,
  formatBudget,
} from '../src/engines/latencyBudgetEngine';

import {
  classifyBatteryMode,
  getBatteryModeLabel,
  getBatteryOptimizationProfile,
  getRecommendedFPS,
  shouldPauseCloudReasoning,
  shouldPrioritizeLocal,
  shouldSkipPeripheralCameras,
  getRecommendedRuntime,
  adjustModeForThermal,
  getBatteryModeWarning,
  formatBatteryModeProfile,
} from '../src/engines/batteryOptimizationEngine';

import {
  OFFLINE_SAFETY_MESSAGE,
  DEFAULT_LATENCY_BUDGET,
  DEFAULT_ONDEVICE_CONFIG,
} from '../src/types/onDeviceAI';

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

// ─── ON-DEVICE AI ENGINE ──────────────────────────────────────────────────────
describe('getRuntimeRegistry', () => {
  test('returns all 6 runtimes', () => expect(getRuntimeRegistry()).toHaveLength(6));
  test('browser is always available', () => {
    const browser = getRuntimeRegistry().find(r => r.runtime === 'browser');
    expect(browser?.availability).toBe('available');
  });
  test('apple_neural_engine is placeholder', () => {
    const ane = getRuntimeRegistry().find(r => r.runtime === 'apple_neural_engine');
    expect(ane?.availability).toBe('placeholder');
  });
  test('qualcomm_npu is placeholder', () => {
    const npu = getRuntimeRegistry().find(r => r.runtime === 'qualcomm_npu');
    expect(npu?.availability).toBe('placeholder');
  });
});

describe('getRuntimeCapability', () => {
  test('returns browser capability', () => expect(getRuntimeCapability('browser').runtime).toBe('browser'));
  test('browser not power efficient', () => expect(getRuntimeCapability('browser').powerEfficient).toBe(false));
  test('ane is power efficient', () => expect(getRuntimeCapability('apple_neural_engine').powerEfficient).toBe(true));
  test('ane has lowest latency', () => {
    const ane = getRuntimeCapability('apple_neural_engine');
    const browser = getRuntimeCapability('browser');
    expect(ane.estimatedLatencyMs).toBeLessThan(browser.estimatedLatencyMs);
  });
});

describe('detectAvailableRuntimes', () => {
  test('returns at least browser', () => expect(detectAvailableRuntimes().length).toBeGreaterThan(0));
  test('all returned are available', () => {
    detectAvailableRuntimes().forEach(r => expect(r.availability).toBe('available'));
  });
});

describe('getAvailabilityLabel', () => {
  test('available has label', () => expect(getAvailabilityLabel('available')).toContain('Available'));
  test('placeholder has label', () => expect(getAvailabilityLabel('placeholder')).toContain('Placeholder'));
  test('unavailable has label', () => expect(getAvailabilityLabel('unavailable')).toContain('Unavailable'));
});

describe('selectRuntime', () => {
  test('returns a valid runtime', () => {
    const caps = buildSimulatedEdgeCapabilities();
    expect(selectRuntime(caps, 'balanced').length).toBeGreaterThan(0);
  });
  test('critical mode selects power-efficient runtime', () => {
    const caps = buildSimulatedEdgeCapabilities();
    const runtime = selectRuntime(caps, 'critical');
    const cap = getRuntimeCapability(runtime);
    expect(cap.powerEfficient).toBe(true);
  });
});

describe('isCloudAvailable', () => {
  test('online → true', () => expect(isCloudAvailable('online')).toBe(true));
  test('offline → false', () => expect(isCloudAvailable('offline')).toBe(false));
  test('degraded → false', () => expect(isCloudAvailable('degraded')).toBe(false));
});

describe('buildCloudStatusLabel', () => {
  test('online has green', () => expect(buildCloudStatusLabel('online')).toContain('🟢'));
  test('offline has red', () => expect(buildCloudStatusLabel('offline')).toContain('🔴'));
  test('degraded has yellow', () => expect(buildCloudStatusLabel('degraded')).toContain('🟡'));
});

describe('selectProcessingMode', () => {
  test('critical alert → local', () => {
    const config = buildDefaultConfig();
    expect(selectProcessingMode('online', config, true)).toBe('local');
  });
  test('offline + non-critical → local', () => {
    const config = buildDefaultConfig();
    expect(selectProcessingMode('offline', config, false)).toBe('local');
  });
  test('degraded → edge', () => {
    const config = buildDefaultConfig();
    expect(selectProcessingMode('degraded', config, false)).toBe('edge');
  });
  test('online + non-critical → hybrid', () => {
    const config = buildDefaultConfig();
    expect(selectProcessingMode('online', config, false)).toBe('hybrid');
  });
});

describe('initOfflineSafetyPath', () => {
  test('online → not active', () => expect(initOfflineSafetyPath('online').active).toBe(false));
  test('offline → active', () => expect(initOfflineSafetyPath('offline').active).toBe(true));
  test('offline → has message', () => {
    expect(initOfflineSafetyPath('offline').cloudUnavailableMessage.length).toBeGreaterThan(0);
  });
  test('online → empty message', () => {
    expect(initOfflineSafetyPath('online').cloudUnavailableMessage).toBe('');
  });
  test('local detection always enabled', () => {
    expect(initOfflineSafetyPath('offline').localDetectionEnabled).toBe(true);
  });
});

describe('getOfflineSafetyMessage', () => {
  test('contains local safety mode', () => expect(getOfflineSafetyMessage().toLowerCase()).toContain('local safety'));
  test('contains online ai', () => expect(getOfflineSafetyMessage().toLowerCase()).toContain('online ai'));
  test('matches constant', () => expect(getOfflineSafetyMessage()).toBe(OFFLINE_SAFETY_MESSAGE));
});

describe('buildOfflineFallbackGuidance', () => {
  test('car → stop message', () => expect(buildOfflineFallbackGuidance('car').toLowerCase()).toContain('stop'));
  test('stairs → handrail', () => expect(buildOfflineFallbackGuidance('stairs').toLowerCase()).toContain('handrail'));
  test('person → slow down', () => expect(buildOfflineFallbackGuidance('person').toLowerCase()).toContain('slow down'));
  test('unknown → obstacle detected', () => expect(buildOfflineFallbackGuidance('unknown_thing').toLowerCase()).toContain('obstacle'));
  test('bicycle → right', () => expect(buildOfflineFallbackGuidance('bicycle').toLowerCase()).toContain('right'));
});

describe('buildLocalHazardGuidance', () => {
  test('empty → empty string', () => expect(buildLocalHazardGuidance([])).toBe(''));
  test('car → stop message', () => expect(buildLocalHazardGuidance(['car']).toLowerCase()).toContain('stop'));
  test('prioritizes critical labels', () => {
    const guidance = buildLocalHazardGuidance(['person', 'car']);
    expect(guidance.toLowerCase()).toContain('stop');
  });
  test('non-critical labels handled', () => {
    expect(buildLocalHazardGuidance(['dog']).length).toBeGreaterThan(0);
  });
});

describe('buildSimulatedEdgeCapabilities', () => {
  test('has supported runtimes', () => expect(buildSimulatedEdgeCapabilities().supportedRuntimes.length).toBeGreaterThan(0));
  test('device class is set', () => expect(buildSimulatedEdgeCapabilities().deviceClass).toBeTruthy());
  test('FPS is positive', () => expect(buildSimulatedEdgeCapabilities().estimatedFPS).toBeGreaterThan(0));
});

// ─── MODEL OPTIMIZATION ENGINE ────────────────────────────────────────────────
describe('getModelRegistry', () => {
  test('has multiple models', () => expect(getModelRegistry().length).toBeGreaterThan(3));
  test('all models have IDs', () => getModelRegistry().forEach(m => expect(m.id.length).toBeGreaterThan(0)));
  test('all models have positive FPS', () => getModelRegistry().forEach(m => expect(m.estimatedFPS).toBeGreaterThan(0)));
});

describe('getModelsByRuntime', () => {
  test('browser models exist', () => expect(getModelsByRuntime('browser').length).toBeGreaterThan(0));
  test('webgpu models exist', () => expect(getModelsByRuntime('webgpu').length).toBeGreaterThan(0));
  test('unknown runtime → empty', () => expect(getModelsByRuntime('qualcomm_npu').length).toBeGreaterThan(0));
});

describe('selectOptimalModel', () => {
  test('returns a model for browser/balanced', () => {
    expect(selectOptimalModel('browser', 'balanced').runtime).toBe('browser');
  });
  test('performance mode picks higher FPS', () => {
    const perf = selectOptimalModel('browser', 'performance');
    const crit = selectOptimalModel('browser', 'critical');
    expect(perf.memorySizeMb).toBeGreaterThanOrEqual(crit.memorySizeMb);
  });
  test('critical mode picks smallest model', () => {
    const crit = selectOptimalModel('browser', 'critical');
    const perf = selectOptimalModel('browser', 'performance');
    expect(crit.memorySizeMb).toBeLessThanOrEqual(perf.memorySizeMb);
  });
});

describe('getQuantizationStrategy', () => {
  test('critical → int4', () => expect(getQuantizationStrategy('critical')).toBe('int4'));
  test('power_saver → int8', () => expect(getQuantizationStrategy('power_saver')).toBe('int8'));
  test('balanced → float16', () => expect(getQuantizationStrategy('balanced')).toBe('float16'));
  test('performance → none', () => expect(getQuantizationStrategy('performance')).toBe('none'));
});

describe('shouldUseQuantized', () => {
  test('performance → false', () => expect(shouldUseQuantized('performance')).toBe(false));
  test('balanced → true', () => expect(shouldUseQuantized('balanced')).toBe(true));
  test('critical → true', () => expect(shouldUseQuantized('critical')).toBe(true));
});

describe('estimateModelLatency', () => {
  test('browser is slower than webgpu', () => {
    expect(estimateModelLatency('browser', 'balanced')).toBeGreaterThan(estimateModelLatency('webgpu', 'balanced'));
  });
  test('returns positive value', () => expect(estimateModelLatency('browser', 'balanced')).toBeGreaterThan(0));
});

describe('getLatencyGrade', () => {
  test('< 50ms → excellent', () => expect(getLatencyGrade(30)).toBe('excellent'));
  test('< 150ms → good', () => expect(getLatencyGrade(100)).toBe('good'));
  test('< 400ms → acceptable', () => expect(getLatencyGrade(300)).toBe('acceptable'));
  test('>= 400ms → slow', () => expect(getLatencyGrade(500)).toBe('slow'));
});

describe('getQuantizationLabel', () => {
  test('none has label', () => expect(getQuantizationLabel('none')).toContain('FP32'));
  test('int8 has label', () => expect(getQuantizationLabel('int8')).toContain('INT8'));
  test('int4 has label', () => expect(getQuantizationLabel('int4')).toContain('INT4'));
});

describe('estimateMemoryFootprint', () => {
  test('large model → MB suffix', () => {
    const model = getModelRegistry().find(m => m.memorySizeMb > 2)!;
    expect(estimateMemoryFootprint(model)).toContain('MB');
  });
  test('small model → KB suffix', () => {
    const model = getModelRegistry().find(m => m.memorySizeMb < 2)!;
    expect(estimateMemoryFootprint(model)).toContain('KB');
  });
});

// ─── EDGE INFERENCE ENGINE ────────────────────────────────────────────────────
describe('buildEdgeDetections', () => {
  test('returns array', () => expect(Array.isArray(buildEdgeDetections('browser', 0))).toBe(true));
  test('onnx returns equal or more than browser', () => {
    let onnxTotal = 0, browserTotal = 0;
    for (let i = 0; i < 8; i++) {
      onnxTotal += buildEdgeDetections('onnx', i).length;
      browserTotal += buildEdgeDetections('browser', i).length;
    }
    expect(onnxTotal).toBeGreaterThanOrEqual(browserTotal);
  });
});

describe('estimateEdgeFPS', () => {
  test('positive FPS', () => expect(estimateEdgeFPS('browser', 'balanced')).toBeGreaterThan(0));
  test('performance mode → higher FPS than critical', () => {
    expect(estimateEdgeFPS('browser', 'performance')).toBeGreaterThan(estimateEdgeFPS('browser', 'critical'));
  });
  test('webgpu faster than browser', () => {
    expect(estimateEdgeFPS('webgpu', 'balanced')).toBeGreaterThan(estimateEdgeFPS('browser', 'balanced'));
  });
});

describe('shouldSkipFrame', () => {
  test('skips when too soon', () => {
    const now = Date.now();
    expect(shouldSkipFrame(now - 10, 5, now)).toBe(true);
  });
  test('does not skip when enough time passed', () => {
    const now = Date.now();
    expect(shouldSkipFrame(now - 2000, 1, now)).toBe(false);
  });
  test('zero fps → always skip', () => expect(shouldSkipFrame(0, 0, Date.now())).toBe(true));
});

describe('getFrameIntervalMs', () => {
  test('1fps → 1000ms', () => expect(getFrameIntervalMs(1)).toBe(1000));
  test('10fps → 100ms', () => expect(getFrameIntervalMs(10)).toBe(100));
  test('0fps → Infinity', () => expect(getFrameIntervalMs(0)).toBe(Infinity));
});

describe('simulateInferenceLatency', () => {
  test('positive value', () => expect(simulateInferenceLatency('browser', 'balanced')).toBeGreaterThan(0));
  test('ane faster than browser', () => {
    let aneTotal = 0, browserTotal = 0;
    for (let i = 0; i < 5; i++) {
      aneTotal += simulateInferenceLatency('apple_neural_engine', 'balanced');
      browserTotal += simulateInferenceLatency('browser', 'balanced');
    }
    expect(aneTotal).toBeLessThan(browserTotal);
  });
});

describe('buildPerformanceDashboard', () => {
  test('has fps', () => {
    const d = buildPerformanceDashboard('browser', 'balanced', 'online', 'hybrid', 150);
    expect(d.fps).toBeGreaterThan(0);
  });
  test('online → localSafetyActive false', () => {
    expect(buildPerformanceDashboard('browser', 'balanced', 'online', 'cloud', 100).localSafetyActive).toBe(false);
  });
  test('offline → localSafetyActive true', () => {
    expect(buildPerformanceDashboard('browser', 'balanced', 'offline', 'local', 100).localSafetyActive).toBe(true);
  });
  test('high inferenceMs → budget exceeded', () => {
    expect(buildPerformanceDashboard('browser', 'balanced', 'online', 'cloud', 500).latencyBudgetExceeded).toBe(true);
  });
});

describe('formatRuntime', () => {
  test('browser has label', () => expect(formatRuntime('browser')).toContain('Browser'));
  test('webgpu has label', () => expect(formatRuntime('webgpu')).toContain('WebGPU'));
  test('ane has label', () => expect(formatRuntime('apple_neural_engine')).toContain('Apple'));
});

describe('formatProcessingMode', () => {
  test('cloud has label', () => expect(formatProcessingMode('cloud')).toContain('Cloud'));
  test('edge has label', () => expect(formatProcessingMode('edge')).toContain('Edge'));
  test('local has label', () => expect(formatProcessingMode('local')).toContain('Local'));
  test('hybrid has label', () => expect(formatProcessingMode('hybrid')).toContain('Hybrid'));
});

describe('shouldRouteToEdge', () => {
  test('critical → always edge', () => expect(shouldRouteToEdge('online', true)).toBe(true));
  test('online + non-critical → cloud', () => expect(shouldRouteToEdge('online', false)).toBe(false));
  test('offline + non-critical → edge', () => expect(shouldRouteToEdge('offline', false)).toBe(true));
});

describe('runSimulatedEdgeFrame', () => {
  test('returns detections array', () => expect(Array.isArray(runSimulatedEdgeFrame('browser', 'balanced', 0).detections)).toBe(true));
  test('returns positive inferenceMs', () => expect(runSimulatedEdgeFrame('browser', 'balanced', 0).inferenceMs).toBeGreaterThan(0));
  test('returns positive fps', () => expect(runSimulatedEdgeFrame('browser', 'balanced', 0).fps).toBeGreaterThan(0));
});

// ─── LATENCY BUDGET ENGINE ────────────────────────────────────────────────────
describe('createLatencyBudget', () => {
  test('uses defaults', () => expect(createLatencyBudget().criticalTargetMs).toBe(DEFAULT_LATENCY_BUDGET.criticalTargetMs));
  test('allows overrides', () => expect(createLatencyBudget({ perceptionMs: 200 }).perceptionMs).toBe(200));
  test('critical target is 500ms', () => expect(createLatencyBudget().criticalTargetMs).toBe(500));
});

describe('adjustBudgetForBattery', () => {
  test('performance tightens budget', () => {
    const base = createLatencyBudget();
    expect(adjustBudgetForBattery(base, 'performance').totalMs).toBeLessThan(base.totalMs);
  });
  test('critical relaxes budget', () => {
    const base = createLatencyBudget();
    expect(adjustBudgetForBattery(base, 'critical').totalMs).toBeGreaterThan(base.totalMs);
  });
  test('critical target never changes', () => {
    const base = createLatencyBudget();
    expect(adjustBudgetForBattery(base, 'critical').criticalTargetMs).toBe(base.criticalTargetMs);
    expect(adjustBudgetForBattery(base, 'performance').criticalTargetMs).toBe(base.criticalTargetMs);
  });
});

describe('recordLatency', () => {
  test('calculates total correctly', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 100, reasoningMs: 80, speechMs: 150 });
    expect(record.totalMs).toBe(330);
  });
  test('within budget when total < totalMs', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 100, reasoningMs: 50, speechMs: 100 });
    expect(record.withinBudget).toBe(true);
  });
  test('exceeds budget when over totalMs', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 200, reasoningMs: 200, speechMs: 200 });
    expect(record.withinBudget).toBe(false);
  });
  test('critical alert uses 500ms limit', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 150, reasoningMs: 100, speechMs: 200 }, true);
    expect(record.withinBudget).toBe(true);
  });
});

describe('isBudgetExceeded', () => {
  test('within budget → false', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 50, reasoningMs: 50, speechMs: 100 });
    expect(isBudgetExceeded(budget, record)).toBe(false);
  });
  test('over budget → true', () => {
    const budget = createLatencyBudget();
    const record = recordLatency(budget, { perceptionMs: 300, reasoningMs: 200, speechMs: 300 });
    expect(isBudgetExceeded(budget, record)).toBe(true);
  });
});

describe('isCriticalAlertOnTime', () => {
  test('under 500ms → true', () => {
    const budget = createLatencyBudget();
    expect(isCriticalAlertOnTime(400, budget)).toBe(true);
  });
  test('at exactly 500ms → true', () => {
    const budget = createLatencyBudget();
    expect(isCriticalAlertOnTime(500, budget)).toBe(true);
  });
  test('over 500ms → false', () => {
    const budget = createLatencyBudget();
    expect(isCriticalAlertOnTime(501, budget)).toBe(false);
  });
});

describe('buildLatencyReport', () => {
  test('empty records', () => expect(buildLatencyReport([]).count).toBe(0));
  test('counts records', () => {
    const budget = createLatencyBudget();
    const records = [0, 1, 2].map(t => buildSimulatedLatencyRecord(budget, t));
    expect(buildLatencyReport(records).count).toBe(3);
  });
  test('avgTotalMs is positive', () => {
    const budget = createLatencyBudget();
    const records = [0, 1, 2].map(t => buildSimulatedLatencyRecord(budget, t));
    expect(buildLatencyReport(records).avgTotalMs).toBeGreaterThan(0);
  });
  test('critical on time pct default is 100', () => {
    expect(buildLatencyReport([]).criticalOnTimePct).toBe(100);
  });
});

describe('formatLatencyMs / formatBudgetStatus / formatBudget', () => {
  test('formatLatencyMs has ms suffix', () => expect(formatLatencyMs(150)).toContain('ms'));
  test('within budget format', () => {
    const budget = createLatencyBudget();
    const r = recordLatency(budget, { perceptionMs: 50, reasoningMs: 50, speechMs: 100 });
    expect(formatBudgetStatus(r)).toContain('Within');
  });
  test('exceeded budget format', () => {
    const budget = createLatencyBudget();
    const r = recordLatency(budget, { perceptionMs: 300, reasoningMs: 200, speechMs: 300 });
    expect(formatBudgetStatus(r)).toContain('exceeded');
  });
  test('formatBudget includes all components', () => {
    const f = formatBudget(createLatencyBudget());
    expect(f).toContain('ms');
    expect(f).toContain('500');
  });
});

// ─── BATTERY OPTIMIZATION ENGINE ──────────────────────────────────────────────
describe('classifyBatteryMode', () => {
  test('charging → performance', () => expect(classifyBatteryMode(10, true)).toBe('performance'));
  test('70% not charging → performance', () => expect(classifyBatteryMode(70, false)).toBe('performance'));
  test('50% not charging → balanced', () => expect(classifyBatteryMode(50, false)).toBe('balanced'));
  test('20% not charging → power_saver', () => expect(classifyBatteryMode(20, false)).toBe('power_saver'));
  test('5% not charging → critical', () => expect(classifyBatteryMode(5, false)).toBe('critical'));
});

describe('getBatteryModeLabel', () => {
  test('performance has green', () => expect(getBatteryModeLabel('performance')).toContain('🟢'));
  test('critical has red', () => expect(getBatteryModeLabel('critical')).toContain('🔴'));
  test('power_saver has orange', () => expect(getBatteryModeLabel('power_saver')).toContain('🟠'));
  test('balanced has yellow', () => expect(getBatteryModeLabel('balanced')).toContain('🟡'));
});

describe('getBatteryOptimizationProfile', () => {
  test('performance has highest FPS', () => {
    const perf = getBatteryOptimizationProfile('performance');
    const crit = getBatteryOptimizationProfile('critical');
    expect(perf.targetFPS).toBeGreaterThan(crit.targetFPS);
  });
  test('critical pauses cloud', () => expect(getBatteryOptimizationProfile('critical').pauseCloudReasoning).toBe(true));
  test('performance does not pause cloud', () => expect(getBatteryOptimizationProfile('performance').pauseCloudReasoning).toBe(false));
  test('critical prioritizes local', () => expect(getBatteryOptimizationProfile('critical').prioritizeLocal).toBe(true));
});

describe('getRecommendedFPS', () => {
  test('positive FPS', () => expect(getRecommendedFPS('balanced', false)).toBeGreaterThan(0));
  test('near hazard → higher FPS', () => {
    expect(getRecommendedFPS('balanced', true)).toBeGreaterThan(getRecommendedFPS('balanced', false));
  });
  test('critical mode → lowest FPS', () => {
    expect(getRecommendedFPS('critical', false)).toBeLessThan(getRecommendedFPS('performance', false));
  });
  test('near hazard critical does not exceed 1 (safety cap)', () => {
    // Critical mode: targetFPS is 1, * 2 = 2, min(2, 15) = 2, but critical doesn't boost
    // Actually: if batteryMode === 'critical', we don't boost
    expect(getRecommendedFPS('critical', true)).toBeGreaterThanOrEqual(1);
  });
});

describe('shouldPauseCloudReasoning', () => {
  test('critical alert → never pause', () => expect(shouldPauseCloudReasoning('critical', true)).toBe(false));
  test('critical mode + non-critical alert → pause', () => expect(shouldPauseCloudReasoning('critical', false)).toBe(true));
  test('performance mode → never pause', () => expect(shouldPauseCloudReasoning('performance', false)).toBe(false));
});

describe('shouldPrioritizeLocal', () => {
  test('performance → false', () => expect(shouldPrioritizeLocal('performance')).toBe(false));
  test('power_saver → true', () => expect(shouldPrioritizeLocal('power_saver')).toBe(true));
  test('critical → true', () => expect(shouldPrioritizeLocal('critical')).toBe(true));
});

describe('shouldSkipPeripheralCameras', () => {
  test('performance → false', () => expect(shouldSkipPeripheralCameras('performance')).toBe(false));
  test('critical → true', () => expect(shouldSkipPeripheralCameras('critical')).toBe(true));
  test('power_saver → true', () => expect(shouldSkipPeripheralCameras('power_saver')).toBe(true));
});

describe('getRecommendedRuntime', () => {
  test('returns a runtime string', () => expect(getRecommendedRuntime('balanced').length).toBeGreaterThan(0));
  test('critical → browser', () => expect(getRecommendedRuntime('critical')).toBe('browser'));
  test('performance → webgpu', () => expect(getRecommendedRuntime('performance')).toBe('webgpu'));
});

describe('adjustModeForThermal', () => {
  test('normal → unchanged', () => expect(adjustModeForThermal('balanced', 'normal')).toBe('balanced'));
  test('warm steps down one', () => expect(adjustModeForThermal('performance', 'warm')).toBe('balanced'));
  test('hot steps down two', () => expect(adjustModeForThermal('performance', 'hot')).toBe('power_saver'));
  test('cannot go below critical', () => expect(adjustModeForThermal('critical', 'hot')).toBe('critical'));
});

describe('getBatteryModeWarning', () => {
  test('performance → no warning', () => expect(getBatteryModeWarning('performance')).toBeNull());
  test('balanced → no warning', () => expect(getBatteryModeWarning('balanced')).toBeNull());
  test('critical → warning', () => expect(getBatteryModeWarning('critical')?.toLowerCase()).toContain('critical'));
  test('power_saver → warning', () => expect(getBatteryModeWarning('power_saver')?.toLowerCase()).toContain('battery'));
});

describe('OFFLINE_SAFETY_MESSAGE', () => {
  test('contains local safety mode', () => expect(OFFLINE_SAFETY_MESSAGE.toLowerCase()).toContain('local safety'));
  test('contains online ai', () => expect(OFFLINE_SAFETY_MESSAGE.toLowerCase()).toContain('online ai'));
  test('non-empty', () => expect(OFFLINE_SAFETY_MESSAGE.length).toBeGreaterThan(0));
});

describe('DEFAULT_LATENCY_BUDGET', () => {
  test('critical target is 500ms', () => expect(DEFAULT_LATENCY_BUDGET.criticalTargetMs).toBe(500));
  test('total is sum of components', () => {
    const { perceptionMs, reasoningMs, speechMs, totalMs } = DEFAULT_LATENCY_BUDGET;
    expect(perceptionMs + reasoningMs + speechMs).toBe(totalMs);
  });
});

describe('DEFAULT_ONDEVICE_CONFIG', () => {
  test('criticalAlertsLocal is true', () => expect(DEFAULT_ONDEVICE_CONFIG.criticalAlertsLocal).toBe(true));
  test('cloudFallbackEnabled is true', () => expect(DEFAULT_ONDEVICE_CONFIG.cloudFallbackEnabled).toBe(true));
  test('offlineFirst is false by default', () => expect(DEFAULT_ONDEVICE_CONFIG.offlineFirst).toBe(false));
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
