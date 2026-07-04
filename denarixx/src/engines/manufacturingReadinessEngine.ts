// ─── V18 Manufacturing Readiness Engine ──────────────────────────────────────
// Pure functions — no async, no I/O.
// Hardware component registry, readiness scoring, next-action recommendations.

import type {
  HardwareComponentSpec,
  ReadinessLevel,
  ReadinessScore,
  ManufacturingOption,
} from '@/types/manufacturing';
import { READINESS_LEVELS_ORDERED } from '@/types/manufacturing';

// ─── Hardware Component Registry ─────────────────────────────────────────────

export function getHardwareComponentRegistry(): HardwareComponentSpec[] {
  return [
    {
      component: 'camera_module',
      name: 'Wide-Angle Camera Modules (×4)',
      description: 'Front 80°, left/right 100°, downward 120° with depth estimation.',
      readinessLevel: 'specification',
      targetSpec: '4× cameras: 1080p front, 720p side ×2, 480p downward. Max 30fps front, 15fps sides.',
      currentSpec: 'V16 software spec defined. No physical module selected.',
      blockers: ['No hardware vendor engaged', 'Optical tolerancing not started'],
      estimatedUnitCost: '€15–40 per module (est.)',
      criticalPath: true,
    },
    {
      component: 'battery',
      name: 'LiPo Battery',
      description: '300mAh LiPo targeting 4h glasses-primary operation.',
      readinessLevel: 'specification',
      targetSpec: '300mAh 3.7V LiPo, <5g, UL1642 / IEC62368 safe chemistry.',
      currentSpec: 'V16 spec: 300mAh, 4h life. No physical cell sourced.',
      blockers: ['Battery safety certification (IEC 62368) not started', 'No cell vendor selected'],
      estimatedUnitCost: '€3–8 (est.)',
      criticalPath: true,
    },
    {
      component: 'bone_conduction_audio',
      name: 'Bone-Conduction Transducers',
      description: 'Dual-channel bone-conduction audio. No in-ear occlusion.',
      readinessLevel: 'planning',
      targetSpec: '20Hz–20kHz, ≥85dB SPL at 1cm, <300mW draw.',
      currentSpec: 'V16 audioWearableEngine specifies routing. No module selected.',
      blockers: ['Vendor not selected', 'Acoustic testing not started'],
      estimatedUnitCost: '€8–20 (est.)',
      criticalPath: true,
    },
    {
      component: 'haptic_motor',
      name: 'Haptic Actuators',
      description: 'LRA (Linear Resonant Actuator) haptic feedback for 8-pattern alert system.',
      readinessLevel: 'planning',
      targetSpec: 'LRA, 150–300Hz resonance, <100mW, <2g each.',
      currentSpec: 'V16 hapticWearableEngine defines 8 patterns. No physical module.',
      blockers: ['No vendor selected', 'Placement on frame not finalised'],
      estimatedUnitCost: '€2–5 (est.)',
      criticalPath: false,
    },
    {
      component: 'compute_module',
      name: 'On-Device Compute (Qualcomm AR2 placeholder)',
      description: 'Edge AI inference SoC. V15/V16 target Qualcomm AR2 or equivalent.',
      readinessLevel: 'planning',
      targetSpec: 'NPU ≥1 TOPS, <500mW TDP, supports ONNX/TFLite runtime.',
      currentSpec: 'V15 onDeviceAIEngine defines runtimes. AR2 is placeholder — no NDA signed.',
      blockers: ['No OEM engagement', 'No SDK access', 'Qualcomm NDA required'],
      estimatedUnitCost: '€25–80 SoM (est.)',
      criticalPath: true,
    },
    {
      component: 'bluetooth_le',
      name: 'Bluetooth LE 5.3 Radio',
      description: 'Primary phone connectivity. BT LE Audio for low-latency audio streaming.',
      readinessLevel: 'planning',
      targetSpec: 'BT 5.3, BT LE Audio, <10mW standby, range ≥10m.',
      currentSpec: 'V8 wearableConnectionEngine simulates BT. No radio module.',
      blockers: ['FCC/CE Bluetooth certification not started', 'No module selected'],
      estimatedUnitCost: '€2–6 integrated on SoM (est.)',
      criticalPath: true,
    },
    {
      component: 'wifi',
      name: 'Wi-Fi 6 (optional)',
      description: 'Optional Wi-Fi for firmware OTA and cloud AI offload.',
      readinessLevel: 'not_started',
      targetSpec: 'IEEE 802.11ax (Wi-Fi 6), 2.4/5GHz.',
      currentSpec: null,
      blockers: ['Not required for Phase 18 prototype', 'Power budget impact unassessed'],
      estimatedUnitCost: '€3–8 integrated (est.)',
      criticalPath: false,
    },
    {
      component: 'thermal_management',
      name: 'Thermal Management',
      description: 'Passive heat dissipation. Max 40°C external surface at sustained load.',
      readinessLevel: 'planning',
      targetSpec: 'External surface <40°C. CPU throttle at 70°C junction.',
      currentSpec: 'V16 powerManagementEngine defines thermal states. No physical thermal design.',
      blockers: ['No thermal simulation done', 'Frame material not selected'],
      estimatedUnitCost: 'Included in frame design',
      criticalPath: false,
    },
    {
      component: 'frame_structure',
      name: 'Glasses Frame (TR90 / Titanium)',
      description: '42g target. Lightweight, durable, hypoallergenic frame.',
      readinessLevel: 'planning',
      targetSpec: '≤42g total. TR90 polymer or titanium alloy. IP52 dust/splash resistance.',
      currentSpec: 'V16 spec: 42g. No CAD model. No mould tooling.',
      blockers: ['No industrial designer engaged', 'CAD not started', 'IP52 testing not started'],
      estimatedUnitCost: '€8–25 (est., excluding tooling €5k–30k)',
      criticalPath: true,
    },
    {
      component: 'charging_port',
      name: 'USB-C Charging Port',
      description: 'USB-C PD charging. Target 30min to 80% charge.',
      readinessLevel: 'planning',
      targetSpec: 'USB-C 2.0, 5W PD, charging IC with over-voltage protection.',
      currentSpec: null,
      blockers: ['PMIC (Power Management IC) not selected'],
      estimatedUnitCost: '€0.50–2 (est.)',
      criticalPath: false,
    },
    {
      component: 'imu_sensor',
      name: 'IMU (Accelerometer + Gyroscope)',
      description: 'Head motion tracking for spatial intelligence and gesture detection.',
      readinessLevel: 'planning',
      targetSpec: '6-DOF IMU, ≤1mW standby, SPI/I2C interface.',
      currentSpec: 'V7 sensorFusionEngine supports IMU. No physical sensor selected.',
      blockers: ['No vendor selected'],
      estimatedUnitCost: '€1–3 (est.)',
      criticalPath: false,
    },
  ];
}

