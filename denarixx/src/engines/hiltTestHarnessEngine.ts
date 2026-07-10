// ─── Bring-Up Program: Hardware-in-the-Loop Test Harness Engine ──────────────
// Pure functions — no async, no I/O.
// Records structured diagnostic metrics without storing raw video by default.
// Machine-readable output for automated analysis and regression detection.

// ─── Types ────────────────────────────────────────────────────────────────────

export type HILTMetricName =
  | 'camera-fps'
  | 'inference-latency-ms'
  | 'guardian-latency-ms'
  | 'speech-queue-delay-ms'
  | 'total-warning-latency-ms'
  | 'cpu-usage-pct'
  | 'memory-usage-mb'
  | 'battery-drain-pct-per-hour'
  | 'temperature-c'
  | 'dropped-frames'
  | 'provider-failures'
  | 'sensor-health-score';

export type HILTScenario =
  | 'stationary-indoor'
  | 'walking-toward-obstacle'
  | 'person-approaching'
  | 'parked-vehicle'
  | 'moving-bicycle-controlled'
  | 'doorway-detection'
  | 'low-light-degradation'
  | 'internet-loss'
  | 'camera-disconnection'
  | 'low-battery-simulation'
  | 'overheating-simulation'
  | 'audio-failure-haptic-fallback';

export interface HILTSample {
  timestampMs: number;
  metric: HILTMetricName;
  value: number;
  unit: string;
  sessionId: string;
  scenarioId: HILTScenario | 'free-run';
  frameNumber: number;
}

export interface HILTMetricSummary {
  metric: HILTMetricName;
  sampleCount: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  unit: string;
  passedBudget: boolean;
  budget: number | null;
}

// ─── Budget Thresholds ────────────────────────────────────────────────────────

const METRIC_BUDGETS: Partial<Record<HILTMetricName, { value: number; unit: string }>> = {
  'camera-fps':                   { value: 10,  unit: 'fps (min)' },
  'inference-latency-ms':         { value: 500, unit: 'ms (max)' },
  'guardian-latency-ms':          { value: 200, unit: 'ms (max)' },
  'speech-queue-delay-ms':        { value: 300, unit: 'ms (max)' },
  'total-warning-latency-ms':     { value: 1000, unit: 'ms (max)' },
  'cpu-usage-pct':                { value: 85,  unit: '% (max)' },
  'memory-usage-mb':              { value: 3072, unit: 'MB (max)' },
  'temperature-c':                { value: 80,  unit: '°C (max)' },
};

// ─── Session State ────────────────────────────────────────────────────────────

export interface HILTSession {
  sessionId: string;
  scenario: HILTScenario | 'free-run';
  startedAt: number;
  completedAt: number | null;
  frameCount: number;
  droppedFrames: number;
  providerFailures: number;
  samples: HILTSample[];
  isComplete: boolean;
  storeRawVideo: false;   // structural: raw video never stored by default
}

export function createHILTSession(
  sessionId: string,
  scenario: HILTScenario | 'free-run',
  nowMs: number,
): HILTSession {
  return {
    sessionId,
    scenario,
    startedAt: nowMs,
    completedAt: null,
    frameCount: 0,
    droppedFrames: 0,
    providerFailures: 0,
    samples: [],
    isComplete: false,
    storeRawVideo: false,
  };
}

// ─── Sample Recording ─────────────────────────────────────────────────────────

export function recordSample(
  session: HILTSession,
  metric: HILTMetricName,
  value: number,
  unit: string,
  nowMs: number,
): HILTSession {
  const sample: HILTSample = {
    timestampMs: nowMs,
    metric,
    value,
    unit,
    sessionId: session.sessionId,
    scenarioId: session.scenario,
    frameNumber: session.frameCount,
  };
  return { ...session, samples: [...session.samples, sample] };
}

export function recordFrameTick(session: HILTSession, dropped: boolean): HILTSession {
  return {
    ...session,
    frameCount: session.frameCount + 1,
    droppedFrames: session.droppedFrames + (dropped ? 1 : 0),
  };
}

export function recordProviderFailure(session: HILTSession): HILTSession {
  return { ...session, providerFailures: session.providerFailures + 1 };
}

export function completeHILTSession(session: HILTSession, nowMs: number): HILTSession {
  return { ...session, isComplete: true, completedAt: nowMs };
}

