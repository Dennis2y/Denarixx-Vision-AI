// ─── V18 Certification Roadmap Engine ────────────────────────────────────────
// Pure functions — no async, no I/O.
// All milestones are PLANNING PLACEHOLDERS ONLY. Never claim certified.

import type {
  CertificationMilestone,
  CertificationPhase,
  CertificationStandard,
} from '@/types/manufacturing';

// ─── Milestone Registry ───────────────────────────────────────────────────────

export function getCertificationMilestones(): CertificationMilestone[] {
  return [
    // Pre-prototype phase (now → Q2 2026)
    {
      milestoneId: 'CERT-001',
      title: 'GDPR DPO Appointment',
      standard: 'gdpr',
      phase: 'pre_prototype',
      estimatedQuarter: 'Q3 2026',
      isPlaceholder: true,
      prerequisites: [],
      estimatedCost: '€3,000–8,000/year DPO retainer',
      notes: 'Required before any real participant data collected. Appoint a qualified DPO (external or in-house).',
    },
    {
      milestoneId: 'CERT-002',
      title: 'Data Protection Impact Assessment (DPIA)',
      standard: 'data_protection_impact_assessment',
      phase: 'pre_prototype',
      estimatedQuarter: 'Q3 2026',
      isPlaceholder: true,
      prerequisites: ['CERT-001'],
      estimatedCost: '€5,000–15,000 consulting',
      notes: 'Mandatory GDPR Art. 35. Must cover: V7 GPS, V9 social awareness, V11/V17 participant data, disability status.',
    },
    {
      milestoneId: 'CERT-003',
      title: 'Medical Device Boundary Assessment',
      standard: 'medical_device_boundary',
      phase: 'pre_prototype',
      estimatedQuarter: 'Q3 2026',
      isPlaceholder: true,
      prerequisites: [],
      estimatedCost: '€8,000–20,000 regulatory consultant',
      notes: 'Formal legal/regulatory opinion on whether Denarixx Vision AI falls under EU MDR 2017/745. Must be completed BEFORE any public launch. Recommended: BSI Group, Qserve, or Qunique.',
    },
    {
      milestoneId: 'CERT-004',
      title: 'Battery Safety Pre-Assessment (IEC 62368)',
      standard: 'battery_safety_iec62368',
      phase: 'pre_prototype',
      estimatedQuarter: 'Q2 2026',
      isPlaceholder: true,
      prerequisites: [],
      estimatedCost: '€3,000–8,000 lab assessment',
      notes: 'Pre-assessment possible before hardware prototype. Full certification requires physical samples.',
    },
    // Prototype phase (Q3–Q4 2026)
    {
      milestoneId: 'CERT-005',
      title: 'EU Accessibility Act Conformance Audit',
      standard: 'eu_accessibility_act',
      phase: 'prototype',
      estimatedQuarter: 'Q4 2026',
      isPlaceholder: true,
      prerequisites: ['CERT-002'],
      estimatedCost: '€10,000–25,000',
      notes: 'EN 301 549 conformance. Software UI accessibility + hardware usability for blind/low-vision users.',
    },
    {
      milestoneId: 'CERT-006',
      title: 'Battery Safety Full Certification (IEC 62368)',
      standard: 'battery_safety_iec62368',
      phase: 'prototype',
      estimatedQuarter: 'Q4 2026',
      isPlaceholder: true,
      prerequisites: ['CERT-004', 'Physical prototype'],
      estimatedCost: '€15,000–40,000',
      notes: 'Requires physical prototype with LiPo battery. Full thermal + electrical safety testing.',
    },
    {
      milestoneId: 'CERT-007',
      title: 'ETSI EN 300 328 (Bluetooth Radio)',
      standard: 'bluetooth_etsi',
      phase: 'prototype',
      estimatedQuarter: 'Q4 2026',
      isPlaceholder: true,
      prerequisites: ['Bluetooth module selected', 'PCB prototype'],
      estimatedCost: '€5,000–15,000 (reduced if pre-certified module used)',
      notes: 'Use a pre-certified Bluetooth module (e.g. Nordic nRF5340, Espressif ESP32-C6) to reduce cost and timeline.',
    },
    // Pre-production phase (Q1 2027)
    {
      milestoneId: 'CERT-008',
      title: 'CE Marking (EMC + RED Directives)',
      standard: 'ce_marking',
      phase: 'pre_production',
      estimatedQuarter: 'Q1 2027',
      isPlaceholder: true,
      prerequisites: ['CERT-006', 'CERT-007', 'Physical pre-production unit'],
      estimatedCost: '€20,000–60,000',
      notes: 'CE marking is required for EU market. Covers EMC Directive 2014/30/EU and Radio Equipment Directive 2014/53/EU. Notified body: TÜV Rheinland (Germany).',
    },
    {
      milestoneId: 'CERT-009',
      title: 'EU General Product Safety (GPSR)',
      standard: 'product_safety_eu',
      phase: 'pre_production',
      estimatedQuarter: 'Q1 2027',
      isPlaceholder: true,
      prerequisites: ['CERT-008'],
      estimatedCost: 'Included in CE marking process',
      notes: 'Regulation EU 2023/988. Traceability, instructions, incident reporting system required.',
    },
    // Production phase (Q2 2027+)
    {
      milestoneId: 'CERT-010',
      title: 'FCC Part 15 (US Market — if applicable)',
      standard: 'bluetooth_fcc',
      phase: 'production',
      estimatedQuarter: 'Q3 2027',
      isPlaceholder: true,
      prerequisites: ['CERT-008', 'US market entry decision'],
      estimatedCost: '€10,000–25,000',
      notes: 'Only required for US market. Not needed for Germany pilot.',
    },
  ];
}

