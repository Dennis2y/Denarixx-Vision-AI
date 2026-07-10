// ─── Bring-Up Program: Hardware Output Test Engine ────────────────────────────
// Pure functions — no async, no I/O.
// Engineers can run hardware output tests without starting live navigation.
// Tests: bone-conduction speech playback, audio interruption, haptic patterns,
// critical-priority speech, and combined audio+haptic sequences.

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputTestType =
  | 'speech-basic'            // speaks a test phrase
  | 'speech-critical'         // tests critical-priority speech (interrupt)
  | 'speech-interrupt'        // low-priority speech, then interrupt with high
  | 'haptic-stop-immediately'
  | 'haptic-hazard-left'
  | 'haptic-hazard-right'
  | 'haptic-obstacle-ahead'
  | 'haptic-device-failure'
  | 'haptic-low-battery'
  | 'haptic-all-patterns'     // cycles all 6 patterns with announcements
  | 'audio-haptic-combined'   // critical speech + stop-immediately haptic together
  | 'volume-sweep'            // plays phrase at each volume level
  | 'bone-conduction-check';  // bone-conduction specific frequency test

export type OutputTestStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export interface HapticPattern {
  patternId: string;
  name: string;
  description: string;
  pulseMs: number[];            // on/off sequence in ms
  repeatCount: number;
  intensityLevel: number;       // 0–10
}

// ─── Haptic Pattern Library ────────────────────────────────────────────────────

export const HAPTIC_PATTERNS: Record<string, HapticPattern> = {
  'stop-immediately': {
    patternId: 'stop-immediately',
    name: 'Stop Immediately',
    description: 'Three rapid strong pulses — critical hazard, stop now',
    pulseMs: [100, 50, 100, 50, 100],
    repeatCount: 1,
    intensityLevel: 10,
  },
  'hazard-left': {
    patternId: 'hazard-left',
    name: 'Hazard Left',
    description: 'Two short pulses — hazard detected to your left',
    pulseMs: [80, 40, 80],
    repeatCount: 1,
    intensityLevel: 8,
  },
  'hazard-right': {
    patternId: 'hazard-right',
    name: 'Hazard Right',
    description: 'Three short pulses — hazard detected to your right',
    pulseMs: [40, 40, 40, 40, 40],
    repeatCount: 1,
    intensityLevel: 8,
  },
  'obstacle-ahead': {
    patternId: 'obstacle-ahead',
    name: 'Obstacle Ahead',
    description: 'One long pulse — obstacle directly ahead',
    pulseMs: [200],
    repeatCount: 1,
    intensityLevel: 9,
  },
  'device-failure': {
    patternId: 'device-failure',
    name: 'Device Failure',
    description: 'Long-short-long Morse-like pattern — hardware fault',
    pulseMs: [300, 80, 100, 80, 300],
    repeatCount: 1,
    intensityLevel: 10,
  },
  'low-battery': {
    patternId: 'low-battery',
    name: 'Low Battery',
    description: 'Two slow pulses — battery critically low',
    pulseMs: [150, 300, 150],
    repeatCount: 3,
    intensityLevel: 6,
  },
};

// ─── Test Script ──────────────────────────────────────────────────────────────

export interface OutputTestStep {
  stepId: string;
  type: OutputTestType;
  description: string;
  speechText: string | null;         // null if no speech
  hapticPatternId: string | null;    // null if no haptic
  expectedDurationMs: number;
}

export interface OutputTestResult {
  type: OutputTestType;
  status: OutputTestStatus;
  durationMs: number;
  error: string | null;
  engineerNote: string;
}

export interface OutputTestSession {
  sessionId: string;
  steps: OutputTestStep[];
  results: OutputTestResult[];
  isComplete: boolean;
  passedCount: number;
  failedCount: number;
  startedAt: number;
  completedAt: number | null;
}

// ─── Test Step Definitions ────────────────────────────────────────────────────

export function buildSpeechTest(): OutputTestStep {
  return {
    stepId: 'speech-basic',
    type: 'speech-basic',
    description: 'Basic bone-conduction speech playback test',
    speechText: 'Denarixx Vision glasses are active. Obstacle detection is ready.',
    hapticPatternId: null,
    expectedDurationMs: 4000,
  };
}

