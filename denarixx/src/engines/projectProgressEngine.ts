// projectProgressEngine.ts — Sprint progress tracker (pure functional, no async, no I/O)
// File-existence detection is done by the caller (API route / server component).

// ─── Sprint & Phase definitions ───────────────────────────────────────────────

export interface SprintDefinition {
  id: number;
  name: string;
  description: string;
  phase: number;
  /** Path relative to denarixx/tests/ used for auto-detection */
  testFile: string;
  engineCount: number;
  testCount: number;
  /** One-line milestone description */
  milestone: string;
}

export interface PhaseDefinition {
  id: number;
  name: string;
  label: string;
  sprintRange: [number, number]; // inclusive [first, last]
  description: string;
  icon: string;
}

// ─── Computed state types ──────────────────────────────────────────────────────

export type SprintStatus = 'complete' | 'active' | 'upcoming';
export type PhaseStatus = 'complete' | 'active' | 'locked';

export interface SprintState extends SprintDefinition {
  status: SprintStatus;
  progress: number; // 0 or 100
}

export interface PhaseState extends PhaseDefinition {
  status: PhaseStatus;
  progress: number; // 0–100
  completedSprints: number;
  totalSprints: number;
}

export interface ProjectProgress {
  overallPercent: number;
  currentSprint: SprintState | null;
  currentPhase: PhaseState | null;
  completedSprints: number;
  totalSprints: number;
  remainingSprints: number;
  nextMilestone: string | null;
  estimatedCompletion: string;
  phases: PhaseState[];
  sprints: SprintState[];
  mvpComplete: boolean;
  totalEngines: number;
  totalTests: number;
}

// ─── Sprint registry ──────────────────────────────────────────────────────────

