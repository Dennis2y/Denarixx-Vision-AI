/**
 * mobileReadiness.test.ts — V10 Mobile Deployment Readiness tests.
 *
 * Tests pure utility functions from src/lib/pwa.ts.
 * Runs in Node (no DOM) — all browser-API guards return safe defaults.
 *
 * Run: npx tsx tests/mobileReadiness.test.ts
 */

import {
  classifyBatteryLevel,
  batteryWarningMessage,
  connectionLabel,
  checkCapabilities,
  missingCapabilities,
  shouldShowInstallPrompt,
  getPWADisplayMode,
  isOffline,
} from '../src/lib/pwa';

// ─── Tiny test runner (matches project style) ─────────────────────────────────

let passed = 0;
let failed = 0;
const suites: string[] = [];
let currentSuite = '';

function describe(name: string, fn: () => void) {
  currentSuite = name;
  suites.push(name);
  console.log(`\n${name}`);
  fn();
}

function it(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${label}`);
    if (e instanceof Error) console.log(`    ${e.message}`);
    failed++;
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected)
        throw new Error(`expected: ${JSON.stringify(expected)}\n    received: ${JSON.stringify(actual)}`);
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`expected: ${JSON.stringify(expected)}\n    received: ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null)
        throw new Error(`expected null\n    received: ${JSON.stringify(actual)}`);
    },
    not: {
      toBeNull() {
        if (actual === null) throw new Error('expected non-null value');
      },
      toBe(expected: unknown) {
        if (actual === expected)
          throw new Error(`expected value to NOT be ${JSON.stringify(expected)}`);
      },
    },
    toContain(sub: string) {
      if (typeof actual !== 'string' || !actual.includes(sub))
        throw new Error(`expected "${actual}" to contain "${sub}"`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n)
        throw new Error(`expected ${actual} > ${n}`);
    },
    toHaveLength(n: number) {
      const a = actual as unknown[];
      if (!Array.isArray(a) || a.length !== n)
        throw new Error(`expected length ${n}, got ${Array.isArray(a) ? a.length : 'non-array'}`);
    },
  };
}

// ─── classifyBatteryLevel ─────────────────────────────────────────────────────

describe('classifyBatteryLevel — thresholds', () => {
  it('0.0 → critical', () => expect(classifyBatteryLevel(0.0)).toBe('critical'));
  it('0.05 → critical', () => expect(classifyBatteryLevel(0.05)).toBe('critical'));
  it('0.10 → critical (boundary)', () => expect(classifyBatteryLevel(0.10)).toBe('critical'));
  it('0.11 → low', () => expect(classifyBatteryLevel(0.11)).toBe('low'));
  it('0.15 → low', () => expect(classifyBatteryLevel(0.15)).toBe('low'));
  it('0.20 → low (boundary)', () => expect(classifyBatteryLevel(0.20)).toBe('low'));
  it('0.21 → ok', () => expect(classifyBatteryLevel(0.21)).toBe('ok'));
  it('0.50 → ok', () => expect(classifyBatteryLevel(0.50)).toBe('ok'));
  it('1.00 → ok', () => expect(classifyBatteryLevel(1.00)).toBe('ok'));
});

// ─── batteryWarningMessage ────────────────────────────────────────────────────

describe('batteryWarningMessage — messages', () => {
  it('critical level → non-null message', () => expect(batteryWarningMessage(0.05)).not.toBeNull());
  it('critical mentions "critically low"', () => expect(batteryWarningMessage(0.05)).toContain('critically low'));
  it('critical mentions "5%"', () => expect(batteryWarningMessage(0.05)).toContain('5%'));
  it('critical mentions "charge"', () => expect(batteryWarningMessage(0.05)).toContain('charge'));

  it('low level (0.15) → non-null message', () => expect(batteryWarningMessage(0.15)).not.toBeNull());
  it('low mentions "low"', () => expect(batteryWarningMessage(0.15)).toContain('low'));
  it('low mentions "15%"', () => expect(batteryWarningMessage(0.15)).toContain('15%'));

  it('0.10 → critical message (boundary at critical)', () => {
    const msg = batteryWarningMessage(0.10);
    expect(msg).not.toBeNull();
    expect(msg!).toContain('critically low');
  });

  it('ok level (0.50) → null', () => expect(batteryWarningMessage(0.50)).toBeNull());
  it('ok level (1.00) → null', () => expect(batteryWarningMessage(1.00)).toBeNull());
  it('ok boundary (0.21) → null', () => expect(batteryWarningMessage(0.21)).toBeNull());
});

// ─── connectionLabel ──────────────────────────────────────────────────────────

describe('connectionLabel — labels', () => {
  it('good → "Connected"',        () => expect(connectionLabel('good')).toBe('Connected'));
  it('degraded → "Slow connection"', () => expect(connectionLabel('degraded')).toBe('Slow connection'));
  it('offline → "Offline"',       () => expect(connectionLabel('offline')).toBe('Offline'));
});

