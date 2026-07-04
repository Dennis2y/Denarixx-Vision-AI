// V18 Manufacturing Readiness & Product Certification — test suite
// Run: npx tsx tests/manufacturingReadiness.test.ts

import {
  getHardwareComponentRegistry,
  readinessLevelToScore,
  calculateHardwareReadiness,
  calculateReadinessScore,
  getReadinessGrade,
  formatReadinessGrade,
  getCriticalPathComponents,
  getBlockedComponents,
  getMissingSpecComponents,
  getComponentsByReadiness,
  getManufacturingOptions,
  buildRecommendedNextActions,
  readinessLevelIndex,
  isReadinessAtLeast,
} from '../src/engines/manufacturingReadinessEngine';

import {
  getComplianceRegistry,
  calculateComplianceScore,
  getComplianceWarnings,
  getHighPriorityComplianceItems,
  formatComplianceStatus,
  getComplianceItemById,
} from '../src/engines/compliancePlanningEngine';

import {
  getProductRiskRegistry,
  getRisksByLevel,
  getRisksByCategory,
  getOpenRisks,
  getMitigatedRisks,
  getCriticalOpenRisks,
  calculateRiskScore,
  getRiskSummary,
  formatRiskLevel,
  formatRiskStatus,
} from '../src/engines/productRiskEngine';

import {
  getCertificationMilestones,
  getMilestonesByPhase,
  getMilestonesByStandard,
  getImmediateMilestones,
  estimateTotalCertificationBudget,
  getCertificationTimeline,
  formatCertificationPhase,
  getMilestonesWithNoPrerequisites,
  getMilestoneById,
  buildRoadmapSummary,
} from '../src/engines/certificationRoadmapEngine';

import {
  MANUFACTURING_DISCLAIMER,
  ALL_HARDWARE_COMPONENTS,
  READINESS_LEVELS_ORDERED,
} from '../src/types/manufacturing';

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
    toBeNull: () => { if (actual !== null) fail(`Expected null`); },
    not: {
      toBe: (e: unknown) => { if (actual === e) fail(`Expected NOT ${JSON.stringify(e)}`); },
      toBeNull: () => { if (actual === null) fail('Expected not null'); },
    },
    toBeGreaterThan: (n: number) => { if ((actual as number) <= n) fail(`Expected > ${n}, got ${actual}`); },
    toBeGreaterThanOrEqual: (n: number) => { if ((actual as number) < n) fail(`Expected >= ${n}, got ${actual}`); },
    toBeLessThan: (n: number) => { if ((actual as number) >= n) fail(`Expected < ${n}, got ${actual}`); },
    toBeLessThanOrEqual: (n: number) => { if ((actual as number) > n) fail(`Expected <= ${n}, got ${actual}`); },
    toContain: (s: string) => { if (!(actual as string).includes(s)) fail(`Expected "${actual}" to contain "${s}"`); },
    toHaveLength: (n: number) => { if ((actual as unknown[]).length !== n) fail(`Expected length ${n}, got ${(actual as unknown[]).length}`); },
  };
}

// ─── MANUFACTURING READINESS ENGINE ───────────────────────────────────────────
describe('getHardwareComponentRegistry', () => {
  test('returns 11 components', () => expect(getHardwareComponentRegistry()).toHaveLength(11));
  test('all components have names', () => getHardwareComponentRegistry().forEach(c => expect(c.name.length).toBeGreaterThan(0)));
  test('all have targetSpec', () => getHardwareComponentRegistry().forEach(c => expect(c.targetSpec.length).toBeGreaterThan(0)));
  test('all have estimatedUnitCost', () => getHardwareComponentRegistry().forEach(c => expect(c.estimatedUnitCost.length).toBeGreaterThan(0)));
  test('camera_module is critical path', () => {
    const cam = getHardwareComponentRegistry().find(c => c.component === 'camera_module');
    expect(cam?.criticalPath).toBe(true);
  });
  test('battery is critical path', () => {
    const bat = getHardwareComponentRegistry().find(c => c.component === 'battery');
    expect(bat?.criticalPath).toBe(true);
  });
  test('wifi is not critical path', () => {
    const wifi = getHardwareComponentRegistry().find(c => c.component === 'wifi');
    expect(wifi?.criticalPath).toBe(false);
  });
  test('compute_module has blockers', () => {
    const comp = getHardwareComponentRegistry().find(c => c.component === 'compute_module');
    expect(comp!.blockers.length).toBeGreaterThan(0);
  });
  test('wifi has no currentSpec (not started)', () => {
    const wifi = getHardwareComponentRegistry().find(c => c.component === 'wifi');
    expect(wifi?.currentSpec).toBeNull();
  });
});