// ─── Readiness Scoring ────────────────────────────────────────────────────────

export function readinessLevelToScore(level: ReadinessLevel): number {
  const scores: Record<ReadinessLevel, number> = {
    not_started: 0,
    planning: 25,
    specification: 50,
    prototype: 75,
    production_ready: 100,
  };
  return scores[level];
}

export function calculateHardwareReadiness(specs: HardwareComponentSpec[]): number {
  if (specs.length === 0) return 0;
  const total = specs.reduce((sum, s) => sum + readinessLevelToScore(s.readinessLevel), 0);
  return Math.round(total / specs.length);
}

export function calculateReadinessScore(
  specs: HardwareComponentSpec[],
  softwareScore: number,
  complianceScore: number,
  documentationScore: number,
): ReadinessScore {
  const hardware = calculateHardwareReadiness(specs);
  const overall = Math.round((hardware + softwareScore + complianceScore + documentationScore) / 4);
  return { overall, hardware, software: softwareScore, compliance: complianceScore, documentation: documentationScore };
}

// ─── Readiness Grade ─────────────────────────────────────────────────────────

export function getReadinessGrade(score: number): 'not_ready' | 'early_planning' | 'mid_planning' | 'late_planning' | 'ready' {
  if (score < 15) return 'not_ready';
  if (score < 35) return 'early_planning';
  if (score < 55) return 'mid_planning';
  if (score < 80) return 'late_planning';
  return 'ready';
}

export function formatReadinessGrade(score: number): string {
  const grade = getReadinessGrade(score);
  const labels: Record<ReturnType<typeof getReadinessGrade>, string> = {
    not_ready: '🔴 Not Ready',
    early_planning: '🟠 Early Planning',
    mid_planning: '🟡 Mid Planning',
    late_planning: '🔵 Late Planning',
    ready: '🟢 Ready',
  };
  return `${labels[grade]} (${score}/100)`;
}

// ─── Critical Path ────────────────────────────────────────────────────────────

export function getCriticalPathComponents(specs: HardwareComponentSpec[]): HardwareComponentSpec[] {
  return specs.filter(s => s.criticalPath);
}

export function getBlockedComponents(specs: HardwareComponentSpec[]): HardwareComponentSpec[] {
  return specs.filter(s => s.blockers.length > 0);
}

export function getMissingSpecComponents(specs: HardwareComponentSpec[]): HardwareComponentSpec[] {
  return specs.filter(s => s.currentSpec === null);
}