export const SPRINT_REGISTRY: SprintDefinition[] = [
  // ── Phase 1: Safety Core MVP ──────────────────────────────────────────────
  {
    id: 1,
    name: 'V1 Core Engines',
    description: 'Hazard detection, safety decisions, scene reasoning, memory & conversation engines.',
    phase: 1,
    testFile: 'engines.test.ts',
    engineCount: 6,
    testCount: 24,
    milestone: 'Hazard detection & safety core operational',
  },
  {
    id: 2,
    name: 'V2 Cognitive Guardian',
    description: 'Guardian arbitration engine, proactive alerts, silence decisions, predictive risk.',
    phase: 1,
    testFile: 'cognitiveGuardian.test.ts',
    engineCount: 6,
    testCount: 37,
    milestone: 'AI interrupt arbitration live',
  },
  {
    id: 3,
    name: 'V3 Cognitive Reasoning',
    description: 'Environment understanding, cognitive reasoning, risk prediction, action decisions.',
    phase: 1,
    testFile: 'v3reasoning.test.ts',
    engineCount: 5,
    testCount: 27,
    milestone: 'Multi-stage reasoning pipeline complete',
  },
  {
    id: 4,
    name: 'V5 Voice Companion',
    description: 'Voice command recognition, guidance personality engine, onboarding flow.',
    phase: 1,
    testFile: 'voiceCompanion.test.ts',
    engineCount: 2,
    testCount: 72,
    milestone: 'Voice-first interaction layer shipped',
  },
  {
    id: 5,
    name: 'Guardian Alert Quality',
    description: 'Alert deduplication, directional wording, decision logger, quality orchestrator.',
    phase: 1,
    testFile: 'guardianAlertQuality.test.ts',
    engineCount: 4,
    testCount: 60,
    milestone: 'High-quality alert wording & deduplication',
  },

  // ── Phase 2: Context & Trust ───────────────────────────────────────────────
  {
    id: 6,
    name: 'V6 Spatial Intelligence',
    description: 'Spatial reasoning, path planning, mobility engine, live SVG bird\'s-eye map.',
    phase: 2,
    testFile: 'spatial.test.ts',
    engineCount: 4,
    testCount: 86,
    milestone: 'Real-time spatial map & path planning',
  },
  {
    id: 7,
    name: 'V7+V8 Sensors & Hardware',
    description: 'GPS/IMU sensor fusion, location privacy, wearable HAL, device capability engine.',
    phase: 2,
    testFile: 'sensorFusion.test.ts',
    engineCount: 8,
    testCount: 166,
    milestone: 'Phone sensors & smart glasses connected',
  },
  {
    id: 8,
    name: 'Long-Term Memory',
    description: 'Persistent AI memory, route recall, preference tracking, semantic search.',
    phase: 2,
    testFile: 'longTermMemory.test.ts',
    engineCount: 3,
    testCount: 100,
    milestone: 'AI remembers routes, places & preferences',
  },
  {
    id: 9,
    name: 'Explainable AI & Trust',
    description: 'Decision explanations, trust scores, feedback loop, ExplanationPanel UI.',
    phase: 2,
    testFile: 'explainableAI.test.ts',
    engineCount: 3,
    testCount: 90,
    milestone: 'Users understand every AI decision',
  },
  {
    id: 10,
    name: 'Adaptive Companion Personality',
    description: 'Context-aware personality modes, speech adaptation, Companion Settings page.',
    phase: 2,
    testFile: 'companionPersonality.test.ts',
    engineCount: 4,
    testCount: 92,
    milestone: 'Personalised guidance for every user',
  },

  {
    id: 11,
    name: 'Accessibility & Preferences',
    description: 'Accessibility presets, audio/haptic preferences, user preference engine, display settings.',
    phase: 2,
    testFile: 'accessibilityEngine.test.ts',
    engineCount: 4,
    testCount: 127,
    milestone: 'Full personalisation for every user need',
  },
  {
    id: 12,
    name: 'Privacy Dashboard & Consent',
    description: 'Consent management, permission audit, data retention, full privacy dashboard.',
    phase: 2,
    testFile: 'privacyDashboard.test.ts',
    engineCount: 4,
    testCount: 105,
    milestone: 'Complete user privacy control — Phase 2 complete',
  },

  // ── Phase 3: Device & Navigation ──────────────────────────────────────────
  {
    id: 13,
    name: 'Human Behaviour & Social',
    description: 'Activity inference, crowd understanding, interaction prediction, social awareness.',
    phase: 3,
    testFile: 'humanBehaviour.test.ts',
    engineCount: 4,
    testCount: 134,
    milestone: 'Social context understood in real-time',
  },
  {
    id: 14,
    name: 'Mobile Deployment Ready',
    description: 'PWA, service worker, offline mode, battery awareness, high-contrast accessibility.',
    phase: 3,
    testFile: 'mobileReadiness.test.ts',
    engineCount: 3,
    testCount: 47,
    milestone: 'Fully installable offline-capable PWA',
  },
  {
    id: 15,
    name: 'Pilot Testing Framework',
    description: 'Consent management, scenario registry, feedback collection, pilot reports.',
    phase: 3,
    testFile: 'pilotTesting.test.ts',
    engineCount: 1,
    testCount: 117,
    milestone: 'Structured real-world pilot testing ready',
  },
  {
    id: 16,
    name: 'Real-Time AI Vision Pipeline',
    description: 'Live inference orchestrator, depth reasoning, object tracking, scene understanding.',
    phase: 3,
    testFile: 'visionPipeline.test.ts',
    engineCount: 6,
    testCount: 148,
    milestone: 'Live 30 FPS vision pipeline operational',
  },
  {
    id: 17,
    name: 'Indoor & Outdoor Navigation',
    description: 'Turn-by-turn navigation, crossing safety, landmark guidance, route memory.',
    phase: 3,
    testFile: 'navigationEngine.test.ts',
    engineCount: 6,
    testCount: 151,
    milestone: 'Full indoor + outdoor navigation live',
  },

  // ── Phase 4: Production & Launch ──────────────────────────────────────────
  {
    id: 18,
    name: 'Multi-Camera Smart Glasses',
    description: 'Camera fusion, health monitoring, FOV zone tracking, wearable sensor fusion.',
    phase: 4,
    testFile: 'multiCameraSupport.test.ts',
    engineCount: 5,
    testCount: 164,
    milestone: '4-camera glasses fully operational',
  },
  {
    id: 19,
    name: 'On-Device AI Optimization',
    description: 'Edge inference, battery optimization, latency budgets, offline safety path.',
    phase: 4,
    testFile: 'onDeviceAI.test.ts',
    engineCount: 5,
    testCount: 170,
    milestone: 'Sub-500ms on-device inference achieved',
  },
  {
    id: 20,
    name: 'Denarixx Glasses Prototype',
    description: 'Hardware prototype, bone-conduction audio, haptic patterns, power management.',
    phase: 4,
    testFile: 'denarixxGlassesPrototype.test.ts',
    engineCount: 5,
    testCount: 176,
    milestone: 'Physical hardware prototype validated',
  },
  {
    id: 21,
    name: 'Real-World Field Trials',
    description: 'Field trial sessions, safety metrics, user feedback scoring, trial reports.',
    phase: 4,
    testFile: 'fieldTrial.test.ts',
    engineCount: 4,
    testCount: 161,
    milestone: 'Field trials passed with real users',
  },
  {
    id: 22,
    name: 'Manufacturing Readiness',
    description: 'Compliance planning, CE/MDR certification roadmap, risk assessment, manufacturer brief.',
    phase: 4,
    testFile: 'manufacturingReadiness.test.ts',
    engineCount: 4,
    testCount: 144,
    milestone: 'CE/MDR certification roadmap complete',
  },

  // ── Phase 5: Expanded Access ───────────────────────────────────────────────
  {
    id: 23,
    name: 'Multi-Language AI Engine',
    description: 'Language detection, translation pipeline, speech voice management — 8 languages with safety-first architecture.',
    phase: 5,
    testFile: 'languageEngine.test.ts',
    engineCount: 4,
    testCount: 120,
    milestone: 'Denarixx speaks 8 languages — safety always first',
  },
  {
    id: 24,
    name: 'Offline Mode & Edge AI',
    description: 'Glasses-first offline architecture: wearable edge AI on glasses compute module, sync queue, conflict resolution — all 10 features run on glasses without cloud.',
    phase: 5,
    testFile: 'offlineEngine.test.ts',
    engineCount: 5,
    testCount: 152,
    milestone: 'Denarixx operates safely without internet connection',
  },
  {
    id: 25,
    name: 'No-Internet Street Safety Mode',
    description: 'Glasses edge AI detects internet loss, activates offline street safety mode, announces via bone-conduction, and continues all critical guidance without cloud.',
    phase: 5,
    testFile: 'streetSafety.test.ts',
    engineCount: 4,
    testCount: 143,
    milestone: 'Blind users are protected on the street even without internet',
  },
];