describe('readinessLevelToScore', () => {
  test('not_started → 0', () => expect(readinessLevelToScore('not_started')).toBe(0));
  test('planning → 25', () => expect(readinessLevelToScore('planning')).toBe(25));
  test('specification → 50', () => expect(readinessLevelToScore('specification')).toBe(50));
  test('prototype → 75', () => expect(readinessLevelToScore('prototype')).toBe(75));
  test('production_ready → 100', () => expect(readinessLevelToScore('production_ready')).toBe(100));
});

describe('calculateHardwareReadiness', () => {
  test('empty → 0', () => expect(calculateHardwareReadiness([])).toBe(0));
  test('all planning → 25', () => {
    const specs = getHardwareComponentRegistry().map(s => ({ ...s, readinessLevel: 'planning' as const }));
    expect(calculateHardwareReadiness(specs)).toBe(25);
  });
  test('all not_started → 0', () => {
    const specs = getHardwareComponentRegistry().map(s => ({ ...s, readinessLevel: 'not_started' as const }));
    expect(calculateHardwareReadiness(specs)).toBe(0);
  });
  test('registry gives 0-100', () => {
    const score = calculateHardwareReadiness(getHardwareComponentRegistry());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateReadinessScore', () => {
  test('returns all 5 dimensions', () => {
    const s = calculateReadinessScore(getHardwareComponentRegistry(), 50, 50, 50);
    expect(typeof s.overall).toBe('number');
    expect(typeof s.hardware).toBe('number');
    expect(typeof s.software).toBe('number');
    expect(typeof s.compliance).toBe('number');
    expect(typeof s.documentation).toBe('number');
  });
  test('all 100 → overall 100', () => {
    const specs = getHardwareComponentRegistry().map(s => ({ ...s, readinessLevel: 'production_ready' as const }));
    const score = calculateReadinessScore(specs, 100, 100, 100);
    expect(score.overall).toBe(100);
  });
  test('all 0 → overall 0', () => {
    const specs = getHardwareComponentRegistry().map(s => ({ ...s, readinessLevel: 'not_started' as const }));
    const score = calculateReadinessScore(specs, 0, 0, 0);
    expect(score.overall).toBe(0);
  });
});

describe('getReadinessGrade', () => {
  test('100 → ready', () => expect(getReadinessGrade(100)).toBe('ready'));
  test('0 → not_ready', () => expect(getReadinessGrade(0)).toBe('not_ready'));
  test('20 → early_planning', () => expect(getReadinessGrade(20)).toBe('early_planning'));
  test('45 → mid_planning', () => expect(getReadinessGrade(45)).toBe('mid_planning'));
  test('65 → late_planning', () => expect(getReadinessGrade(65)).toBe('late_planning'));
});

describe('formatReadinessGrade', () => {
  test('contains score', () => expect(formatReadinessGrade(42)).toContain('42'));
  test('contains grade label', () => expect(formatReadinessGrade(100)).toContain('Ready'));
});

describe('getCriticalPathComponents', () => {
  test('returns only critical components', () => {
    const crit = getCriticalPathComponents(getHardwareComponentRegistry());
    expect(crit.every(c => c.criticalPath)).toBe(true);
  });
  test('has at least 4 critical components', () => {
    expect(getCriticalPathComponents(getHardwareComponentRegistry()).length).toBeGreaterThanOrEqual(4);
  });
});

describe('getBlockedComponents', () => {
  test('returns components with blockers', () => {
    const blocked = getBlockedComponents(getHardwareComponentRegistry());
    expect(blocked.every(c => c.blockers.length > 0)).toBe(true);
  });
  test('has at least 1 blocked component', () => {
    expect(getBlockedComponents(getHardwareComponentRegistry()).length).toBeGreaterThan(0);
  });
});

describe('getMissingSpecComponents', () => {
  test('returns only null currentSpec', () => {
    const missing = getMissingSpecComponents(getHardwareComponentRegistry());
    expect(missing.every(c => c.currentSpec === null)).toBe(true);
  });
  test('wifi is in missing specs', () => {
    const missing = getMissingSpecComponents(getHardwareComponentRegistry());
    expect(missing.some(c => c.component === 'wifi')).toBe(true);
  });
});

describe('getComponentsByReadiness', () => {
  test('returns matching level', () => {
    const specs = getHardwareComponentRegistry().filter(s => s.readinessLevel === 'planning');
    const result = getComponentsByReadiness(getHardwareComponentRegistry(), 'planning');
    expect(result.length).toBe(specs.length);
  });
});

describe('getManufacturingOptions', () => {
  test('returns 3 options', () => expect(getManufacturingOptions()).toHaveLength(3));
  test('includes china, europe, hybrid', () => {
    const regions = getManufacturingOptions().map(o => o.region);
    expect(regions).toContain('china');
    expect(regions).toContain('europe');
    expect(regions).toContain('hybrid');
  });
  test('all have advantages', () => getManufacturingOptions().forEach(o => expect(o.advantages.length).toBeGreaterThan(0)));
  test('all have disadvantages', () => getManufacturingOptions().forEach(o => expect(o.disadvantages.length).toBeGreaterThan(0)));
  test('hybrid is recommended for Phase 18→19', () => {
    const hybrid = getManufacturingOptions().find(o => o.region === 'hybrid');
    expect(hybrid?.recommendedFor.toLowerCase()).toContain('18');
  });
});

describe('buildRecommendedNextActions', () => {
  test('returns non-empty array', () => expect(buildRecommendedNextActions(getHardwareComponentRegistry()).length).toBeGreaterThan(0));
  test('mentions critical components', () => {
    const actions = buildRecommendedNextActions(getHardwareComponentRegistry());
    expect(actions.some(a => a.toLowerCase().includes('critical'))).toBe(true);
  });
  test('mentions IEC 62368', () => {
    const actions = buildRecommendedNextActions(getHardwareComponentRegistry());
    expect(actions.some(a => a.includes('IEC'))).toBe(true);
  });
  test('returns array', () => expect(Array.isArray(buildRecommendedNextActions(getHardwareComponentRegistry()))).toBe(true));
});

describe('readinessLevelIndex', () => {
  test('not_started is index 0', () => expect(readinessLevelIndex('not_started')).toBe(0));
  test('production_ready is highest index', () => {
    expect(readinessLevelIndex('production_ready')).toBe(READINESS_LEVELS_ORDERED.length - 1);
  });
  test('planning < specification', () => expect(readinessLevelIndex('planning')).toBeLessThan(readinessLevelIndex('specification')));
});

describe('isReadinessAtLeast', () => {
  test('production_ready >= specification', () => expect(isReadinessAtLeast('production_ready', 'specification')).toBe(true));
  test('not_started NOT >= planning', () => expect(isReadinessAtLeast('not_started', 'planning')).toBe(false));
  test('same level → true', () => expect(isReadinessAtLeast('planning', 'planning')).toBe(true));
});

// ─── COMPLIANCE PLANNING ENGINE ───────────────────────────────────────────────
describe('getComplianceRegistry', () => {
  test('returns 9 items', () => expect(getComplianceRegistry()).toHaveLength(9));
  test('all are roadmap only', () => getComplianceRegistry().forEach(item => expect(item.isRoadmapOnly).toBe(true)));
  test('all have names', () => getComplianceRegistry().forEach(item => expect(item.name.length).toBeGreaterThan(0)));
  test('all have timelines', () => getComplianceRegistry().forEach(item => expect(item.estimatedTimeline.length).toBeGreaterThan(0)));
  test('includes GDPR', () => expect(getComplianceRegistry().some(i => i.id === 'gdpr')).toBe(true));
  test('includes CE marking', () => expect(getComplianceRegistry().some(i => i.id === 'ce_marking')).toBe(true));
  test('includes medical device boundary', () => expect(getComplianceRegistry().some(i => i.id === 'medical_device_boundary')).toBe(true));
  test('includes DPIA', () => expect(getComplianceRegistry().some(i => i.id === 'data_protection_impact_assessment')).toBe(true));
  test('CE marking has warning', () => {
    const ce = getComplianceRegistry().find(i => i.id === 'ce_marking');
    expect(ce?.warningMessage?.length).toBeGreaterThan(0);
  });
  test('medical device boundary has warning', () => {
    const mdb = getComplianceRegistry().find(i => i.id === 'medical_device_boundary');
    expect(mdb?.warningMessage?.length).toBeGreaterThan(0);
  });
});

describe('calculateComplianceScore', () => {
  test('empty → 0', () => expect(calculateComplianceScore([])).toBe(0));
  test('all not_assessed → 0', () => {
    const items = getComplianceRegistry().map(i => ({ ...i, status: 'not_assessed' as const }));
    expect(calculateComplianceScore(items)).toBe(0);
  });
  test('all in_progress → 50', () => {
    const items = getComplianceRegistry().map(i => ({ ...i, status: 'in_progress' as const }));
    expect(calculateComplianceScore(items)).toBe(50);
  });
  test('all certified → 100', () => {
    const items = getComplianceRegistry().map(i => ({ ...i, status: 'certified' as const }));
    expect(calculateComplianceScore(items)).toBe(100);
  });
  test('returns 0-100', () => {
    const score = calculateComplianceScore(getComplianceRegistry());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getComplianceWarnings', () => {
  test('returns array of warnings', () => expect(Array.isArray(getComplianceWarnings(getComplianceRegistry()))).toBe(true));
  test('has at least 1 warning', () => expect(getComplianceWarnings(getComplianceRegistry()).length).toBeGreaterThan(0));
  test('CE marking generates warning', () => {
    const warnings = getComplianceWarnings(getComplianceRegistry());
    expect(warnings.some(w => w.includes('CE marking') || w.includes('CE Marking'))).toBe(true);
  });
  test('medical device boundary warning present', () => {
    const warnings = getComplianceWarnings(getComplianceRegistry());
    expect(warnings.some(w => w.toLowerCase().includes('medical'))).toBe(true);
  });
  test('empty items → empty warnings', () => expect(getComplianceWarnings([])).toHaveLength(0));
});

describe('getHighPriorityComplianceItems', () => {
  test('returns subset of compliance items', () => {
    const priority = getHighPriorityComplianceItems(getComplianceRegistry());
    expect(priority.length).toBeGreaterThan(0);
    expect(priority.length).toBeLessThan(getComplianceRegistry().length);
  });
  test('includes GDPR', () => {
    const priority = getHighPriorityComplianceItems(getComplianceRegistry());
    expect(priority.some(i => i.id === 'gdpr')).toBe(true);
  });
  test('includes battery safety', () => {
    const priority = getHighPriorityComplianceItems(getComplianceRegistry());
    expect(priority.some(i => i.id === 'battery_safety_iec62368')).toBe(true);
  });
});

describe('formatComplianceStatus', () => {
  test('not_assessed format', () => expect(formatComplianceStatus('not_assessed')).toContain('Not assessed'));
  test('planning format', () => expect(formatComplianceStatus('planning')).toContain('Planning'));
  test('certified format', () => expect(formatComplianceStatus('certified')).toContain('Certified'));
});

describe('getComplianceItemById', () => {
  test('returns item by id', () => expect(getComplianceItemById(getComplianceRegistry(), 'gdpr')?.id).toBe('gdpr'));
  test('returns undefined for unknown id', () => expect(getComplianceItemById(getComplianceRegistry(), 'unknown_standard' as never)).toBe(undefined));
});

// ─── PRODUCT RISK ENGINE ──────────────────────────────────────────────────────
describe('getProductRiskRegistry', () => {
  test('returns at least 10 risks', () => expect(getProductRiskRegistry().length).toBeGreaterThanOrEqual(10));
  test('all have riskId', () => getProductRiskRegistry().forEach(r => expect(r.riskId.length).toBeGreaterThan(0)));
  test('all have mitigation plans', () => getProductRiskRegistry().forEach(r => expect(r.mitigationPlan.length).toBeGreaterThan(0)));
  test('includes critical risks', () => expect(getRisksByLevel(getProductRiskRegistry(), 'critical').length).toBeGreaterThan(0));
  test('includes hardware risks', () => expect(getRisksByCategory(getProductRiskRegistry(), 'hardware').length).toBeGreaterThan(0));
  test('includes privacy risks', () => expect(getRisksByCategory(getProductRiskRegistry(), 'privacy').length).toBeGreaterThan(0));
  test('includes regulatory risks', () => expect(getRisksByCategory(getProductRiskRegistry(), 'regulatory').length).toBeGreaterThan(0));
  test('has mitigated risks', () => expect(getMitigatedRisks(getProductRiskRegistry()).length).toBeGreaterThan(0));
  test('REG-001 is critical and open', () => {
    const r = getProductRiskRegistry().find(r => r.riskId === 'REG-001');
    expect(r?.level).toBe('critical');
    expect(r?.status).toBe('open');
  });
  test('SAF-001 is mitigated', () => {
    const r = getProductRiskRegistry().find(r => r.riskId === 'SAF-001');
    expect(r?.status).toBe('mitigated');
  });
});

describe('getRisksByLevel', () => {
  test('critical risks all have level critical', () => {
    getRisksByLevel(getProductRiskRegistry(), 'critical').forEach(r => expect(r.level).toBe('critical'));
  });
  test('high risks all have level high', () => {
    getRisksByLevel(getProductRiskRegistry(), 'high').forEach(r => expect(r.level).toBe('high'));
  });
  test('empty level → empty array', () => {
    const registry = getProductRiskRegistry().map(r => ({ ...r, level: 'high' as const }));
    expect(getRisksByLevel(registry, 'low')).toHaveLength(0);
  });
});

describe('getCriticalOpenRisks', () => {
  test('all are critical and open', () => {
    const risks = getCriticalOpenRisks(getProductRiskRegistry());
    expect(risks.every(r => r.level === 'critical' && r.status === 'open')).toBe(true);
  });
  test('has at least 1 critical open risk', () => {
    expect(getCriticalOpenRisks(getProductRiskRegistry()).length).toBeGreaterThan(0);
  });
});

describe('calculateRiskScore', () => {
  test('empty → 0', () => expect(calculateRiskScore([])).toBe(0));
  test('all mitigated → low score', () => {
    const risks = getProductRiskRegistry().map(r => ({ ...r, status: 'mitigated' as const }));
    expect(calculateRiskScore(risks)).toBeLessThan(30);
  });
  test('all critical open → high score', () => {
    const risks = getProductRiskRegistry().map(r => ({ ...r, level: 'critical' as const, status: 'open' as const }));
    expect(calculateRiskScore(risks)).toBeGreaterThan(50);
  });
  test('returns 0-100', () => {
    const score = calculateRiskScore(getProductRiskRegistry());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getRiskSummary', () => {
  test('total matches registry length', () => {
    const summary = getRiskSummary(getProductRiskRegistry());
    expect(summary.total).toBe(getProductRiskRegistry().length);
  });
  test('critical + high + medium + low = total', () => {
    const s = getRiskSummary(getProductRiskRegistry());
    expect(s.critical + s.high + s.medium + s.low).toBe(s.total);
  });
  test('open + mitigated + accepted = total', () => {
    const s = getRiskSummary(getProductRiskRegistry());
    expect(s.open + s.mitigated + s.accepted).toBe(s.total);
  });
});

describe('formatRiskLevel', () => {
  test('critical contains Critical', () => expect(formatRiskLevel('critical')).toContain('Critical'));
  test('low contains Low', () => expect(formatRiskLevel('low')).toContain('Low'));
  test('all levels format without error', () => {
    (['critical', 'high', 'medium', 'low'] as const).forEach(l => expect(formatRiskLevel(l).length).toBeGreaterThan(0));
  });
});

describe('formatRiskStatus', () => {
  test('open contains Open', () => expect(formatRiskStatus('open')).toContain('Open'));
  test('mitigated contains Mitigated', () => expect(formatRiskStatus('mitigated')).toContain('Mitigated'));
  test('accepted contains Accepted', () => expect(formatRiskStatus('accepted')).toContain('Accepted'));
});

// ─── CERTIFICATION ROADMAP ENGINE ─────────────────────────────────────────────
describe('getCertificationMilestones', () => {
  test('returns at least 8 milestones', () => expect(getCertificationMilestones().length).toBeGreaterThanOrEqual(8));
  test('all are placeholders', () => getCertificationMilestones().forEach(m => expect(m.isPlaceholder).toBe(true)));
  test('all have milestoneId', () => getCertificationMilestones().forEach(m => expect(m.milestoneId.length).toBeGreaterThan(0)));
  test('all have estimatedQuarter', () => getCertificationMilestones().forEach(m => expect(m.estimatedQuarter.length).toBeGreaterThan(0)));
  test('all have estimatedCost', () => getCertificationMilestones().forEach(m => expect(m.estimatedCost.length).toBeGreaterThan(0)));
  test('includes CE marking milestone', () => {
    expect(getCertificationMilestones().some(m => m.standard === 'ce_marking')).toBe(true);
  });
  test('includes GDPR milestone', () => {
    expect(getCertificationMilestones().some(m => m.standard === 'gdpr')).toBe(true);
  });
  test('includes battery safety', () => {
    expect(getCertificationMilestones().some(m => m.standard === 'battery_safety_iec62368')).toBe(true);
  });
});

describe('getMilestonesByPhase', () => {
  test('pre_prototype has milestones', () => expect(getMilestonesByPhase(getCertificationMilestones(), 'pre_prototype').length).toBeGreaterThan(0));
  test('prototype has milestones', () => expect(getMilestonesByPhase(getCertificationMilestones(), 'prototype').length).toBeGreaterThan(0));
  test('pre_production has milestones', () => expect(getMilestonesByPhase(getCertificationMilestones(), 'pre_production').length).toBeGreaterThan(0));
  test('all milestones belong to a phase', () => {
    const total = ['pre_prototype', 'prototype', 'pre_production', 'production'].reduce(
      (sum, p) => sum + getMilestonesByPhase(getCertificationMilestones(), p as never).length, 0
    );
    expect(total).toBe(getCertificationMilestones().length);
  });
});

describe('getImmediateMilestones', () => {
  test('returns pre_prototype milestones', () => {
    const immediate = getImmediateMilestones(getCertificationMilestones());
    expect(immediate.every(m => m.phase === 'pre_prototype')).toBe(true);
  });
  test('has at least 2 immediate milestones', () => {
    expect(getImmediateMilestones(getCertificationMilestones()).length).toBeGreaterThanOrEqual(2);
  });
});

describe('getMilestonesWithNoPrerequisites', () => {
  test('all have empty prerequisites', () => {
    getMilestonesWithNoPrerequisites(getCertificationMilestones()).forEach(m => {
      expect(m.prerequisites).toHaveLength(0);
    });
  });
  test('returns at least 1', () => {
    expect(getMilestonesWithNoPrerequisites(getCertificationMilestones()).length).toBeGreaterThan(0);
  });
});

describe('getMilestoneById', () => {
  test('returns CERT-001', () => expect(getMilestoneById(getCertificationMilestones(), 'CERT-001')?.milestoneId).toBe('CERT-001'));
  test('returns undefined for unknown', () => expect(getMilestoneById(getCertificationMilestones(), 'CERT-999')).toBe(undefined));
});

describe('estimateTotalCertificationBudget', () => {
  test('returns low and high estimates', () => {
    const budget = estimateTotalCertificationBudget();
    expect(budget.low.length).toBeGreaterThan(0);
    expect(budget.high.length).toBeGreaterThan(0);
  });
  test('contains € symbol', () => {
    const budget = estimateTotalCertificationBudget();
    expect(budget.low).toContain('€');
    expect(budget.high).toContain('€');
  });
});

describe('getCertificationTimeline', () => {
  test('returns timeline object', () => {
    const t = getCertificationTimeline();
    expect(t.start.length).toBeGreaterThan(0);
    expect(t.ceMarking.length).toBeGreaterThan(0);
  });
  test('CE marking is in 2027', () => {
    expect(getCertificationTimeline().ceMarking).toContain('2027');
  });
});

describe('formatCertificationPhase', () => {
  test('pre_prototype → Pre-Prototype', () => expect(formatCertificationPhase('pre_prototype')).toBe('Pre-Prototype'));
  test('production → Production', () => expect(formatCertificationPhase('production')).toBe('Production'));
  test('all phases format', () => {
    (['pre_prototype', 'prototype', 'pre_production', 'production'] as const).forEach(p => {
      expect(formatCertificationPhase(p).length).toBeGreaterThan(0);
    });
  });
});

describe('buildRoadmapSummary', () => {
  test('totalMilestones matches registry', () => {
    const milestones = getCertificationMilestones();
    expect(buildRoadmapSummary(milestones).totalMilestones).toBe(milestones.length);
  });
  test('byPhase sums to total', () => {
    const milestones = getCertificationMilestones();
    const summary = buildRoadmapSummary(milestones);
    const sum = Object.values(summary.byPhase).reduce((a, b) => a + b, 0);
    expect(sum).toBe(summary.totalMilestones);
  });
  test('has budget estimate', () => {
    expect(buildRoadmapSummary(getCertificationMilestones()).estimatedBudget.low.length).toBeGreaterThan(0);
  });
  test('has timeline', () => {
    expect(buildRoadmapSummary(getCertificationMilestones()).timeline.ceMarking.length).toBeGreaterThan(0);
  });
});

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
describe('MANUFACTURING_DISCLAIMER', () => {
  test('contains "not CE marked"', () => expect(MANUFACTURING_DISCLAIMER).toContain('not CE marked'));
  test('contains "not a medical device"', () => expect(MANUFACTURING_DISCLAIMER).toContain('not a medical device'));
  test('contains "planning purposes only"', () => expect(MANUFACTURING_DISCLAIMER).toContain('planning purposes only'));
});

describe('ALL_HARDWARE_COMPONENTS', () => {
  test('has 11 components', () => expect(ALL_HARDWARE_COMPONENTS).toHaveLength(11));
  test('includes camera_module', () => expect(ALL_HARDWARE_COMPONENTS).toContain('camera_module'));
  test('includes battery', () => expect(ALL_HARDWARE_COMPONENTS).toContain('battery'));
});

describe('READINESS_LEVELS_ORDERED', () => {
  test('has 5 levels', () => expect(READINESS_LEVELS_ORDERED).toHaveLength(5));
  test('starts with not_started', () => expect(READINESS_LEVELS_ORDERED[0]).toBe('not_started'));
  test('ends with production_ready', () => expect(READINESS_LEVELS_ORDERED[4]).toBe('production_ready'));
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
