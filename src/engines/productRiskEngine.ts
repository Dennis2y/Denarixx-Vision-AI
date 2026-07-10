// ─── V18 Product Risk Engine ──────────────────────────────────────────────────
// Pure functions — no async, no I/O.
// Risk registry, scoring, filtering, and mitigation tracking.

import type { ProductRisk, RiskLevel, RiskCategory, RiskStatus } from '@/types/manufacturing';

// ─── Risk Registry ────────────────────────────────────────────────────────────

export function getProductRiskRegistry(): ProductRisk[] {
  return [
    // Hardware risks
    {
      riskId: 'HW-001',
      category: 'hardware',
      title: 'No physical prototype exists',
      description: 'All hardware is specified in software only. No breadboard or PCB prototype has been built.',
      level: 'critical',
      mitigationPlan: 'Build off-the-shelf breadboard prototype (phone + Arduino haptic + bone-conduction headset) for V18 usability testing.',
      status: 'open',
    },
    {
      riskId: 'HW-002',
      category: 'hardware',
      title: 'Compute module not selected (AR2 placeholder)',
      description: 'Qualcomm AR2 is named in V16 spec but no NDA has been signed and no SDK access obtained.',
      level: 'high',
      mitigationPlan: 'Evaluate alternative SoCs (MediaTek MT8365, Synaptics Katana, Rockchip RK3568). Engage Qualcomm partner channel.',
      status: 'open',
    },
    {
      riskId: 'HW-003',
      category: 'hardware',
      title: 'Battery thermal risk in compact form factor',
      description: '300mAh LiPo in a 42g glasses form factor — thermal runaway risk if not properly managed.',
      level: 'high',
      mitigationPlan: 'Mandate IEC 62368 pre-assessment before first prototype. Include PMIC with over-temperature cutoff.',
      status: 'open',
    },
    {
      riskId: 'HW-004',
      category: 'hardware',
      title: 'Weight target may be unachievable at ≤42g',
      description: '4 cameras + SoC + LiPo + audio + haptics in ≤42g is aggressive. Most AR glasses weigh 60–120g.',
      level: 'medium',
      mitigationPlan: 'Commission thermal/weight simulation from industrial designer before committing to 42g spec. Revise if needed.',
      status: 'open',
    },
    // Software risks
    {
      riskId: 'SW-001',
      category: 'software',
      title: 'All AI is simulated — no real model inference',
      description: 'V12 vision pipeline, V13 navigation, and V15 on-device AI all use simulation. No real ML models trained.',
      level: 'high',
      mitigationPlan: 'Integrate MobileNet/YOLO-NAS for object detection. Partner with Fraunhofer IIS or TU Berlin CV lab.',
      status: 'open',
    },
    {
      riskId: 'SW-002',
      category: 'software',
      title: 'Web Speech API dependency (browser-only)',
      description: 'V5 voice commands use browser Web Speech API — not available in native glasses firmware.',
      level: 'medium',
      mitigationPlan: 'Evaluate Whisper.cpp (local) or Picovoice Porcupine for on-device wake word + STT in firmware.',
      status: 'open',
    },
    {
      riskId: 'SW-003',
      category: 'software',
      title: 'In-memory stores reset on server restart',
      description: 'All session, pilot, field trial, and navigation data uses Map<> stores — lost on Next.js hot-reload.',
      level: 'low',
      mitigationPlan: 'Add PostgreSQL/SQLite persistence layer before any real participant trials (Phase 19+).',
      status: 'accepted',
    },
    // Regulatory risks
    {
      riskId: 'REG-001',
      category: 'regulatory',
      title: 'Medical device boundary not formally assessed',
      description: 'An AI navigation tool for blind users could qualify as a Class I or IIa medical device under EU MDR 2017/745.',
      level: 'critical',
      mitigationPlan: 'Engage EU regulatory consultant (e.g. BSI Group, Qserve) for formal MDR boundary opinion before any public launch.',
      status: 'open',
    },
    {
      riskId: 'REG-002',
      category: 'regulatory',
      title: 'CE marking required before EU sale',
      description: 'Product cannot legally be sold in Germany or EU without CE marking (EMC + RED directives).',
      level: 'high',
      mitigationPlan: 'Initiate CE pre-consultation with TÜV Rheinland. Target Q1 2027 for hardware prototype testing.',
      status: 'open',
    },
    // Safety risks
    {
      riskId: 'SAF-001',
      category: 'safety',
      title: 'AI guidance certainty — never "safe to cross"',
      description: 'V13 crossingDecisionEngine always uses hedged language. But user may over-trust AI guidance in hazardous situations.',
      level: 'high',
      mitigationPlan: 'All onboarding must include "AI is advisory only" disclaimer. Supervisor always present in Phase 17 trials. V13 crossing message never asserts certainty (enforced in code).',
      status: 'mitigated',
    },
    {
      riskId: 'SAF-002',
      category: 'safety',
      title: 'Glasses disconnection during navigation',
      description: 'If glasses disconnect mid-session, user loses AI guidance unexpectedly.',
      level: 'high',
      mitigationPlan: 'V8 hardwareBridgeEngine.SAFETY_RULES.warnOnVisionDisconnect = true. V16 GLASSES_DISCONNECT_MESSAGE plays immediately. Phone camera fallback activates.',
      status: 'mitigated',
    },
    // Supply chain risks
    {
      riskId: 'SC-001',
      category: 'supply_chain',
      title: 'Single-source components (AR SoC)',
      description: 'AR-capable SoC market is highly concentrated. Qualcomm, Rockchip, MediaTek. Single-source dependency.',
      level: 'medium',
      mitigationPlan: 'Design PCB with drop-in footprint compatibility for 2+ SoC vendors. Do not hard-code to Qualcomm pinout.',
      status: 'open',
    },
    // Privacy risks
    {
      riskId: 'PRIV-001',
      category: 'privacy',
      title: 'Vision data could capture faces without consent',
      description: 'V9 social awareness processes nearby people. V12 object detection runs on camera frames.',
      level: 'high',
      mitigationPlan: 'V8 SAFETY_RULES.noFaceRecognition = true. V14 CAMERA_PRIVACY enforced. No raw frames stored. DPIA covers this. All enforced at engine level.',
      status: 'mitigated',
    },
    {
      riskId: 'PRIV-002',
      category: 'privacy',
      title: 'GPS location data could identify home/workplace',
      description: 'V7 GPS with memory could reveal sensitive location patterns.',
      level: 'medium',
      mitigationPlan: 'V7 locationPrivacyEngine applies 0.01° grid fuzzing. locationMemoryEnabled defaults false. DPIA covers this.',
      status: 'mitigated',
    },
  ];
}

