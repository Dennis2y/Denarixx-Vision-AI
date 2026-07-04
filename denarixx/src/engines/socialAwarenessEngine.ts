/**
 * SocialAwarenessEngine (V9)
 *
 * Combines outputs from HumanBehaviourEngine, CrowdUnderstandingEngine,
 * and InteractionPredictionEngine into a unified SocialContext with
 * human-readable guidance messages.
 *
 * Language rules:
 *  - Describe only OBSERVABLE behaviour.
 *  - Never name unknown people.
 *  - Never infer emotions as facts.
 *  - Never guess intentions.
 *  - Use hedging language ("appears to be", "seems to be", "may be").
 *
 * Pure engine — no async, no I/O, no React.
 */

import type {
  NearbyPerson,
  SocialContext,
  SocialAlert,
  SocialInput,
  InteractionPrediction,
  RelativeDirection,
} from '@/types/social';
import { analyzePersons } from './humanBehaviourEngine';
import { analyzeCrowd, crowdRiskWarning } from './crowdUnderstandingEngine';
import { predictAllInteractions, highestRisk } from './interactionPredictionEngine';

// ─── Direction labels ─────────────────────────────────────────────────────────

const DIRECTION_LABEL: Record<RelativeDirection, string> = {
  ahead:        'ahead',
  ahead_left:   'ahead to your left',
  ahead_right:  'ahead to your right',
  left:         'from your left',
  right:        'from your right',
  behind:       'from behind',
  behind_left:  'behind to your left',
  behind_right: 'behind to your right',
};

// ─── Guidance generation ──────────────────────────────────────────────────────

/** Generate a guidance sentence for a single nearby person. */
function personGuidance(person: NearbyPerson): string | null {
  const dir = DIRECTION_LABEL[person.direction];

  switch (person.activity) {
    case 'approaching':
      return person.approachSpeed === 'fast'
        ? `Someone is approaching quickly ${dir}.`
        : `Someone is approaching ${dir}.`;
    case 'running':
      return `Someone is running ${dir}.`;
    case 'waving':
      return `Someone ${dir} appears to be waving.`;
    case 'pointing':
      return `Someone ${dir} appears to be pointing.`;
    case 'waiting':
      return `A person appears to be waiting ${dir}.`;
    case 'falling':
      return `A person may have fallen ${dir}.`;
    case 'crossing_road':
      return `Someone is crossing ${dir}.`;
    default:
      if (person.inPersonalSpace) return `Someone is very close ${dir}.`;
      if (person.isApproaching) return `Someone is moving toward you ${dir}.`;
      return null;
  }
}

/** Produce a primary guidance message for the current social context. */
function buildPrimaryGuidance(
  persons: NearbyPerson[],
  predictions: InteractionPrediction[],
  crowdWarning: string | null
): string | null {
  // Priority 1: urgent safety — falling, fast approach, personal space breach
  const falling = persons.find((p) => p.activity === 'falling');
  if (falling) return personGuidance(falling);

  const inPersonalSpace = persons.find((p) => p.inPersonalSpace);
  if (inPersonalSpace) return `Someone is very close ${DIRECTION_LABEL[inPersonalSpace.direction]}.`;

  // Priority 2: high collision risk
  const highRiskPred = predictions.find((p) => p.collisionRisk >= 0.6);
  if (highRiskPred) {
    const person = persons.find((p) => p.id === highRiskPred.personId);
    if (person) return `Someone is approaching quickly ${DIRECTION_LABEL[person.direction]}.`;
  }

  // Priority 3: crowd warning
  if (crowdWarning) return crowdWarning;

  // Priority 4: most interesting person
  const mostInteresting = [...persons].sort(
    (a, b) => b.interactionProbability - a.interactionProbability
  )[0];
  if (mostInteresting) return personGuidance(mostInteresting);

  // Priority 5: positive clearance message
  if (persons.length === 0) return 'There is plenty of space to continue walking.';
  return null;
}

// ─── Alert generation ─────────────────────────────────────────────────────────

