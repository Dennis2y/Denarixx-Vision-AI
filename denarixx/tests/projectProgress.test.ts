// Sprint progress engine tests
// Run: npx tsx tests/projectProgress.test.ts

import { strict as assert } from 'assert';
import {
  SPRINT_REGISTRY,
  PHASE_REGISTRY,
  computeProgress,
  getSprintById,
  getPhaseById,
  getSprintsForPhase,
  phaseStatusLabel,
  sprintStatusLabel,
  phaseStatusColor,
} from '../src/engines/projectProgressEngine';

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

function noFiles(): Set<string> { return new Set(); }
function allFiles(): Set<string> { return new Set(SPRINT_REGISTRY.map(s => s.testFile)); }
function firstN(n: number): Set<string> {
  return new Set(SPRINT_REGISTRY.slice(0, n).map(s => s.testFile));
}

// ─── Suite 1: Registry integrity ──────────────────────────────────────────────

console.log('\nRegistry integrity');

test('27 sprints defined', () => {
  assert.equal(SPRINT_REGISTRY.length, 27);
});

test('5 phases defined', () => {
  assert.equal(PHASE_REGISTRY.length, 5);
});

test('sprint IDs are 1-24 sequential', () => {
  for (let i = 0; i < SPRINT_REGISTRY.length; i++) {
    assert.equal(SPRINT_REGISTRY[i].id, i + 1);
  }
});

test('phase IDs are 1-5 sequential', () => {
  for (let i = 0; i < PHASE_REGISTRY.length; i++) {
    assert.equal(PHASE_REGISTRY[i].id, i + 1);
  }
});

test('all sprints have a non-empty testFile', () => {
  for (const s of SPRINT_REGISTRY) {
    assert.ok(s.testFile.endsWith('.test.ts'), `Sprint ${s.id} testFile invalid`);
  }
});

test('all sprints have positive engineCount and testCount', () => {
  for (const s of SPRINT_REGISTRY) {
    assert.ok(s.engineCount > 0, `Sprint ${s.id} engineCount must be > 0`);
    assert.ok(s.testCount > 0, `Sprint ${s.id} testCount must be > 0`);
  }
});

test('all sprints belong to phases 1-5', () => {
  for (const s of SPRINT_REGISTRY) {
    assert.ok(s.phase >= 1 && s.phase <= 5, `Sprint ${s.id} has invalid phase ${s.phase}`);
  }
});

test('phase sprint ranges cover 1-25 without gap', () => {
  const covered = new Set<number>();
  for (const p of PHASE_REGISTRY) {
    for (let i = p.sprintRange[0]; i <= p.sprintRange[1]; i++) covered.add(i);
  }
  for (let i = 1; i <= 26; i++) {
    assert.ok(covered.has(i), `Sprint ${i} not covered by any phase range`);
  }
});

test('all sprint testFiles are unique', () => {
  const files = SPRINT_REGISTRY.map(s => s.testFile);
  const unique = new Set(files);
  assert.equal(unique.size, files.length, 'Duplicate testFile found');
});

test('every sprint phase matches phase registry coverage', () => {
  for (const sprint of SPRINT_REGISTRY) {
    const phase = PHASE_REGISTRY.find(
      p => sprint.id >= p.sprintRange[0] && sprint.id <= p.sprintRange[1]
    );
    assert.ok(phase, `Sprint ${sprint.id} not covered by phase registry`);
    assert.equal(phase!.id, sprint.phase, `Sprint ${sprint.id} phase mismatch`);
  }
});

// ─── Suite 2: computeProgress — empty state ───────────────────────────────────

console.log('\ncomputeProgress — empty state (no tests)');

test('overallPercent is 0 with no completed files', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.overallPercent, 0);
});

test('completedSprints is 0 with no files', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.completedSprints, 0);
});

test('totalSprints is 27', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.totalSprints, 27);
});

test('remainingSprints is 27 with no files', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.remainingSprints, 27);
});

test('mvpComplete is false with no files', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.mvpComplete, false);
});

test('sprint 1 is active when no files completed', () => {
  const p = computeProgress(noFiles());
  const s = p.sprints.find(s => s.id === 1);
  assert.equal(s?.status, 'active');
});

