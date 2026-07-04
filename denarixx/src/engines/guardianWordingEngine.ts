/**
 * GuardianWordingEngine — Sprint 5
 *
 * Generates specific, directional, actionable alert messages.
 *
 * Goal: replace generic phrases like "hazard detected" with messages that tell
 * the user WHAT is there and WHAT to do — e.g. "Obstacle ahead. Move slightly right."
 *
 * Directional hints are added when a bounding box is available (x < 0.3 → left,
 * x > 0.7 → right). Without a box, direction defaults to "ahead".
 *
 * Pure functions — no I/O, no async.
 */

import type { Detection } from '@/types';
import type { DetectedCategories } from '@/types/vision';

export interface WordingInput {
  hazardType: string;
  severity: string;
  confidence: number;
  detection?: Detection;          // optional: used for directional hint from bounding box
  categories?: DetectedCategories; // optional: used to add context (e.g. crossing = road nearby)
  isReturn?: boolean;             // true → "back" phrasing (e.g. "Vehicle has returned")
}

type SeverityKey = 'critical' | 'high' | 'medium' | 'low';

interface MessageSet {
  critical?: string;
  high: string;
  medium: string;
  low: string;
}

const MESSAGE_TEMPLATES: Record<string, MessageSet> = {
  vehicle: {
    critical: 'Stop — vehicle approaching fast. Do not move.',
    high:     'Vehicle ahead. Slow down and prepare to stop.',
    medium:   'Vehicle in the area. Stay to the side of the path.',
    low:      'Vehicle detected. Stay alert.',
  },
  car: {
    critical: 'Stop — car approaching fast.',
    high:     'Car ahead. Slow down and wait.',
    medium:   'Car nearby. Keep to the side.',
    low:      'Car detected.',
  },
  bus: {
    critical: 'Stop — bus approaching.',
    high:     'Bus ahead. Wait for it to pass.',
    medium:   'Bus nearby. Stay well to the side.',
    low:      'Bus detected.',
  },
  truck: {
    critical: 'Stop — large vehicle approaching.',
    high:     'Truck ahead. Slow down and wait.',
    medium:   'Truck nearby. Keep well clear.',
    low:      'Truck detected.',
  },
  bicycle: {
    critical: 'Stop — cyclist approaching fast.',
    high:     'Cyclist nearby. Move to the side and wait.',
    medium:   'Cyclist may cross your path. Slow down.',
    low:      'Cyclist in the area.',
  },
  cyclist: {
    critical: 'Stop — cyclist approaching fast.',
    high:     'Cyclist nearby. Move to the side and wait.',
    medium:   'Cyclist may cross your path. Slow down.',
    low:      'Cyclist in the area.',
  },
  motorcycle: {
    critical: 'Stop — motorcycle approaching.',
    high:     'Motorcycle nearby. Slow down and wait.',
    medium:   'Motorcycle in the area.',
    low:      'Motorcycle detected.',
  },
  stairs: {
    critical: 'Stairs directly ahead — stop now.',
    high:     'Stairs ahead. Slow down and reach for a railing.',
    medium:   'Stairs coming up. Reduce your pace.',
    low:      'Stairs nearby. Approach with care.',
  },
  staircase: {
    critical: 'Staircase directly ahead — stop now.',
    high:     'Staircase ahead. Slow down and reach for a railing.',
    medium:   'Staircase coming up. Reduce your pace.',
    low:      'Staircase nearby.',
  },
  step: {
    critical: 'Step down directly ahead — stop and check.',
    high:     'Step ahead. Slow down and check with your foot.',
    medium:   'Elevation change ahead. Step carefully.',
    low:      'Possible step change ahead.',
  },
  escalator: {
    high:   'Escalator ahead. Reach for the handrail before stepping on.',
    medium: 'Escalator coming up. Slow down.',
    low:    'Escalator nearby.',
  },
  obstacle: {
    critical: 'Obstacle directly in your path — stop immediately.',
    high:     'Obstacle in your path. Move to the side.',
    medium:   'Something is blocking your path. Slow down.',
    low:      'Possible obstacle ahead.',
  },
  barrier: {
    critical: 'Barrier directly ahead — stop.',
    high:     'Barrier in your path. Move around it.',
    medium:   'Barrier nearby.',
    low:      'Barrier detected.',
  },
  person: {
    critical: 'Person directly in your path — stop.',
    high:     'Someone is blocking your way. Navigate around them.',
    medium:   'Person ahead. Allow space to pass.',
    low:      'Someone nearby.',
  },
  pedestrian: {
    critical: 'Pedestrian directly ahead — stop.',
    high:     'Pedestrian in your path. Navigate around them.',
    medium:   'Pedestrian nearby.',
    low:      'Someone in the area.',
  },
  door: {
    critical: 'Door or barrier directly ahead — stop.',
    high:     'Door ahead. Reach forward to find the handle.',
    medium:   'Door ahead.',
    low:      'Entrance or door nearby.',
  },
  gate: {
    high:   'Gate ahead. Find the latch or opening.',
    medium: 'Gate nearby.',
    low:    'Gate detected.',
  },
  crossing: {
    critical: 'Road crossing directly ahead — stop and listen carefully.',
    high:     'Crossing ahead. Stop and wait for a safe gap.',
    medium:   'Road crossing coming up. Be ready to stop.',
    low:      'Crossing nearby. Approach with care.',
  },
  road: {
    critical: 'Road directly ahead — stop immediately.',
    high:     'Road ahead. Stop and listen for traffic.',
    medium:   'Road coming up. Slow down.',
    low:      'Road nearby.',
  },
  intersection: {
    critical: 'Intersection ahead — stop and listen.',
    high:     'Intersection coming up. Stop and check for traffic.',
    medium:   'Intersection nearby. Slow down.',
    low:      'Intersection ahead.',
  },
  sign: {
    high:   'Traffic sign or signal ahead. Slow down.',
    medium: 'Sign ahead.',
    low:    'Sign in the area.',
  },
  traffic_light: {
    high:   'Traffic light ahead. Stop and wait for the signal.',
    medium: 'Traffic light nearby.',
    low:    'Signal ahead.',
  },
  signal: {
    high:   'Signal ahead. Wait for safe indication.',
    medium: 'Signal nearby.',
    low:    'Signal detected.',
  },
};