// ─── Risk Filtering ───────────────────────────────────────────────────────────

export function getRisksByLevel(risks: ProductRisk[], level: RiskLevel): ProductRisk[] {
  return risks.filter(r => r.level === level);
}

export function getRisksByCategory(risks: ProductRisk[], category: RiskCategory): ProductRisk[] {
  return risks.filter(r => r.category === category);
}

export function getOpenRisks(risks: ProductRisk[]): ProductRisk[] {
  return risks.filter(r => r.status === 'open');
}

export function getMitigatedRisks(risks: ProductRisk[]): ProductRisk[] {
  return risks.filter(r => r.status === 'mitigated');
}

export function getCriticalOpenRisks(risks: ProductRisk[]): ProductRisk[] {
  return risks.filter(r => r.level === 'critical' && r.status === 'open');
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

export function calculateRiskScore(risks: ProductRisk[]): number {
  // Lower is better. 0 = no risks, 100 = all critical open.
  if (risks.length === 0) return 0;
  const weights: Record<RiskLevel, number> = { critical: 40, high: 20, medium: 10, low: 3 };
  const statusMultiplier: Record<RiskStatus, number> = { open: 1.0, mitigated: 0.1, accepted: 0.2 };
  const total = risks.reduce((sum, r) => sum + weights[r.level] * statusMultiplier[r.status], 0);
  const maxPossible = risks.reduce((sum, r) => sum + weights[r.level], 0);
  return Math.round((total / maxPossible) * 100);
}

export function getRiskSummary(risks: ProductRisk[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  mitigated: number;
  accepted: number;
} {
  return {
    total: risks.length,
    critical: getRisksByLevel(risks, 'critical').length,
    high: getRisksByLevel(risks, 'high').length,
    medium: getRisksByLevel(risks, 'medium').length,
    low: getRisksByLevel(risks, 'low').length,
    open: getOpenRisks(risks).length,
    mitigated: getMitigatedRisks(risks).length,
    accepted: risks.filter(r => r.status === 'accepted').length,
  };
}

// ─── Risk Formatting ──────────────────────────────────────────────────────────

export function formatRiskLevel(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    critical: '🔴 Critical',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  };
  return map[level];
}

export function formatRiskStatus(status: RiskStatus): string {
  const map: Record<RiskStatus, string> = {
    open: '⚠ Open',
    mitigated: '✓ Mitigated',
    accepted: '— Accepted',
  };
  return map[status];
}