test('all other sprints are upcoming when no files completed', () => {
  const p = computeProgress(noFiles());
  const others = p.sprints.filter(s => s.id !== 1);
  for (const s of others) assert.equal(s.status, 'upcoming');
});

test('phase 1 is active when no files', () => {
  const p = computeProgress(noFiles());
  assert.equal(p.phases[0].status, 'active');
});

test('phases 2-5 are locked when no files', () => {
  const p = computeProgress(noFiles());
  for (const ph of p.phases.slice(1)) {
    assert.equal(ph.status, 'locked');
  }
});

// ─── Suite 3: computeProgress — partial completion ────────────────────────────

console.log('\ncomputeProgress — partial completion');

test('5 completed files → 19% overall', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.overallPercent, Math.round(5 / 27 * 100)); // 19
});

test('12 completed files → 44% overall', () => {
  const p = computeProgress(firstN(12));
  assert.equal(p.overallPercent, Math.round(12 / 27 * 100)); // 44
});

test('sprint 6 is active when sprints 1-5 complete', () => {
  const p = computeProgress(firstN(5));
  const s6 = p.sprints.find(s => s.id === 6);
  assert.equal(s6?.status, 'active');
});

test('sprints 1-5 are complete when 5 files detected', () => {
  const p = computeProgress(firstN(5));
  for (let i = 1; i <= 5; i++) {
    const s = p.sprints.find(s => s.id === i);
    assert.equal(s?.status, 'complete', `Sprint ${i} should be complete`);
  }
});

test('phase 1 is complete when sprints 1-5 done', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.phases[0].status, 'complete');
  assert.equal(p.phases[0].progress, 100);
});

test('phase 2 is active when sprint 6 is active', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.phases[1].status, 'active');
});

test('phases 3-5 locked while phase 2 is active', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.phases[2].status, 'locked');
  assert.equal(p.phases[3].status, 'locked');
  assert.equal(p.phases[4].status, 'locked');
});

test('phase progress is correct for partial completion', () => {
  // Sprints 1-7 complete → phase 1 (1-5) = 100%, phase 2 (6-12) = 2/7 = 29%
  const p = computeProgress(firstN(7));
  assert.equal(p.phases[0].progress, 100);
  assert.equal(p.phases[1].progress, 29); // Math.round(2/7*100)
  assert.equal(p.phases[2].progress, 0);
});

test('currentSprint is sprint 6 when 5 complete', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.currentSprint?.id, 6);
});

test('currentPhase is phase 2 when phase 1 complete', () => {
  const p = computeProgress(firstN(5));
  assert.equal(p.currentPhase?.id, 2);
});

test('nextMilestone is non-null when incomplete', () => {
  const p = computeProgress(firstN(10));
  assert.ok(p.nextMilestone !== null && p.nextMilestone.length > 0);
});

test('totalEngines accumulates correctly', () => {
  const p = computeProgress(firstN(5));
  const expected = [6, 6, 5, 2, 4].reduce((a, b) => a + b, 0);
  assert.equal(p.totalEngines, expected);
});

test('totalTests accumulates correctly', () => {
  const p = computeProgress(firstN(5));
  const expected = [24, 37, 27, 72, 60].reduce((a, b) => a + b, 0);
  assert.equal(p.totalTests, expected);
});

// ─── Suite 4: computeProgress — full completion ───────────────────────────────

console.log('\ncomputeProgress — full completion');

test('overallPercent is 100 with all files', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.overallPercent, 100);
});

test('mvpComplete is true with all files', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.mvpComplete, true);
});

test('completedSprints is 27 with all files', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.completedSprints, 27);
});

test('remainingSprints is 0 with all files', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.remainingSprints, 0);
});

test('no active sprint when all complete', () => {
  const p = computeProgress(allFiles());
  const activeFound = p.sprints.some(s => s.status === 'active');
  assert.equal(activeFound, false);
});

test('all phases complete when all files detected', () => {
  const p = computeProgress(allFiles());
  for (const ph of p.phases) {
    assert.equal(ph.status, 'complete', `Phase ${ph.id} should be complete`);
    assert.equal(ph.progress, 100);
  }
});

test('currentSprint is null when MVP complete', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.currentSprint, null);
});

test('currentPhase is null when MVP complete', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.currentPhase, null);
});

