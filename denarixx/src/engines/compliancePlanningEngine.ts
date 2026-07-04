// ─── V18 Compliance Planning Engine ──────────────────────────────────────────
// Pure functions — no async, no I/O.
// All items are PLANNING/ROADMAP ONLY. Never claim certified.

import type { ComplianceItem, CertificationStandard, ComplianceStatus } from '@/types/manufacturing';

// ─── Compliance Item Registry ─────────────────────────────────────────────────

export function getComplianceRegistry(): ComplianceItem[] {
  return [
    {
      id: 'gdpr',
      name: 'GDPR (General Data Protection Regulation)',
      description: 'EU data protection law — applies to all personal data processing including vision, location, and usage data.',
      status: 'in_progress',
      isRoadmapOnly: true,
      estimatedTimeline: 'Ongoing — DPO appointment required before any real participant data',
      notes: 'V17 field trial engine enforces consent and deletion. DPIA required before live deployment.',
    },
    {
      id: 'data_protection_impact_assessment',
      name: 'Data Protection Impact Assessment (DPIA)',
      description: 'Mandatory GDPR Art. 35 assessment for high-risk processing (disability-related data, location, biometrics).',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q3 2026 — before any real-world trial with more than 10 participants',
      notes: 'Must be conducted by qualified DPO. Covers V7 GPS, V9 social awareness, V11/V17 participant data.',
      warningMessage: 'DPIA is MANDATORY before any data collection from real users. Do not skip.',
    },
    {
      id: 'eu_accessibility_act',
      name: 'EU Accessibility Act (EAA)',
      description: 'Directive 2019/882 — consumer assistive technology must meet EN 301 549 accessibility standard by June 2025.',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q4 2026 — conformance audit required before commercial launch',
      notes: 'EAA covers software UI accessibility, not just hardware. V10 PWA settings (high-contrast, reduced-motion) are a start.',
    },
    {
      id: 'ce_marking',
      name: 'CE Marking (EU Product Safety)',
      description: 'Mandatory for electronic products sold in the EU. Covers EMC Directive 2014/30/EU and RED (Radio Equipment Directive 2014/53/EU).',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q1 2027 — requires hardware prototype + accredited lab testing',
      notes: 'CE marking is NOT a quality mark — it certifies regulatory compliance. TÜV Rheinland recommended for notified body.',
      warningMessage: 'CE marking CANNOT be claimed until accredited testing is complete. Do not label product "CE" until then.',
    },
    {
      id: 'product_safety_eu',
      name: 'EU General Product Safety Regulation (GPSR)',
      description: 'Regulation EU 2023/988 — replaces old GPSD. All consumer products must be safe.',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q1 2027 — aligns with CE marking timeline',
      notes: 'Requires product traceability, incident reporting system, and market surveillance cooperation.',
    },
    {
      id: 'battery_safety_iec62368',
      name: 'Battery Safety (IEC 62368-1)',
      description: 'International safety standard for audio/video and IT equipment including battery-powered wearables.',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q2 2026 — pre-assessment possible before prototype',
      notes: 'Covers thermal runaway protection, overcharge, short-circuit. Required for LiPo in wearable glasses.',
      warningMessage: 'Do not ship any prototype with LiPo battery without IEC 62368 pre-assessment. Fire safety risk.',
    },
    {
      id: 'bluetooth_fcc',
      name: 'FCC Part 15 (Bluetooth — US Market)',
      description: 'US Federal Communications Commission certification for intentional radiators (Bluetooth).',
      status: 'not_assessed',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q2 2027 — US market only, after EU certification',
      notes: 'Not required for Germany pilot. Needed if Denarixx Vision AI ever enters US market.',
    },
    {
      id: 'bluetooth_etsi',
      name: 'ETSI EN 300 328 (Bluetooth — EU)',
      description: 'EU radio equipment standard for 2.4GHz wireless devices. Required for CE marking RED compliance.',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q1 2027 — part of CE marking process',
      notes: 'BT LE 5.3 module must be pre-certified or tested by accredited lab. Using pre-certified module reduces risk.',
    },
    {
      id: 'medical_device_boundary',
      name: 'Medical Device Boundary Assessment (MDR EU 2017/745)',
      description: 'Determination of whether Denarixx Vision AI qualifies as a medical device under EU MDR.',
      status: 'planning',
      isRoadmapOnly: true,
      estimatedTimeline: 'Q2 2026 — legal opinion required before first public trial',
      notes: 'Assistive technology for navigation does NOT automatically qualify as a medical device, but the boundary must be formally assessed.',
      warningMessage: 'DO NOT claim Denarixx Vision AI is a medical device. DO NOT claim it replaces medical care. A qualified regulatory consultant must assess the MDR boundary before any public launch.',
    },
  ];
}

// ─── Compliance Score ─────────────────────────────────────────────────────────

export function calculateComplianceScore(items: ComplianceItem[]): number {
  if (items.length === 0) return 0;
  const statusScores: Record<ComplianceStatus, number> = {
    not_assessed: 0,
    planning: 20,
    in_progress: 50,
    verified: 85,
    certified: 100,
  };
  const total = items.reduce((sum, item) => sum + statusScores[item.status], 0);
  return Math.round(total / items.length);
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

export function getComplianceWarnings(items: ComplianceItem[]): string[] {
  return items
    .filter(item => item.warningMessage)
    .map(item => `[${item.name}] ${item.warningMessage!}`);
}

// ─── High Priority Items ──────────────────────────────────────────────────────

export function getHighPriorityComplianceItems(items: ComplianceItem[]): ComplianceItem[] {
  const highPriority: CertificationStandard[] = [
    'gdpr',
    'data_protection_impact_assessment',
    'battery_safety_iec62368',
    'medical_device_boundary',
  ];
  return items.filter(item => highPriority.includes(item.id));
}

// ─── Status Formatting ────────────────────────────────────────────────────────

export function formatComplianceStatus(status: ComplianceStatus): string {
  const map: Record<ComplianceStatus, string> = {
    not_assessed: '⬜ Not assessed',
    planning: '🟡 Planning',
    in_progress: '🟠 In progress',
    verified: '🔵 Verified (internal)',
    certified: '🟢 Certified',
  };
  return map[status];
}

export function getComplianceItemById(items: ComplianceItem[], id: CertificationStandard): ComplianceItem | undefined {
  return items.find(item => item.id === id);
}
