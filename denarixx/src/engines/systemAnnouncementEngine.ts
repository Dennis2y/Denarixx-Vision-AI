/**
 * System Announcement Engine — Live Perception Hardening
 *
 * Produces human-friendly audio announcements for system events.
 * Removes all technical jargon from operational speech.
 *
 * BAD: "Provider failure, switching mode."
 * GOOD: "Online vision is unavailable. Offline safety mode is active."
 *
 * BAD: "Object detection confidence 0.86."
 * GOOD: "Obstacle ahead, slightly to your right."
 *
 * BAD: "Vision session started in simulation mode."
 * GOOD: "Ready. Scanning your surroundings."
 *
 * Pure TypeScript — no browser APIs, fully testable in Node.js.
 */

// ── Event types ───────────────────────────────────────────────────────────────

export type SystemEventType =
  | 'session-start-simulation'
  | 'session-start-camera'
  | 'session-start-local-ai'
  | 'session-start-cloud-ai'
  | 'session-stop'
  | 'camera-activated'
  | 'camera-stopped'
  | 'camera-denied'
  | 'camera-disconnected'
  | 'camera-reconnected'
  | 'mode-switch-to-simulation'
  | 'mode-switch-to-local-ai'
  | 'mode-switch-to-cloud-ai'
  | 'mode-switch-to-offline'
  | 'provider-cloud-unavailable'
  | 'provider-cloud-restored'
  | 'provider-model-loading'
  | 'provider-model-ready'
  | 'provider-model-failed'
  | 'internet-lost'
  | 'internet-restored'
  | 'internet-weak'
  | 'battery-low'
  | 'battery-critical'
  | 'battery-charging'
  | 'overheating'
  | 'overheating-cleared'
  | 'ocr-ready'
  | 'ocr-unavailable'
  | 'tts-unavailable'
  | 'stt-unavailable'
  | 'voice-commands-active'
  | 'wake-word-detected'
  | 'emergency-stop'
  | 'offline-safety-active'
  | 'offline-safety-cleared'
  | 'location-unavailable'
  | 'glasses-connected'
  | 'glasses-disconnected';

export type AnnouncementPriority = 'critical' | 'high' | 'normal' | 'low';

export interface SystemAnnouncement {
  text: string;
  priority: AnnouncementPriority;
  interrupt: boolean;
}

// ── Announcement map ──────────────────────────────────────────────────────────

