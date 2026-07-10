/**
 * Alert Coordination Engine — Live Perception Hardening
 *
 * Unified 7-level priority queue. Prevents OCR, vision, navigation, and companion
 * messages from speaking over each other. Handles deduplication, cooldown tracking,
 * and critical-alert interrupt logic.
 *
 * Priority levels (1 = highest):
 *   1. critical_hazard       — imminent danger, always interrupt
 *   2. high_navigation       — high-risk navigation warning
 *   3. system_failure        — provider failure, emergency stop
 *   4. important_ocr         — hazard sign, medicine label
 *   5. normal_navigation     — turn guidance, landmark
 *   6. scene_description     — what the camera sees
 *   7. companion_info        — reassurance, ambient information
 *
 * Pure TypeScript — no browser APIs, fully testable in Node.js.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AlertSource =
  | 'vision'
  | 'ocr'
  | 'navigation'
  | 'companion'
  | 'system';

export type CoordinationPriority =
  | 'critical_hazard'
  | 'high_navigation'
  | 'system_failure'
  | 'important_ocr'
  | 'normal_navigation'
  | 'scene_description'
  | 'companion_info';

export const COORDINATION_PRIORITY_RANK: Record<CoordinationPriority, number> = {
  critical_hazard:   1,
  high_navigation:   2,
  system_failure:    3,
  important_ocr:     4,
  normal_navigation: 5,
  scene_description: 6,
  companion_info:    7,
};

export interface CoordinatedAlert {
  id: string;
  text: string;
  priority: CoordinationPriority;
  source: AlertSource;
  /** Deduplication key: same key in cooldown window = suppressed */
  deduplicationKey: string;
  enqueuedAt: Date;
  /** Whether this alert should stop any currently-speaking audio */
  interrupt: boolean;
  /** Cooldown duration in ms — don't repeat this key within this window */
  cooldownMs: number;
}

export interface CoordinationState {
  queue: CoordinatedAlert[];
  /** Currently speaking item (null if idle) */
  speaking: CoordinatedAlert | null;
  /** Deduplication cooldowns: key → expiry timestamp */
  cooldowns: Record<string, number>;
  /** Suppressed alert count (for diagnostics) */
  suppressedCount: number;
  /** Total spoken count */
  spokenCount: number;
}

// ── Default cooldowns (ms) per priority ───────────────────────────────────────