/** Generate an ordered list of social alerts from the current context. */
function buildAlerts(
  persons: NearbyPerson[],
  predictions: InteractionPrediction[],
  crowdWarning: string | null
): SocialAlert[] {
  const alerts: SocialAlert[] = [];

  for (const person of persons) {
    const pred = predictions.find((p) => p.personId === person.id);

    // Urgent: falling, personal space breach, high collision
    if (person.activity === 'falling') {
      alerts.push({
        severity: 'urgent',
        message: `A person may have fallen ${DIRECTION_LABEL[person.direction]}.`,
        direction: person.direction,
        personId: person.id,
      });
    } else if (person.inPersonalSpace) {
      alerts.push({
        severity: 'urgent',
        message: `Someone is very close — personal space ${DIRECTION_LABEL[person.direction]}.`,
        direction: person.direction,
        personId: person.id,
      });
    } else if (pred && pred.collisionRisk >= 0.6) {
      alerts.push({
        severity: 'warning',
        message: `Collision risk: someone approaching ${DIRECTION_LABEL[person.direction]}.`,
        direction: person.direction,
        personId: person.id,
      });
    } else if (person.activity === 'running') {
      alerts.push({
        severity: 'warning',
        message: `Someone is running ${DIRECTION_LABEL[person.direction]}.`,
        direction: person.direction,
        personId: person.id,
      });
    } else if (person.activity === 'approaching' && person.distanceZone === 'close') {
      alerts.push({
        severity: 'warning',
        message: `Someone is close and approaching ${DIRECTION_LABEL[person.direction]}.`,
        direction: person.direction,
        personId: person.id,
      });
    } else if (person.activity === 'waving' || person.activity === 'pointing') {
      alerts.push({
        severity: 'info',
        message: `${personGuidance(person) ?? `Activity detected ${DIRECTION_LABEL[person.direction]}.`}`,
        direction: person.direction,
        personId: person.id,
      });
    }
  }

  if (crowdWarning) {
    alerts.push({ severity: 'warning', message: crowdWarning, direction: null, personId: null });
  }

  // Sort: urgent first
  return alerts.sort((a, b) => {
    const order = { urgent: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Scenario simulation ──────────────────────────────────────────────────────

import { simulateDetectedPerson } from './humanBehaviourEngine';
import type { SocialScenario, DetectedPerson } from '@/types/social';

/** Generate a set of simulated DetectedPersons for a given scenario. */
export function simulateScenario(scenario: SocialScenario): {
  persons: DetectedPerson[];
  sceneDescription: string;
} {
  switch (scenario) {
    case 'empty_street':
      return { persons: [], sceneDescription: 'empty street' };

    case 'someone_approaching':
      return {
        persons: [simulateDetectedPerson('p1', 0.5, 0.45, 0.55, 4.0)],
        sceneDescription: 'someone approaching',
      };

    case 'someone_waiting':
      return {
        persons: [simulateDetectedPerson('p1', 0.6, 0.5, 0.35, 5.0)],
        sceneDescription: 'person waiting near entrance',
      };

    case 'small_queue':
      return {
        persons: [
          simulateDetectedPerson('p1', 0.5, 0.4, 0.3, 7.0),
          simulateDetectedPerson('p2', 0.52, 0.45, 0.25, 9.0),
          simulateDetectedPerson('p3', 0.48, 0.42, 0.22, 11.0),
        ],
        sceneDescription: 'people standing waiting in line',
      };

    case 'people_crossing':
      return {
        persons: [
          simulateDetectedPerson('p1', 0.2, 0.5, 0.4, 4.0),
          simulateDetectedPerson('p2', 0.3, 0.5, 0.35, 5.5),
        ],
        sceneDescription: 'people crossing road',
      };

    case 'dense_crowd':
      return {
        persons: [
          simulateDetectedPerson('p1', 0.5, 0.5, 0.5, 2.5),
          simulateDetectedPerson('p2', 0.3, 0.5, 0.45, 3.0),
          simulateDetectedPerson('p3', 0.7, 0.5, 0.45, 3.2),
          simulateDetectedPerson('p4', 0.4, 0.6, 0.4, 3.8),
          simulateDetectedPerson('p5', 0.6, 0.6, 0.4, 4.0),
          simulateDetectedPerson('p6', 0.2, 0.6, 0.35, 4.5),
          simulateDetectedPerson('p7', 0.8, 0.5, 0.35, 4.8),
        ],
        sceneDescription: 'crowded area many people walking',
      };

    case 'person_waving':
      return {
        persons: [simulateDetectedPerson('p1', 0.55, 0.4, 0.4, 5.0)],
        sceneDescription: 'person waving',
      };

    case 'person_falling':
      return {
        persons: [simulateDetectedPerson('p1', 0.5, 0.2, 0.7, 2.0)],
        sceneDescription: 'person falling on ground',
      };
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

/** Run the full social awareness pipeline for a single frame. */
export function analyzeSocialContext(input: SocialInput): SocialContext {
  // 1. Human behaviour analysis
  const nearbyPersons = analyzePersons(input.detectedPersons, input.sceneDescription);

  // 2. Crowd analysis
  const crowd = analyzeCrowd(nearbyPersons);

  // 3. Interaction prediction
  const predictions = predictAllInteractions(nearbyPersons, input.userMotion);

  // 4. Personal space check
  const personalSpaceClear = !nearbyPersons.some((p) => p.inPersonalSpace);

  // 5. Crowd warning
  const crowdWarning = crowdRiskWarning(crowd);

  // 6. Primary guidance
  const primaryGuidance = buildPrimaryGuidance(nearbyPersons, predictions, crowdWarning);

  // 7. Alerts
  const alerts = buildAlerts(nearbyPersons, predictions, crowdWarning);

  return {
    nearbyPersons,
    crowd,
    predictions,
    personalSpaceClear,
    primaryGuidance,
    alerts,
    timestamp: input.timestamp,
  };
}

/**
 * Run the social pipeline for a named simulation scenario.
 * Convenience wrapper used by SocialAwarenessPanel.
 */
export function analyzeSocialScenario(
  scenario: SocialScenario,
  userMotion: SocialInput['userMotion'] = 'walking'
): SocialContext {
  const { persons, sceneDescription } = simulateScenario(scenario);
  return analyzeSocialContext({
    detectedPersons: persons,
    sceneDescription,
    userMotion,
    timestamp: new Date(),
  });
}

// Re-export for convenience
export { highestRisk };