const ANNOUNCEMENTS: Record<SystemEventType, SystemAnnouncement> = {
  'session-start-simulation': {
    text: 'Ready. Scanning your surroundings.',
    priority: 'high',
    interrupt: true,
  },
  'session-start-camera': {
    text: 'Ready. Camera is on and scanning.',
    priority: 'high',
    interrupt: true,
  },
  'session-start-local-ai': {
    text: 'Ready. On-device vision is active and scanning.',
    priority: 'high',
    interrupt: true,
  },
  'session-start-cloud-ai': {
    text: 'Ready. Advanced cloud vision is active.',
    priority: 'high',
    interrupt: true,
  },
  'session-stop': {
    text: 'Session ended. Stay safe.',
    priority: 'high',
    interrupt: true,
  },
  'camera-activated': {
    text: 'Camera is on. Visual scanning has started.',
    priority: 'normal',
    interrupt: false,
  },
  'camera-stopped': {
    text: 'Camera off.',
    priority: 'low',
    interrupt: false,
  },
  'camera-denied': {
    text: 'Camera access was denied. Scanning continues without a camera.',
    priority: 'high',
    interrupt: true,
  },
  'camera-disconnected': {
    text: 'Camera connection lost. Switching to offline safety mode.',
    priority: 'high',
    interrupt: true,
  },
  'camera-reconnected': {
    text: 'Camera is back. Resuming visual scan.',
    priority: 'normal',
    interrupt: false,
  },
  'mode-switch-to-simulation': {
    text: 'Switched to simulation mode.',
    priority: 'normal',
    interrupt: false,
  },
  'mode-switch-to-local-ai': {
    text: 'On-device vision is now active.',
    priority: 'normal',
    interrupt: false,
  },
  'mode-switch-to-cloud-ai': {
    text: 'Advanced cloud vision is now active.',
    priority: 'normal',
    interrupt: false,
  },
  'mode-switch-to-offline': {
    text: 'Offline safety mode is now active.',
    priority: 'high',
    interrupt: true,
  },
  'provider-cloud-unavailable': {
    text: 'Online vision is unavailable. Offline safety mode is active.',
    priority: 'high',
    interrupt: true,
  },
  'provider-cloud-restored': {
    text: 'Online vision is available again.',
    priority: 'normal',
    interrupt: false,
  },
  'provider-model-loading': {
    text: 'Loading on-device vision. This takes a few seconds.',
    priority: 'low',
    interrupt: false,
  },
  'provider-model-ready': {
    text: 'On-device vision is ready.',
    priority: 'normal',
    interrupt: false,
  },
  'provider-model-failed': {
    text: "On-device vision couldn't load. Using basic safety detection instead.",
    priority: 'high',
    interrupt: true,
  },
  'internet-lost': {
    text: 'No internet connection. Offline safety mode is active.',
    priority: 'high',
    interrupt: true,
  },
  'internet-restored': {
    text: 'Internet connection restored.',
    priority: 'normal',
    interrupt: false,
  },
  'internet-weak': {
    text: 'Internet connection is weak. Reducing cloud features to save battery.',
    priority: 'normal',
    interrupt: false,
  },
  'battery-low': {
    text: 'Battery is low. Reducing scan frequency to extend battery life.',
    priority: 'normal',
    interrupt: false,
  },
  'battery-critical': {
    text: 'Battery is very low. Core safety features remain active.',
    priority: 'high',
    interrupt: true,
  },
  'battery-charging': {
    text: 'Charging detected. Resuming full scan mode.',
    priority: 'low',
    interrupt: false,
  },
  'overheating': {
    text: 'Device is warm. Reducing processing to stay safe.',
    priority: 'high',
    interrupt: true,
  },
  'overheating-cleared': {
    text: 'Temperature is back to normal. Full scanning resumed.',
    priority: 'low',
    interrupt: false,
  },
  'ocr-ready': {
    text: 'Text reading is ready.',
    priority: 'low',
    interrupt: false,
  },
  'ocr-unavailable': {
    text: 'Text reading is unavailable. Vision and hazard detection continue.',
    priority: 'normal',
    interrupt: false,
  },
  'tts-unavailable': {
    text: 'Audio output is unavailable. Haptic alerts remain active.',
    priority: 'high',
    interrupt: false,
  },
  'stt-unavailable': {
    text: 'Voice commands are unavailable. Controls remain accessible.',
    priority: 'normal',
    interrupt: false,
  },
  'voice-commands-active': {
    text: 'Voice commands are ready.',
    priority: 'low',
    interrupt: false,
  },
  'wake-word-detected': {
    text: 'Listening.',
    priority: 'high',
    interrupt: true,
  },
  'emergency-stop': {
    text: 'Stopping. All alerts have been cleared.',
    priority: 'critical',
    interrupt: true,
  },
  'offline-safety-active': {
    text: 'Offline safety mode is active. Core hazard detection continues.',
    priority: 'high',
    interrupt: true,
  },
  'offline-safety-cleared': {
    text: 'Online features are available again.',
    priority: 'normal',
    interrupt: false,
  },
  'location-unavailable': {
    text: 'Location services are unavailable. Navigation continues without GPS.',
    priority: 'normal',
    interrupt: false,
  },
  'glasses-connected': {
    text: 'Glasses are connected.',
    priority: 'normal',
    interrupt: false,
  },
  'glasses-disconnected': {
    text: 'Glasses connection lost. Switching to phone camera mode.',
    priority: 'high',
    interrupt: true,
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

export function getSystemAnnouncement(event: SystemEventType): SystemAnnouncement {
  return ANNOUNCEMENTS[event];
}

export function getSessionStartAnnouncement(
  visionMode: 'simulation' | 'local-ai' | 'cloud-ai',
  cameraActive: boolean,
): SystemAnnouncement {
  if (!cameraActive && visionMode === 'simulation') {
    return ANNOUNCEMENTS['session-start-simulation'];
  }
  if (visionMode === 'local-ai') return ANNOUNCEMENTS['session-start-local-ai'];
  if (visionMode === 'cloud-ai') return ANNOUNCEMENTS['session-start-cloud-ai'];
  if (cameraActive) return ANNOUNCEMENTS['session-start-camera'];
  return ANNOUNCEMENTS['session-start-simulation'];
}

/**
 * Format an OCR text reading as a human announcement.
 * Never exposes raw confidence numbers.
 */
export function formatOCRAnnouncement(
  domain: string,
  text: string,
  confidence: 'high' | 'medium' | 'low',
  isHazard: boolean,
): string {
  const prefix = buildOCRPrefix(domain, isHazard);
  const qualifier = buildConfidenceQualifier(confidence);
  const body = text.slice(0, 120).trim();
  return qualifier ? `${prefix}: ${body}. ${qualifier}` : `${prefix}: ${body}.`;
}

function buildOCRPrefix(domain: string, isHazard: boolean): string {
  if (isHazard) return 'Warning sign';
  switch (domain) {
    case 'sign':     return 'Sign ahead';
    case 'street':   return 'Street name';
    case 'medicine': return 'Medicine label';
    case 'menu':     return 'Menu';
    case 'receipt':  return 'Receipt';
    case 'document': return 'Document';
    default:         return 'Text nearby';
  }
}

function buildConfidenceQualifier(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':   return '';
    case 'medium': return 'Please verify.';
    case 'low':    return 'This is approximate — please check carefully.';
  }
}

/**
 * Convert a technical status code to a human sentence.
 */
export function describeProviderStatus(
  stage: string,
  status: 'ready' | 'loading' | 'error' | 'unavailable' | 'disabled',
): string {
  const stageLabel: Record<string, string> = {
    camera:    'the camera',
    vision:    'on-device vision',
    ocr:       'text reading',
    guardian:  'hazard detection',
    navigation:'navigation',
    voice:     'audio output',
  };
  const label = stageLabel[stage] ?? stage;
  switch (status) {
    case 'ready':       return `${capitalise(label)} is ready.`;
    case 'loading':     return `${capitalise(label)} is starting up. Please wait.`;
    case 'error':       return `${capitalise(label)} encountered a problem.`;
    case 'unavailable': return `${capitalise(label)} is not available right now.`;
    case 'disabled':    return `${capitalise(label)} is turned off.`;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Human-readable mode description (no technical identifiers).
 */
export function describeVisionModeHuman(mode: 'simulation' | 'local-ai' | 'cloud-ai'): string {
  switch (mode) {
    case 'simulation': return 'Simulation mode — no camera needed.';
    case 'local-ai':   return 'On-device vision — camera active, no internet needed.';
    case 'cloud-ai':   return 'Advanced cloud vision — camera active with internet.';
  }
}