test('nextMilestone is null when all done', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.nextMilestone, null);
});

test('estimatedCompletion is "Complete" when done', () => {
  const p = computeProgress(allFiles());
  assert.equal(p.estimatedCompletion, 'Complete');
});

test('all 27 sprints are "complete" status', () => {
  const p = computeProgress(allFiles());
  for (const s of p.sprints) {
    assert.equal(s.status, 'complete', `Sprint ${s.id} should be complete`);
    assert.equal(s.progress, 100);
  }
});

// ─── Suite 5: Helper functions ────────────────────────────────────────────────

console.log('\nHelper functions');

test('getSprintById returns correct sprint', () => {
  const s = getSprintById(5);
  assert.equal(s?.id, 5);
  assert.ok(s?.name.length ?? 0 > 0);
});

test('getSprintById returns undefined for invalid id', () => {
  assert.equal(getSprintById(99), undefined);
  assert.equal(getSprintById(0), undefined);
});

test('getPhaseById returns correct phase', () => {
  const p = getPhaseById(2);
  assert.equal(p?.id, 2);
  assert.ok(p?.label.length ?? 0 > 0);
});

test('getPhaseById returns undefined for invalid id', () => {
  assert.equal(getPhaseById(99), undefined);
});

test('getSprintsForPhase returns correct sprint counts per phase', () => {
  // Phase 1: 5, Phase 2: 7 (S11+S12 added), Phase 3: 5, Phase 4: 5
  const expected = [5, 7, 5, 5];
  for (let i = 1; i <= 4; i++) {
    const sprints = getSprintsForPhase(i);
    assert.equal(sprints.length, expected[i - 1], `Phase ${i} should have ${expected[i - 1]} sprints`);
  }
});

test('getSprintsForPhase returns empty for invalid phase', () => {
  assert.equal(getSprintsForPhase(99).length, 0);
});

test('phaseStatusLabel returns correct labels', () => {
  assert.equal(phaseStatusLabel('complete'), '✔ Complete');
  assert.equal(phaseStatusLabel('active'), '● Active');
  assert.equal(phaseStatusLabel('locked'), '🔒 Upcoming');
});

test('sprintStatusLabel returns correct labels', () => {
  assert.equal(sprintStatusLabel('complete'), '✔ Complete');
  assert.equal(sprintStatusLabel('active'), '● Active');
  assert.equal(sprintStatusLabel('upcoming'), '○ Upcoming');
});

test('phaseStatusColor returns a non-empty string for all statuses', () => {
  assert.ok(phaseStatusColor('complete').length > 0);
  assert.ok(phaseStatusColor('active').length > 0);
  assert.ok(phaseStatusColor('locked').length > 0);
});

// ─── Suite 6: Edge cases ──────────────────────────────────────────────────────

console.log('\nEdge cases');

test('unknown test files are ignored', () => {
  const extra = new Set(['unknown.test.ts', ...firstN(3)]);
  const p = computeProgress(extra);
  assert.equal(p.completedSprints, 3);
});

test('sprint progress is 0 for upcoming', () => {
  const p = computeProgress(noFiles());
  // Sprint 1 is active (50), rest are 0
  const upcoming = p.sprints.filter(s => s.status === 'upcoming');
  for (const s of upcoming) assert.equal(s.progress, 0);
});

test('active sprint has progress of 50', () => {
  const p = computeProgress(firstN(5));
  const active = p.sprints.find(s => s.status === 'active');
  assert.equal(active?.progress, 50);
});

test('complete sprint has progress of 100', () => {
  const p = computeProgress(firstN(5));
  const complete = p.sprints.find(s => s.status === 'complete');
  assert.equal(complete?.progress, 100);
});

test('phases output contains all 5 phases', () => {
  const p = computeProgress(firstN(10));
  assert.equal(p.phases.length, 5);
});

test('sprints output contains all 27 sprints', () => {
  const p = computeProgress(firstN(10));
  assert.equal(p.sprints.length, 27);
});

test('estimatedCompletion is non-empty for incomplete state', () => {
  const p = computeProgress(firstN(10));
  assert.ok(p.estimatedCompletion.length > 0);
  assert.notEqual(p.estimatedCompletion, 'Complete');
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Project Progress Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
