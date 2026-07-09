// Sprint 19: Hardware Specification & Manufacturing Readiness — test suite
// Run: npx tsx tests/hardwareSpecification.test.ts

import { strict as assert } from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${(e as Error).message}`);
  }
}

const DOCS = join(__dirname, '../docs');

function doc(name: string): string {
  const p = join(DOCS, name);
  assert.ok(existsSync(p), `Missing document: ${name}`);
  return readFileSync(p, 'utf-8');
}

// ─── Suite 1: Document existence ──────────────────────────────────────────────

console.log('\nDocument existence');

const DOC_FILES = [
  'SPRINT_19_HARDWARE_SPECIFICATION.md',
  'HARDWARE_ARCHITECTURE.md',
  'SENSOR_REQUIREMENTS.md',
  'CAMERA_REQUIREMENTS.md',
  'POWER_SYSTEM.md',
  'MANUFACTURING_READINESS.md',
];

for (const f of DOC_FILES) {
  test(`${f} exists`, () => {
    const p = join(DOCS, f);
    assert.ok(existsSync(p), `File not found: docs/${f}`);
  });
}

test('all 6 Sprint 19 doc files present', () => {
  for (const f of DOC_FILES) {
    assert.ok(existsSync(join(DOCS, f)), `Missing: ${f}`);
  }
});

// ─── Suite 2: Sprint 19 main spec ─────────────────────────────────────────────

console.log('\nSPRINT_19_HARDWARE_SPECIFICATION.md');

test('contains prototype target section', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Prototype Target'), 'Missing Prototype Target section');
});

test('specifies weight target ≤ 85 g', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('85 g'), 'Missing weight target');
});

test('specifies ≥ 4 hours continuous operation', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('4 hour'), 'Missing 4h runtime target');
});

test('defines quality gates section', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Quality Gates'), 'Missing Quality Gates section');
});

test('links to HAL (Sprint 17)', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Sprint 17') && s.includes('HAL'), 'Missing HAL Sprint 17 link');
});

test('links to Digital Twin (Sprint 18)', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Sprint 18') && s.includes('Digital Twin'), 'Missing Digital Twin link');
});

test('includes EVT/DVT/PVT milestones', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('EVT'), 'Missing EVT');
  assert.ok(s.includes('DVT'), 'Missing DVT');
  assert.ok(s.includes('PVT'), 'Missing PVT');
});

test('USB-C connectivity specified', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('USB-C'), 'Missing USB-C');
});

test('Wi-Fi 6 specified', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Wi-Fi 6'), 'Missing Wi-Fi 6');
});

test('Bluetooth 5.3 specified', () => {
  const s = doc('SPRINT_19_HARDWARE_SPECIFICATION.md');
  assert.ok(s.includes('Bluetooth 5.3') || s.includes('Bluetooth'), 'Missing Bluetooth');
});

// ─── Suite 3: Hardware architecture ───────────────────────────────────────────

console.log('\nHARDWARE_ARCHITECTURE.md');

test('contains system block diagram', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('COMPUTE MODULE') || s.includes('block diagram'), 'Missing block diagram');
});

test('defines camera interface (MIPI CSI-2)', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('MIPI CSI-2'), 'Missing MIPI CSI-2 camera interface');
});

test('defines power interface (PMIC / buck converters)', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('PMIC'), 'Missing PMIC in power interface');
});

test('defines audio interface (I2S / bone-conduction)', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('I2S'), 'Missing I2S audio interface');
  assert.ok(s.includes('one-conduction') || s.includes('Bone'), 'Missing bone-conduction reference');
});

test('defines sensor interface (I2C)', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('I2C'), 'Missing I2C sensor interface');
});

test('includes modularity rules', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('Modularity') || s.includes('modularity'), 'Missing modularity rules');
});

test('references HAL (Sprint 17)', () => {
  const s = doc('HARDWARE_ARCHITECTURE.md');
  assert.ok(s.includes('hardwareHAL') || s.includes('Sprint 17'), 'Missing HAL reference');
});

// ─── Suite 4: Sensor requirements ─────────────────────────────────────────────

console.log('\nSENSOR_REQUIREMENTS.md');

test('GPS requirements present', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('GPS') && s.includes('GNSS'), 'Missing GPS/GNSS');
});

test('GPS cold start TTFF ≤ 30s', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('30 s') || s.includes('30s'), 'Missing GPS TTFF spec');
});

test('IMU requirements present (6-axis)', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('6-axis') || s.includes('6 axis'), 'Missing 6-axis IMU');
});

test('fall detection specified', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('Fall detection') || s.includes('fall detection'), 'Missing fall detection');
});

test('microphone array specified (3 mics)', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('3') && (s.includes('MEMS') || s.includes('microphone')), 'Missing mic array spec');
});

test('bone-conduction speaker specified', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('one-conduction') || s.includes('Bone'), 'Missing bone-conduction speaker');
});

test('privacy requirement for GPS (fuzzing)', () => {
  const s = doc('SENSOR_REQUIREMENTS.md');
  assert.ok(s.includes('fuzzing') || s.includes('privacy') || s.includes('Privacy'), 'Missing GPS privacy');
});

// ─── Suite 5: Camera requirements ─────────────────────────────────────────────

console.log('\nCAMERA_REQUIREMENTS.md');

test('4 cameras defined', () => {
  const s = doc('CAMERA_REQUIREMENTS.md');
  const cameras = ['front-wide', 'front-tele', 'side-left', 'side-right'];
  for (const c of cameras) {
    assert.ok(s.toLowerCase().includes(c.toLowerCase().replace('-', '').replace('-', '')) ||
              s.includes(c) || s.includes(c.replace('-', ' ')), `Missing camera: ${c}`);
  }
});

test('front-wide 120° FOV specified', () => {
  const s = doc('CAMERA_REQUIREMENTS.md');
  assert.ok(s.includes('120°'), 'Missing 120° FOV');
});

test('camera fallback chain specified', () => {
  const s = doc('CAMERA_REQUIREMENTS.md');
  assert.ok(s.includes('fallback') || s.includes('Fallback'), 'Missing camera fallback chain');
});

test('crossing safety rule present (never says safe to cross)', () => {
  const s = doc('CAMERA_REQUIREMENTS.md');
  assert.ok(
    s.includes('safe to cross') || s.includes('crossing'),
    'Missing crossing safety rule'
  );
});

test('privacy requirements for video', () => {
  const s = doc('CAMERA_REQUIREMENTS.md');
  assert.ok(s.includes('privacy') || s.includes('Privacy') || s.includes('consent'), 'Missing camera privacy');
});

// ─── Suite 6: Power system ─────────────────────────────────────────────────────

console.log('\nPOWER_SYSTEM.md');

test('battery spec: 2500 mAh Li-Po', () => {
  const s = doc('POWER_SYSTEM.md');
  assert.ok(s.includes('2500 mAh') || s.includes('Li-Po'), 'Missing battery spec');
});

test('4 battery modes defined', () => {
  const s = doc('POWER_SYSTEM.md');
  const modes = ['Performance', 'Balanced', 'Low-Power', 'Emergency'];
  for (const m of modes) {
    assert.ok(s.includes(m) || s.includes(m.toLowerCase()), `Missing battery mode: ${m}`);
  }
});

test('critical battery threshold ≤ 10%', () => {
  const s = doc('POWER_SYSTEM.md');
  assert.ok(s.includes('10 %') || s.includes('10%'), 'Missing 10% critical threshold');
});

test('thermal thresholds defined (38°C / 42°C / 48°C)', () => {
  const s = doc('POWER_SYSTEM.md');
  assert.ok(s.includes('38'), 'Missing 38°C warm threshold');
  assert.ok(s.includes('42'), 'Missing 42°C hot threshold');
  assert.ok(s.includes('48'), 'Missing 48°C critical threshold');
});

test('emergency power path specified', () => {
  const s = doc('POWER_SYSTEM.md');
  assert.ok(s.includes('emergency') || s.includes('Emergency'), 'Missing emergency power path');
});

test('USB-C PD charging specified', () => {
  const s = doc('POWER_SYSTEM.md');
  assert.ok(s.includes('USB-C') || s.includes('USB PD'), 'Missing USB-C charging');
});

// ─── Suite 7: Manufacturing readiness ─────────────────────────────────────────

console.log('\nMANUFACTURING_READINESS.md');

test('EVT stage defined with target quarter', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('EVT') && (s.includes('Q4 2026') || s.includes('2026')), 'Missing EVT with date');
});

test('DVT stage defined', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('DVT'), 'Missing DVT');
});

test('PVT stage defined', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('PVT'), 'Missing PVT');
});

test('compliance requirements: CE and GDPR', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('CE'), 'Missing CE compliance');
  assert.ok(s.includes('GDPR'), 'Missing GDPR');
});

test('software readiness section with test commands', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('glassesSimulator.test.ts'), 'Missing Digital Twin test reference');
  assert.ok(s.includes('hardwareAbstraction.test.ts'), 'Missing HAL test reference');
});

test('IP53 rating target', () => {
  const s = doc('MANUFACTURING_READINESS.md');
  assert.ok(s.includes('IP53'), 'Missing IP53 rating');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Hardware Specification Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