export function buildCriticalSpeechTest(): OutputTestStep {
  return {
    stepId: 'speech-critical',
    type: 'speech-critical',
    description: 'Critical-priority speech — should interrupt any lower-priority audio',
    speechText: 'Warning. Stop immediately. Obstacle ahead.',
    hapticPatternId: 'stop-immediately',
    expectedDurationMs: 2500,
  };
}

export function buildHapticTest(patternId: string): OutputTestStep {
  const pattern = HAPTIC_PATTERNS[patternId];
  return {
    stepId: `haptic-${patternId}`,
    type: `haptic-${patternId}` as OutputTestType,
    description: `Haptic pattern: ${pattern?.name ?? patternId}`,
    speechText: `Testing haptic pattern: ${pattern?.name ?? patternId}.`,
    hapticPatternId: patternId,
    expectedDurationMs: pattern ? pattern.pulseMs.reduce((a, b) => a + b, 0) + 500 : 1000,
  };
}

export function buildAllPatternsTest(): OutputTestStep {
  return {
    stepId: 'haptic-all-patterns',
    type: 'haptic-all-patterns',
    description: 'Cycles all 6 haptic patterns with spoken announcements',
    speechText: 'Starting haptic pattern test. Six patterns will play in sequence.',
    hapticPatternId: null,
    expectedDurationMs: 8000,
  };
}

export function buildCombinedTest(): OutputTestStep {
  return {
    stepId: 'audio-haptic-combined',
    type: 'audio-haptic-combined',
    description: 'Critical speech with simultaneous stop-immediately haptic',
    speechText: 'Critical alert. Stop immediately.',
    hapticPatternId: 'stop-immediately',
    expectedDurationMs: 3000,
  };
}

// ─── Full Test Session Builder ────────────────────────────────────────────────

export function createOutputTestSession(sessionId: string, nowMs: number): OutputTestSession {
  const steps: OutputTestStep[] = [
    buildSpeechTest(),
    buildCriticalSpeechTest(),
    buildHapticTest('stop-immediately'),
    buildHapticTest('hazard-left'),
    buildHapticTest('hazard-right'),
    buildHapticTest('obstacle-ahead'),
    buildHapticTest('device-failure'),
    buildHapticTest('low-battery'),
    buildCombinedTest(),
    buildAllPatternsTest(),
  ];

  return {
    sessionId,
    steps,
    results: [],
    isComplete: false,
    passedCount: 0,
    failedCount: 0,
    startedAt: nowMs,
    completedAt: null,
  };
}

// ─── Result Recording ─────────────────────────────────────────────────────────

export function recordTestResult(
  session: OutputTestSession,
  type: OutputTestType,
  passed: boolean,
  durationMs: number,
  error: string | null,
  nowMs: number,
): OutputTestSession {
  const result: OutputTestResult = {
    type,
    status: passed ? 'passed' : 'failed',
    durationMs,
    error,
    engineerNote: passed
      ? 'Output confirmed by engineer observation.'
      : `Failed: ${error ?? 'unknown error'}`,
  };

  const results = [...session.results, result];
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const isComplete = results.length >= session.steps.length;

  return {
    ...session,
    results,
    passedCount,
    failedCount,
    isComplete,
    completedAt: isComplete ? nowMs : null,
  };
}

// ─── Session Report ───────────────────────────────────────────────────────────

export interface OutputTestReport {
  sessionId: string;
  passedCount: number;
  failedCount: number;
  totalCount: number;
  allPassed: boolean;
  summary: string;
  results: OutputTestResult[];
}

export function buildOutputTestReport(session: OutputTestSession): OutputTestReport {
  const total = session.steps.length;
  const allPassed = session.failedCount === 0 && session.passedCount === total;

  return {
    sessionId: session.sessionId,
    passedCount: session.passedCount,
    failedCount: session.failedCount,
    totalCount: total,
    allPassed,
    summary: allPassed
      ? `All ${total} hardware output tests passed. Audio and haptic hardware confirmed.`
      : `${session.failedCount} of ${total} output tests failed. Review failed items before deployment.`,
    results: session.results,
  };
}

export function getHapticPattern(patternId: string): HapticPattern | null {
  return HAPTIC_PATTERNS[patternId] ?? null;
}

export function getAllHapticPatternIds(): string[] {
  return Object.keys(HAPTIC_PATTERNS);
}