// ─── Phase registry ───────────────────────────────────────────────────────────

export const PHASE_REGISTRY: PhaseDefinition[] = [
  {
    id: 1,
    name: 'Phase 1',
    label: 'Safety Core MVP',
    sprintRange: [1, 5],
    description: 'Core hazard detection, cognitive guardian, reasoning pipeline, voice companion.',
    icon: '🛡',
  },
  {
    id: 2,
    name: 'Phase 2',
    label: 'Context & Trust',
    sprintRange: [6, 12],
    description: 'Spatial intelligence, sensor fusion, long-term memory, explainable AI, companion personality, accessibility, privacy.',
    icon: '🧠',
  },
  {
    id: 3,
    name: 'Phase 3',
    label: 'Device & Navigation',
    sprintRange: [13, 17],
    description: 'Social awareness, mobile PWA, pilot testing, live vision pipeline, indoor/outdoor navigation.',
    icon: '🧭',
  },
  {
    id: 4,
    name: 'Phase 4',
    label: 'Production & Launch',
    sprintRange: [18, 22],
    description: 'Multi-camera glasses, on-device AI, hardware prototype, field trials, manufacturing readiness.',
    icon: '🚀',
  },
  {
    id: 5,
    name: 'Phase 5',
    label: 'Expanded Access',
    sprintRange: [23, 27],
    description: 'Multi-language AI, global accessibility, advanced personalisation, community features.',
    icon: '🌐',
  },
];

// ─── Pure computation functions ────────────────────────────────────────────────

/**
 * Given a Set of completed test file names, compute full project progress.
 * completedTestFiles: Set of filenames like "engines.test.ts"
 */