// ─── Metric Aggregation ───────────────────────────────────────────────────────

export function aggregateMetric(
  samples: HILTSample[],
  metric: HILTMetricName,
): HILTMetricSummary | null {
  const values = samples
    .filter(s => s.metric === metric)
    .map(s => s.value)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const p95Index = Math.floor(values.length * 0.95);
  const p95 = values[Math.min(p95Index, values.length - 1)];
  const budget = METRIC_BUDGETS[metric];

  const passedBudget = budget
    ? metric === 'camera-fps'
      ? avg >= budget.value   // fps: higher is better
      : p95 <= budget.value   // latency/usage: lower is better
    : true;

  const unit = samples.find(s => s.metric === metric)?.unit ?? '';

  return {
    metric,
    sampleCount: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: Math.round(avg * 10) / 10,
    p95: Math.round(p95 * 10) / 10,
    unit,
    passedBudget,
    budget: budget?.value ?? null,
  };
}

export function buildFullReport(session: HILTSession): HILTReport {
  const allMetrics: HILTMetricName[] = [
    'camera-fps', 'inference-latency-ms', 'guardian-latency-ms',
    'speech-queue-delay-ms', 'total-warning-latency-ms',
    'cpu-usage-pct', 'memory-usage-mb', 'battery-drain-pct-per-hour',
    'temperature-c', 'sensor-health-score',
  ];

  const summaries = allMetrics
    .map(m => aggregateMetric(session.samples, m))
    .filter((s): s is HILTMetricSummary => s !== null);

  const failedBudgets = summaries.filter(s => !s.passedBudget);
  const durationMs = session.completedAt
    ? session.completedAt - session.startedAt
    : Date.now() - session.startedAt;

  const droppedFramePct = session.frameCount > 0
    ? Math.round((session.droppedFrames / session.frameCount) * 1000) / 10
    : 0;

  return {
    sessionId: session.sessionId,
    scenario: session.scenario,
    durationMs,
    frameCount: session.frameCount,
    droppedFrames: session.droppedFrames,
    droppedFramePct,
    providerFailures: session.providerFailures,
    summaries,
    failedBudgets: failedBudgets.map(s => s.metric),
    allBudgetsPassed: failedBudgets.length === 0,
    storeRawVideo: false,
    generatedAt: Date.now(),
  };
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface HILTReport {
  sessionId: string;
  scenario: HILTScenario | 'free-run';
  durationMs: number;
  frameCount: number;
  droppedFrames: number;
  droppedFramePct: number;
  providerFailures: number;
  summaries: HILTMetricSummary[];
  failedBudgets: HILTMetricName[];
  allBudgetsPassed: boolean;
  storeRawVideo: false;
  generatedAt: number;
}

// ─── Scenario Definitions ─────────────────────────────────────────────────────

export interface HILTScenarioDefinition {
  id: HILTScenario;
  name: string;
  description: string;
  supervisedOnly: boolean;
  publicRoadSafe: boolean;
  durationTargetS: number;
  expectedDetections: string[];
  passCriteria: string[];
  notes: string;
}

export const HILT_SCENARIO_REGISTRY: HILTScenarioDefinition[] = [
  {
    id: 'stationary-indoor',
    name: 'Stationary Indoor Object Detection',
    description: 'Glasses stationary in controlled indoor environment. Verify baseline detection rate and latency.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 60,
    expectedDetections: ['person', 'chair', 'obstacle'],
    passCriteria: ['inference latency < 500ms', 'camera FPS ≥ 10', 'dropped frames < 5%'],
    notes: 'No blind user involvement. Engineer observation only.',
  },
  {
    id: 'walking-toward-obstacle',
    name: 'Walking Toward Large Obstacle',
    description: 'Tester walks toward a known obstacle (box, wall) in controlled space.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 30,
    expectedDetections: ['obstacle'],
    passCriteria: ['obstacle announced before 1m', 'haptic triggered', 'total warning latency < 1000ms'],
    notes: 'Engineer present. Safe indoor space only.',
  },
  {
    id: 'person-approaching',
    name: 'Person Approaching',
    description: 'A second engineer walks toward the glasses wearer in a controlled corridor.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 20,
    expectedDetections: ['person'],
    passCriteria: ['person detected at ≥ 3m', 'directional guidance announced'],
    notes: 'Both participants must be engineers. No blind users.',
  },
  {
    id: 'parked-vehicle',
    name: 'Parked Vehicle',
    description: 'Glasses wearer walks past a parked vehicle in a private carpark.',
    supervisedOnly: true,
    publicRoadSafe: false,
    durationTargetS: 30,
    expectedDetections: ['vehicle'],
    passCriteria: ['vehicle detected', 'no false crossing guidance issued'],
    notes: 'Private property only. No public road. No unsupervised use.',
  },
  {
    id: 'moving-bicycle-controlled',
    name: 'Moving Bicycle in Controlled Area',
    description: 'Engineer on bicycle crosses path of glasses wearer in private space at walking speed.',
    supervisedOnly: true,
    publicRoadSafe: false,
    durationTargetS: 20,
    expectedDetections: ['bicycle'],
    passCriteria: ['bicycle detected', 'hazard announced before crossing path'],
    notes: 'Private property. Controlled crossing at low speed. No blind users.',
  },
  {
    id: 'doorway-detection',
    name: 'Doorway Detection',
    description: 'Glasses wearer approaches a standard door opening.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 20,
    expectedDetections: ['doorway'],
    passCriteria: ['doorway guidance announced', 'no obstacle false positive for opening'],
    notes: 'Indoor only. No blind user. Doorway class is heuristic — not model-supported.',
  },
  {
    id: 'low-light-degradation',
    name: 'Low-Light Degradation',
    description: 'Lights dimmed progressively. Record detection rate and latency vs. baseline.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 60,
    expectedDetections: ['person'],
    passCriteria: ['system announces degraded confidence', 'no false-safe message'],
    notes: 'Compare with stationary-indoor baseline. No claims on night performance without hardware test.',
  },
  {
    id: 'internet-loss',
    name: 'Internet Loss',
    description: 'Wi-Fi disconnected mid-session. Verify offline announcement and provider switch.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 30,
    expectedDetections: [],
    passCriteria: ['offline announcement within 2s', 'local inference continues', 'no silent fallback to simulation'],
    notes: 'Tests provider switching. No blind users.',
  },
  {
    id: 'camera-disconnection',
    name: 'Camera Disconnection',
    description: 'Camera feed interrupted mid-session (cable pull or software disable).',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 20,
    expectedDetections: [],
    passCriteria: ['camera failure announced', 'no silent continuation', 'haptic device-failure triggered'],
    notes: 'Tests health degradation path.',
  },
  {
    id: 'low-battery-simulation',
    name: 'Low Battery Simulation',
    description: 'Battery level artificially set to 15%, then 8%, then 4%.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 60,
    expectedDetections: [],
    passCriteria: ['low battery announced at 20%', 'critical at 10%', 'emergency at 5%', 'haptic low-battery pattern triggered'],
    notes: 'Software simulation of battery level. Physical battery drain not tested here.',
  },
  {
    id: 'overheating-simulation',
    name: 'Overheating Simulation',
    description: 'Temperature sensor reading artificially raised to warn/throttle/shutdown thresholds.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 60,
    expectedDetections: [],
    passCriteria: ['throttle announced at 80°C', 'shutdown announced at 90°C', 'haptic device-failure triggered'],
    notes: 'Software simulation only. Do not actually overheat prototype hardware.',
  },
  {
    id: 'audio-failure-haptic-fallback',
    name: 'Audio Failure with Haptic Fallback',
    description: 'Audio output disabled mid-session. Verify haptic fallback activates.',
    supervisedOnly: true,
    publicRoadSafe: true,
    durationTargetS: 30,
    expectedDetections: ['obstacle'],
    passCriteria: ['audio failure announced (before failure)', 'haptic patterns continue', 'stop-immediately haptic on critical'],
    notes: 'Tests graceful degradation. Do not rely on haptics alone for complex instructions.',
  },
];

export function getScenario(id: HILTScenario): HILTScenarioDefinition | null {
  return HILT_SCENARIO_REGISTRY.find(s => s.id === id) ?? null;
}

export function getPublicRoadSafeScenarios(): HILTScenarioDefinition[] {
  return HILT_SCENARIO_REGISTRY.filter(s => s.publicRoadSafe);
}

export const HILT_SAFETY_NOTE = 'All HILT scenarios are supervised engineering tests only. Do not test public-road crossing guidance with a blind user during initial bring-up. Do not market the prototype as safe for unsupervised mobility.' as const;