export const DEFAULT_COOLDOWN_MS: Record<CoordinationPriority, number> = {
  critical_hazard:    0,     // critical: no cooldown — always repeat if risk is active
  high_navigation:    8000,
  system_failure:    15000,
  important_ocr:     20000,
  normal_navigation: 10000,
  scene_description: 12000,
  companion_info:    30000,
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createCoordinationState(): CoordinationState {
  return {
    queue: [],
    speaking: null,
    cooldowns: {},
    suppressedCount: 0,
    spokenCount: 0,
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

export function isDuplicate(
  state: CoordinationState,
  deduplicationKey: string,
  now: number = Date.now(),
): boolean {
  const expiry = state.cooldowns[deduplicationKey];
  return expiry !== undefined && now < expiry;
}

export function recordCooldown(
  state: CoordinationState,
  deduplicationKey: string,
  cooldownMs: number,
  now: number = Date.now(),
): CoordinationState {
  if (cooldownMs <= 0) return state;
  return {
    ...state,
    cooldowns: {
      ...state.cooldowns,
      [deduplicationKey]: now + cooldownMs,
    },
  };
}

export function purgeCooldowns(
  state: CoordinationState,
  now: number = Date.now(),
): CoordinationState {
  const cooldowns: Record<string, number> = {};
  for (const [key, expiry] of Object.entries(state.cooldowns)) {
    if (now < expiry) cooldowns[key] = expiry;
  }
  return { ...state, cooldowns };
}

// ── Build an alert ────────────────────────────────────────────────────────────

let _idSeq = 0;

export function buildAlert(
  text: string,
  priority: CoordinationPriority,
  source: AlertSource,
  options: {
    deduplicationKey?: string;
    cooldownMs?: number;
    interrupt?: boolean;
  } = {},
): CoordinatedAlert {
  const isCritical = priority === 'critical_hazard';
  return {
    id: `coord-${++_idSeq}`,
    text,
    priority,
    source,
    deduplicationKey: options.deduplicationKey ?? `${source}:${text.slice(0, 40)}`,
    enqueuedAt: new Date(),
    interrupt: options.interrupt ?? isCritical,
    cooldownMs: options.cooldownMs ?? DEFAULT_COOLDOWN_MS[priority],
  };
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

export function enqueueAlert(
  state: CoordinationState,
  alert: CoordinatedAlert,
  now: number = Date.now(),
): { state: CoordinationState; suppressed: boolean; reason?: string } {
  // 1. Deduplication check (critical_hazard bypasses)
  if (alert.priority !== 'critical_hazard' && isDuplicate(state, alert.deduplicationKey, now)) {
    return {
      state: { ...state, suppressedCount: state.suppressedCount + 1 },
      suppressed: true,
      reason: 'duplicate-cooldown',
    };
  }

  // 2. Drop companion/scene if critical is already speaking
  if (
    state.speaking?.priority === 'critical_hazard' &&
    (alert.priority === 'scene_description' || alert.priority === 'companion_info')
  ) {
    return {
      state: { ...state, suppressedCount: state.suppressedCount + 1 },
      suppressed: true,
      reason: 'critical-active',
    };
  }

  // 3. Sort queue by priority rank (lower number = higher priority)
  const inserted = [...state.queue, alert].sort(
    (a, b) => COORDINATION_PRIORITY_RANK[a.priority] - COORDINATION_PRIORITY_RANK[b.priority],
  );

  // 4. Cap queue: drop lowest-priority items beyond limit
  const trimmed = inserted.slice(0, 12);

  return {
    state: { ...state, queue: trimmed },
    suppressed: false,
  };
}

// ── Dequeue ───────────────────────────────────────────────────────────────────

export function dequeueNextAlert(
  state: CoordinationState,
  now: number = Date.now(),
): { state: CoordinationState; alert: CoordinatedAlert | null } {
  if (state.queue.length === 0) {
    return { state: { ...state, speaking: null }, alert: null };
  }
  const [next, ...remaining] = state.queue;
  const withCooldown = recordCooldown(state, next.deduplicationKey, next.cooldownMs, now);
  const next_state: CoordinationState = {
    ...withCooldown,
    queue: remaining,
    speaking: next,
    spokenCount: state.spokenCount + 1,
  };
  return { state: next_state, alert: next };
}

export function markSpeakingDone(state: CoordinationState): CoordinationState {
  return { ...state, speaking: null };
}

// ── Interrupt logic ────────────────────────────────────────────────────────────

/**
 * Returns true if the incoming alert should interrupt currently-speaking audio.
 * Only critical_hazard and system_failure can interrupt.
 */
export function shouldInterrupt(
  state: CoordinationState,
  incoming: CoordinatedAlert,
): boolean {
  if (!state.speaking) return false;
  if (incoming.interrupt) return true;
  if (incoming.priority === 'system_failure') return true;
  // Critical interrupts anything below critical
  if (
    incoming.priority === 'critical_hazard' &&
    state.speaking.priority !== 'critical_hazard'
  ) return true;
  return false;
}

/**
 * Interrupt current speech and optionally clear queued low-priority items.
 */
export function applyInterrupt(
  state: CoordinationState,
  incomingPriority: CoordinationPriority,
): CoordinationState {
  const rankCutoff = COORDINATION_PRIORITY_RANK[incomingPriority];
  // Remove queued items with lower priority (higher rank number) than incoming
  const filtered = state.queue.filter(
    a => COORDINATION_PRIORITY_RANK[a.priority] < rankCutoff,
  );
  return { ...state, speaking: null, queue: filtered };
}

// ── Multi-source helpers ───────────────────────────────────────────────────────

export function buildVisionAlert(
  text: string,
  urgency: 'critical' | 'high' | 'medium' | 'low',
): CoordinatedAlert {
  const priority: CoordinationPriority =
    urgency === 'critical' ? 'critical_hazard' :
    urgency === 'high'     ? 'high_navigation' :
    'scene_description';
  return buildAlert(text, priority, 'vision', {
    deduplicationKey: `vision:${text.slice(0, 50)}`,
    interrupt: urgency === 'critical',
  });
}

export function buildOCRAlert(
  text: string,
  isHazard: boolean,
): CoordinatedAlert {
  const priority: CoordinationPriority = isHazard ? 'important_ocr' : 'scene_description';
  return buildAlert(text, priority, 'ocr', {
    deduplicationKey: `ocr:${text.slice(0, 50)}`,
    cooldownMs: isHazard ? 10000 : 20000,
  });
}

export function buildNavigationAlert(
  text: string,
  isHighRisk: boolean,
): CoordinatedAlert {
  const priority: CoordinationPriority = isHighRisk ? 'high_navigation' : 'normal_navigation';
  return buildAlert(text, priority, 'navigation', {
    deduplicationKey: `nav:${text.slice(0, 50)}`,
  });
}

export function buildSystemAlert(text: string, isCritical = false): CoordinatedAlert {
  return buildAlert(text, isCritical ? 'critical_hazard' : 'system_failure', 'system', {
    deduplicationKey: `system:${text.slice(0, 50)}`,
    interrupt: isCritical,
    cooldownMs: 10000,
  });
}

export function buildCompanionAlert(text: string): CoordinatedAlert {
  return buildAlert(text, 'companion_info', 'companion', {
    deduplicationKey: `companion:${text.slice(0, 50)}`,
  });
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

export interface CoordinationSnapshot {
  queueLength: number;
  isSpeaking: boolean;
  speakingPriority: CoordinationPriority | null;
  suppressedCount: number;
  spokenCount: number;
  activeCooldowns: number;
}

export function getCoordinationSnapshot(
  state: CoordinationState,
  now: number = Date.now(),
): CoordinationSnapshot {
  const purged = purgeCooldowns(state, now);
  return {
    queueLength: state.queue.length,
    isSpeaking: state.speaking !== null,
    speakingPriority: state.speaking?.priority ?? null,
    suppressedCount: state.suppressedCount,
    spokenCount: state.spokenCount,
    activeCooldowns: Object.keys(purged.cooldowns).length,
  };
}

export function describeCoordinationPriority(p: CoordinationPriority): string {
  switch (p) {
    case 'critical_hazard':   return 'Critical hazard — immediate action required';
    case 'high_navigation':   return 'High-risk navigation warning';
    case 'system_failure':    return 'System or provider failure';
    case 'important_ocr':     return 'Important text detected (sign, medicine label)';
    case 'normal_navigation': return 'Navigation guidance';
    case 'scene_description': return 'Scene description';
    case 'companion_info':    return 'Companion information';
  }
}