export function getComponentsByReadiness(specs: HardwareComponentSpec[], level: ReadinessLevel): HardwareComponentSpec[] {
  return specs.filter(s => s.readinessLevel === level);
}

// ─── Manufacturing Options ────────────────────────────────────────────────────

export function getManufacturingOptions(): ManufacturingOption[] {
  return [
    {
      region: 'china',
      name: 'China Manufacturing (Shenzhen)',
      description: 'Full product manufacturing via established EMS partners (Foxconn, BYD Electronics, etc.).',
      advantages: [
        'Lowest per-unit cost at scale',
        'Large component supply chain nearby',
        'Fast prototype-to-production pipeline',
        'Experienced in consumer electronics glasses',
      ],
      disadvantages: [
        'IP risk requires strong NDA and supply chain audit',
        'EU GDPR data residency concerns for firmware updates',
        'Higher shipping and import duty to Germany',
        'Longer supply chain visibility',
      ],
      estimatedLeadTimeWeeks: 16,
      estimatedPrototypeCost: '€5,000–20,000 for first 5 units',
      recommendedFor: 'Scale production (>1,000 units)',
    },
    {
      region: 'europe',
      name: 'Europe Manufacturing (Germany / Netherlands)',
      description: 'Low-volume contract manufacturing via German or Dutch EMS (e.g. Limtronik, Zollner).',
      advantages: [
        'GDPR-compliant by default',
        'Strong IP protection under EU law',
        'Direct supplier relationships (Fraunhofer, TU Berlin)',
        'EU Accessibility Act alignment',
        'Faster shipping to German pilot users',
      ],
      disadvantages: [
        'Higher per-unit cost (×3–5× vs China)',
        'Smaller supply chain for specialist components',
        'Longer lead time for custom tooling',
      ],
      estimatedLeadTimeWeeks: 24,
      estimatedPrototypeCost: '€15,000–60,000 for first 5 units',
      recommendedFor: 'Pilot prototypes (1–50 units)',
    },
    {
      region: 'hybrid',
      name: 'Hybrid Path (Design EU, Manufacture CN)',
      description: 'Industrial design and R&D in Germany; component manufacturing and assembly in China.',
      advantages: [
        'EU-quality design with China cost efficiency',
        'Best of both: GDPR design principles + scale cost',
        'Common approach for German hardware startups',
      ],
      disadvantages: [
        'Complex IP management across jurisdictions',
        'Requires EU-based PCB design house + CN assembly partner',
        'Quality audit complexity',
      ],
      estimatedLeadTimeWeeks: 20,
      estimatedPrototypeCost: '€8,000–30,000 for first 5 units',
      recommendedFor: 'Recommended path for Phase 18→19 transition',
    },
  ];
}

// ─── Recommended Next Actions ─────────────────────────────────────────────────

export function buildRecommendedNextActions(specs: HardwareComponentSpec[]): string[] {
  const actions: string[] = [];

  const criticalBlocked = specs.filter(s => s.criticalPath && s.blockers.length > 0);
  if (criticalBlocked.length > 0) {
    actions.push(`Unblock ${criticalBlocked.length} critical-path components — start with vendor engagement for: ${criticalBlocked.map(s => s.name).join(', ')}.`);
  }

  const notStarted = specs.filter(s => s.readinessLevel === 'not_started');
  if (notStarted.length > 0) {
    actions.push(`Move ${notStarted.length} component(s) from "not started" to planning stage: ${notStarted.map(s => s.name).join(', ')}.`);
  }

  actions.push('Engage an industrial designer for frame CAD modelling (target: ≤42g, TR90 or titanium).');
  actions.push('Sign NDA with Qualcomm or alternative AR SoC vendor to access AR2 SDK.');
  actions.push('Commission IEC 62368 battery safety pre-assessment from accredited lab.');
  actions.push('Initiate GDPR Data Protection Impact Assessment (DPIA) with EU-qualified data protection officer.');
  actions.push('File for CE marking pre-consultation with notified body (TÜV Rheinland recommended for Germany).');
  actions.push('Select bone-conduction module vendor and order evaluation kits (Shokz OEM / xMEMS / Vibronics).');
  actions.push('Build first physical breadboard prototype (off-the-shelf phone + Arduino haptic shield) for usability testing.');

  return actions;
}

// ─── Readiness Level Ordering ─────────────────────────────────────────────────

export function readinessLevelIndex(level: ReadinessLevel): number {
  return READINESS_LEVELS_ORDERED.indexOf(level);
}

export function isReadinessAtLeast(current: ReadinessLevel, target: ReadinessLevel): boolean {
  return readinessLevelIndex(current) >= readinessLevelIndex(target);
}