export function computeProgress(completedTestFiles: Set<string>): ProjectProgress {
  const totalSprints = SPRINT_REGISTRY.length;

  // Build sprint states
  const sprintStates: SprintState[] = SPRINT_REGISTRY.map(s => ({
    ...s,
    status: completedTestFiles.has(s.testFile) ? 'complete' : 'upcoming',
    progress: completedTestFiles.has(s.testFile) ? 100 : 0,
  }));

  // Find active sprint: first upcoming sprint after the last complete one
  const lastCompleteIdx = [...sprintStates].reverse().findIndex(s => s.status === 'complete');
  const lastCompleteId = lastCompleteIdx === -1
    ? 0
    : sprintStates[sprintStates.length - 1 - lastCompleteIdx].id;

  // Mark active (first upcoming after last complete)
  for (const s of sprintStates) {
    if (s.status === 'upcoming' && s.id === lastCompleteId + 1) {
      s.status = 'active';
      s.progress = 50; // in-progress
      break;
    }
  }

  const completedSprints = sprintStates.filter(s => s.status === 'complete').length;
  const overallPercent = Math.round((completedSprints / totalSprints) * 100);
  const mvpComplete = completedSprints === totalSprints;

  // Build phase states
  const phaseStates: PhaseState[] = PHASE_REGISTRY.map(phase => {
    const phaseSprints = sprintStates.filter(
      s => s.id >= phase.sprintRange[0] && s.id <= phase.sprintRange[1],
    );
    const phaseCompleted = phaseSprints.filter(s => s.status === 'complete').length;
    const phaseTotal = phaseSprints.length;
    const phaseProgress = Math.round((phaseCompleted / phaseTotal) * 100);

    let status: PhaseStatus;
    if (phaseCompleted === phaseTotal) {
      status = 'complete';
    } else if (phaseSprints.some(s => s.status === 'active' || s.status === 'complete')) {
      status = 'active';
    } else {
      status = 'locked';
    }

    return {
      ...phase,
      status,
      progress: phaseProgress,
      completedSprints: phaseCompleted,
      totalSprints: phaseTotal,
    };
  });

  const currentSprint = sprintStates.find(s => s.status === 'active') ?? null;
  const currentPhase = phaseStates.find(p => p.status === 'active') ?? null;

  const remainingSprints = totalSprints - completedSprints - (currentSprint ? 0 : 0);
  const remaining = sprintStates.filter(s => s.status === 'upcoming' || s.status === 'active');
  const nextMilestone = remaining.length > 0 ? remaining[0].milestone : null;

  const estimatedCompletion = estimateCompletion(completedSprints, totalSprints);
  const totalEngines = sprintStates
    .filter(s => s.status === 'complete')
    .reduce((sum, s) => sum + s.engineCount, 0);
  const totalTests = sprintStates
    .filter(s => s.status === 'complete')
    .reduce((sum, s) => sum + s.testCount, 0);

  return {
    overallPercent,
    currentSprint,
    currentPhase,
    completedSprints,
    totalSprints,
    remainingSprints: totalSprints - completedSprints,
    nextMilestone,
    estimatedCompletion,
    phases: phaseStates,
    sprints: sprintStates,
    mvpComplete,
    totalEngines,
    totalTests,
  };
}

/** Rough completion date estimate based on sprint velocity */
function estimateCompletion(completed: number, total: number): string {
  if (completed >= total) return 'Complete';
  const remaining = total - completed;
  // Assume ~2 weeks per sprint
  const weeksRemaining = remaining * 2;
  const est = new Date();
  est.setDate(est.getDate() + weeksRemaining * 7);
  return est.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ─── Helper queries ───────────────────────────────────────────────────────────

export function getSprintById(id: number): SprintDefinition | undefined {
  return SPRINT_REGISTRY.find(s => s.id === id);
}

export function getPhaseById(id: number): PhaseDefinition | undefined {
  return PHASE_REGISTRY.find(p => p.id === id);
}

export function getSprintsForPhase(phaseId: number): SprintDefinition[] {
  const phase = PHASE_REGISTRY.find(p => p.id === phaseId);
  if (!phase) return [];
  return SPRINT_REGISTRY.filter(
    s => s.id >= phase.sprintRange[0] && s.id <= phase.sprintRange[1],
  );
}

export function phaseStatusLabel(status: PhaseStatus): string {
  switch (status) {
    case 'complete': return '✔ Complete';
    case 'active':   return '● Active';
    case 'locked':   return '🔒 Upcoming';
  }
}

export function sprintStatusLabel(status: SprintStatus): string {
  switch (status) {
    case 'complete': return '✔ Complete';
    case 'active':   return '● Active';
    case 'upcoming': return '○ Upcoming';
  }
}

export function phaseStatusColor(status: PhaseStatus): string {
  switch (status) {
    case 'complete': return 'green';
    case 'active':   return 'yellow';
    case 'locked':   return 'gray';
  }
}