// ─── Roadmap Filtering ────────────────────────────────────────────────────────

export function getMilestonesByPhase(milestones: CertificationMilestone[], phase: CertificationPhase): CertificationMilestone[] {
  return milestones.filter(m => m.phase === phase);
}

export function getMilestonesByStandard(milestones: CertificationMilestone[], standard: CertificationStandard): CertificationMilestone[] {
  return milestones.filter(m => m.standard === standard);
}

export function getImmediateMilestones(milestones: CertificationMilestone[]): CertificationMilestone[] {
  return milestones.filter(m => m.phase === 'pre_prototype');
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

export function estimateTotalCertificationBudget(): { low: string; high: string } {
  // Sum of all milestone ranges (rough estimates)
  return {
    low: '€79,000',
    high: '€216,000',
  };
}

export function getCertificationTimeline(): { start: string; firstMilestone: string; ceMarking: string; fullProduction: string } {
  return {
    start: 'Q3 2026 (DPIA + DPO + Medical Device Boundary)',
    firstMilestone: 'Q3 2026 (GDPR DPO + DPIA)',
    ceMarking: 'Q1 2027 (CE marking with pre-production unit)',
    fullProduction: 'Q3 2027 (all EU certifications + optional FCC)',
  };
}

// ─── Phase Labels ─────────────────────────────────────────────────────────────

export function formatCertificationPhase(phase: CertificationPhase): string {
  const map: Record<CertificationPhase, string> = {
    pre_prototype: 'Pre-Prototype',
    prototype: 'Prototype',
    pre_production: 'Pre-Production',
    production: 'Production',
  };
  return map[phase];
}

// ─── Prerequisite Check ───────────────────────────────────────────────────────

export function getMilestonesWithNoPrerequisites(milestones: CertificationMilestone[]): CertificationMilestone[] {
  return milestones.filter(m => m.prerequisites.length === 0);
}

export function getMilestoneById(milestones: CertificationMilestone[], id: string): CertificationMilestone | undefined {
  return milestones.find(m => m.milestoneId === id);
}

// ─── Roadmap Summary ──────────────────────────────────────────────────────────

export function buildRoadmapSummary(milestones: CertificationMilestone[]): {
  totalMilestones: number;
  byPhase: Record<CertificationPhase, number>;
  estimatedBudget: { low: string; high: string };
  timeline: ReturnType<typeof getCertificationTimeline>;
} {
  const phases: CertificationPhase[] = ['pre_prototype', 'prototype', 'pre_production', 'production'];
  const byPhase = {} as Record<CertificationPhase, number>;
  phases.forEach(p => { byPhase[p] = getMilestonesByPhase(milestones, p).length; });

  return {
    totalMilestones: milestones.length,
    byPhase,
    estimatedBudget: estimateTotalCertificationBudget(),
    timeline: getCertificationTimeline(),
  };
}