const DIRECTION_SUFFIXES: Record<string, string> = {
  left:  ' It appears to be on your left.',
  right: ' It appears to be on your right.',
  ahead: '',
};

const RETURN_PREFIXES: Record<string, string> = {
  vehicle: 'Vehicle has returned. ',
  stairs:  'Stairs ahead again. ',
  step:    'Another step ahead. ',
  obstacle:'Obstacle has returned. ',
  person:  'Someone has returned to your path. ',
};

function getDirection(detection?: Detection): 'left' | 'right' | 'ahead' {
  if (!detection?.boundingBox) return 'ahead';
  const cx = detection.boundingBox.x + detection.boundingBox.width / 2;
  if (cx < 0.35) return 'left';
  if (cx > 0.65) return 'right';
  return 'ahead';
}

function getTemplate(hazardType: string, severity: string): string {
  const type = hazardType.toLowerCase().trim();
  const sev = severity.toLowerCase().trim() as SeverityKey;
  const set = MESSAGE_TEMPLATES[type];

  if (!set) {
    // Generic fallback — never uses "hazard detected"
    if (sev === 'critical') return `Stop — ${type} directly ahead.`;
    if (sev === 'high')     return `${capitalise(type)} ahead. Slow down and proceed with care.`;
    if (sev === 'medium')   return `${capitalise(type)} nearby. Stay alert.`;
    return `${capitalise(type)} detected in the area.`;
  }

  return (set as unknown as Record<string, string>)[sev] ?? set.medium;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Add confidence-based uncertainty prefix for low-confidence detections */
function applyUncertaintyPrefix(message: string, confidence: number): string {
  if (confidence >= 0.7) return message;
  if (confidence >= 0.5) return `There may be something ahead. ${message}`;
  return `I'm not certain, but ${message.charAt(0).toLowerCase() + message.slice(1)}`;
}

export class GuardianWordingEngine {
  /**
   * Generate a specific, directional alert message.
   * Never returns "hazard detected" — always actionable.
   */
  generate(input: WordingInput): string {
    const returnPrefix = input.isReturn
      ? (RETURN_PREFIXES[input.hazardType.toLowerCase()] ?? `${capitalise(input.hazardType)} has returned. `)
      : '';

    const baseMessage = getTemplate(input.hazardType, input.severity);
    const direction = getDirection(input.detection);
    const directionSuffix = DIRECTION_SUFFIXES[direction] ?? '';

    const message = `${returnPrefix}${baseMessage}${directionSuffix}`;
    return applyUncertaintyPrefix(message, input.confidence);
  }

  /**
   * Generate a message from the highest-priority occupied category.
   * Used when the provider returns categories but no explicit hazard type.
   */
  generateFromCategories(
    categories: DetectedCategories,
    severity: string,
    confidence: number
  ): string {
    // Priority: vehicles > stairs > crossings > obstacles > people > doors > signs
    if (categories.vehicles.length > 0) {
      const top = categories.vehicles[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.stairs.length > 0) {
      const top = categories.stairs[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.crossings.length > 0) {
      const top = categories.crossings[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.obstacles.length > 0) {
      const top = categories.obstacles[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.people.length > 0) {
      const top = categories.people[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.doors.length > 0) {
      const top = categories.doors[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    if (categories.signs.length > 0) {
      const top = categories.signs[0];
      return this.generate({ hazardType: top.label, severity, confidence, detection: top });
    }
    return this.generate({ hazardType: 'obstacle', severity, confidence });
  }
}