// ─── checkCapabilities (Node / SSR) ──────────────────────────────────────────

describe('checkCapabilities — SSR defaults (Node has no DOM)', () => {
  const caps = checkCapabilities();
  it('camera → false in Node',          () => expect(caps.camera).toBe(false));
  it('speech → false in Node',          () => expect(caps.speech).toBe(false));
  it('serviceWorker → false in Node',   () => expect(caps.serviceWorker).toBe(false));
  it('vibration → false in Node',       () => expect(caps.vibration).toBe(false));
  it('speechRecognition → false in Node', () => expect(caps.speechRecognition).toBe(false));
});

// ─── missingCapabilities ─────────────────────────────────────────────────────

describe('missingCapabilities — messages', () => {
  it('all-false → 5 missing messages', () => {
    const msgs = missingCapabilities({
      camera: false, speech: false, serviceWorker: false, vibration: false, speechRecognition: false,
    });
    expect(msgs).toHaveLength(5);
  });

  it('all-true → no missing messages', () => {
    const msgs = missingCapabilities({
      camera: true, speech: true, serviceWorker: true, vibration: true, speechRecognition: true,
    });
    expect(msgs).toHaveLength(0);
  });

  it('only camera missing → 1 message', () => {
    const msgs = missingCapabilities({
      camera: false, speech: true, serviceWorker: true, vibration: true, speechRecognition: true,
    });
    expect(msgs).toHaveLength(1);
  });

  it('camera missing → mentions "simulation"', () => {
    const msgs = missingCapabilities({
      camera: false, speech: true, serviceWorker: true, vibration: true, speechRecognition: true,
    });
    expect(msgs[0]).toContain('simulation');
  });

  it('speech missing → mentions "audio output"', () => {
    const msgs = missingCapabilities({
      camera: true, speech: false, serviceWorker: true, vibration: true, speechRecognition: true,
    });
    expect(msgs[0]).toContain('audio output');
  });

  it('serviceWorker missing → mentions "offline"', () => {
    const msgs = missingCapabilities({
      camera: true, speech: true, serviceWorker: false, vibration: true, speechRecognition: true,
    });
    expect(msgs[0]).toContain('offline');
  });

  it('vibration missing → mentions "haptic"', () => {
    const msgs = missingCapabilities({
      camera: true, speech: true, serviceWorker: true, vibration: false, speechRecognition: true,
    });
    expect(msgs[0]).toContain('haptic');
  });

  it('speechRecognition missing → mentions "voice commands"', () => {
    const msgs = missingCapabilities({
      camera: true, speech: true, serviceWorker: true, vibration: true, speechRecognition: false,
    });
    expect(msgs[0]).toContain('voice commands');
  });
});

// ─── shouldShowInstallPrompt ──────────────────────────────────────────────────

describe('shouldShowInstallPrompt — logic (Node = not installed)', () => {
  it('prompt available + not installed (Node) → true', () => {
    expect(shouldShowInstallPrompt(true)).toBe(true);
  });
  it('no prompt → false regardless', () => {
    expect(shouldShowInstallPrompt(false)).toBe(false);
  });
});

// ─── getPWADisplayMode (Node = browser) ──────────────────────────────────────

describe('getPWADisplayMode — SSR/Node', () => {
  it('returns "browser" in Node (no matchMedia)', () => {
    expect(getPWADisplayMode()).toBe('browser');
  });
});

// ─── isOffline (Node) ────────────────────────────────────────────────────────

describe('isOffline — SSR/Node', () => {
  it('returns false when navigator is undefined (SSR)', () => {
    expect(isOffline()).toBe(false);
  });
});

// ─── Battery message rounding ─────────────────────────────────────────────────

describe('batteryWarningMessage — rounding edge cases', () => {
  it('0.099 → "10%" (9.9 rounds to 10)', () => {
    const msg = batteryWarningMessage(0.099);
    expect(msg!).toContain('10%');
  });
  it('0.101 → "10%" (rounds to 10)', () => {
    const msg = batteryWarningMessage(0.101);
    expect(msg!).toContain('10%');
  });
  it('0.195 → low warning (19–20%)', () => {
    const msg = batteryWarningMessage(0.195);
    expect(msg).not.toBeNull();
  });
  it('0.205 → null (21%)', () => {
    expect(batteryWarningMessage(0.205)).toBeNull();
  });
});

// ─── connectionLabel completeness ────────────────────────────────────────────

describe('connectionLabel — all values produce non-empty strings', () => {
  const qualities = ['good', 'degraded', 'offline'] as const;
  for (const q of qualities) {
    it(`"${q}" produces non-empty label`, () => {
      const label = connectionLabel(q);
      expect(label.length).toBeGreaterThan(0);
    });
  }
});

// ─── Result ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
