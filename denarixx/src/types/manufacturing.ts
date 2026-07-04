// ─── V18 Manufacturing Readiness & Product Certification Types ────────────────
// Separate from all other type files.
// All certification items are ROADMAP/PLANNING ONLY — never claim certified.

// ─── Enumerations ─────────────────────────────────────────────────────────────

export type HardwareComponent =
  | 'camera_module'
  | 'battery'
  | 'bone_conduction_audio'
  | 'haptic_motor'
  | 'compute_module'
  | 'bluetooth_le'
  | 'wifi'
  | 'thermal_management'
  | 'frame_structure'
  | 'charging_port'
  | 'imu_sensor';

export type ReadinessLevel =
  | 'not_started'
  | 'planning'
  | 'specification'
  | 'prototype'
  | 'production_ready';

export type ComplianceStatus =
  | 'not_assessed'
  | 'planning'
  | 'in_progress'
  | 'verified'
  | 'certified';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'mitigated' | 'accepted';
export type RiskCategory =
  | 'hardware'
  | 'software'
  | 'regulatory'
  | 'safety'
  | 'supply_chain'
  | 'privacy';

export type ManufacturingRegion = 'europe' | 'china' | 'hybrid';

export type CertificationStandard =
  | 'ce_marking'
  | 'gdpr'
  | 'eu_accessibility_act'
  | 'product_safety_eu'
  | 'battery_safety_iec62368'
  | 'bluetooth_fcc'
  | 'bluetooth_etsi'
  | 'data_protection_impact_assessment'
  | 'medical_device_boundary';

export type CertificationPhase =
  | 'pre_prototype'
  | 'prototype'
  | 'pre_production'
  | 'production';

// ─── Hardware Component Spec ──────────────────────────────────────────────────

export interface HardwareComponentSpec {
  component: HardwareComponent;
  name: string;
  description: string;
  readinessLevel: ReadinessLevel;
  targetSpec: string;
  currentSpec: string | null;
  blockers: string[];
  estimatedUnitCost: string;
  criticalPath: boolean;
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export interface ComplianceItem {
  id: CertificationStandard;
  name: string;
  description: string;
  status: ComplianceStatus;
  isRoadmapOnly: true;   // Always true — we never claim certified
  estimatedTimeline: string;
  notes: string;
  warningMessage?: string;
}

// ─── Product Risk ─────────────────────────────────────────────────────────────

export interface ProductRisk {
  riskId: string;
  category: RiskCategory;
  title: string;
  description: string;
  level: RiskLevel;
  mitigationPlan: string;
  status: RiskStatus;
}

// ─── Manufacturing Option ─────────────────────────────────────────────────────

export interface ManufacturingOption {
  region: ManufacturingRegion;
  name: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  estimatedLeadTimeWeeks: number;
  estimatedPrototypeCost: string;
  recommendedFor: string;
}

// ─── Certification Milestone ──────────────────────────────────────────────────

export interface CertificationMilestone {
  milestoneId: string;
  title: string;
  standard: CertificationStandard;
  phase: CertificationPhase;
  estimatedQuarter: string;
  isPlaceholder: true;   // Always true in V18
  prerequisites: string[];
  estimatedCost: string;
  notes: string;
}

// ─── Readiness Score ──────────────────────────────────────────────────────────

export interface ReadinessScore {
  overall: number;       // 0-100
  hardware: number;      // 0-100
  software: number;      // 0-100
  compliance: number;    // 0-100
  documentation: number; // 0-100
}

// ─── Full Report ──────────────────────────────────────────────────────────────

export interface ManufacturingReadinessReport {
  reportId: string;
  generatedAt: number;
  score: ReadinessScore;
  componentSpecs: HardwareComponentSpec[];
  complianceItems: ComplianceItem[];
  risks: ProductRisk[];
  manufacturingOptions: ManufacturingOption[];
  certificationMilestones: CertificationMilestone[];
  recommendedNextActions: string[];
  manufacturingDisclaimer: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MANUFACTURING_DISCLAIMER =
  'All certification items are planning/roadmap only. Denarixx Vision AI is not CE marked, ' +
  'not medically approved, and is not a medical device. This report is for internal planning purposes only.';

export const READINESS_LEVELS_ORDERED: ReadinessLevel[] = [
  'not_started',
  'planning',
  'specification',
  'prototype',
  'production_ready',
];

export const ALL_HARDWARE_COMPONENTS: HardwareComponent[] = [
  'camera_module',
  'battery',
  'bone_conduction_audio',
  'haptic_motor',
  'compute_module',
  'bluetooth_le',
  'wifi',
  'thermal_management',
  'frame_structure',
  'charging_port',
  'imu_sensor',
];
