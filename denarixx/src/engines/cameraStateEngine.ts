// ─── V3 (Sprint 3) Camera State Engine ───────────────────────────────────────
// Pure functions — no async, no I/O, no browser APIs.
// Encodes camera status machine logic, source-mode selection, and privacy rules.
// CameraStatus is defined here and re-exported through useCameraCapture.

// Camera input status — drives the UI state machine and frame-source selection:
//   inactive    → not started; session uses simulation
//   requesting  → permission prompt shown to user
//   active      → stream live; frames captured and sent to /api/vision/analyze-frame
//   denied      → browser denied permission; session falls back to simulation
//   fallback    → camera WAS active but stream was lost mid-session; falls back to simulation
export type CameraStatus = 'inactive' | 'requesting' | 'active' | 'denied' | 'fallback';

export const CAMERA_STATUS_LABELS: Record<CameraStatus, { full: string; compact: string }> = {
  inactive:   { full: 'Camera Inactive',                          compact: 'Inactive'       },
  requesting: { full: 'Requesting Permission…',                   compact: 'Requesting…'    },
  active:     { full: 'Camera Active',                            compact: 'Live'            },
  denied:     { full: 'Permission Denied · Simulation Fallback',  compact: 'Denied — Sim'   },
  fallback:   { full: 'Camera Lost · Simulation Fallback',        compact: 'Fallback — Sim' },
};

/**
 * Returns whether the session should capture real camera frames or use simulation.
 * Only 'active' produces real frames — every other status uses simulation.
 */
export function getCameraSourceMode(status: CameraStatus): 'camera' | 'simulation' {
  return status === 'active' ? 'camera' : 'simulation';
}

/** Human-readable mode description for the session header / status line. */
export function getCameraModeLabel(status: CameraStatus): string {
  switch (status) {
    case 'active':     return 'Camera mode — live frames being analysed';
    case 'requesting': return 'Camera requesting — please allow access in your browser';
    case 'denied':     return 'Camera denied — simulation fallback active';
    case 'fallback':   return 'Camera lost — simulation fallback active. Click Retry Camera to reconnect.';
    case 'inactive':   return 'Simulation mode — click Start Camera to use your device camera';
  }
}

/** True when the session is using synthetic/simulated data instead of real camera frames. */
export function isSimulationMode(status: CameraStatus): boolean {
  return status !== 'active';
}

/**
 * True only when the camera WAS active and then lost its stream mid-session.
 * Distinct from 'denied' (permission never granted) — retrying the camera is meaningful.
 */
export function isCameraFallback(status: CameraStatus): boolean {
  return status === 'fallback';
}

/** Privacy constraints enforced by the camera pipeline — hard rules, never configurable. */
export const CAMERA_PRIVACY_RULES = {
  /** Frames are never written to disk, IndexedDB, localStorage, or any persistent store. */
  noVideoStorage: true,
  /** Face recognition is unconditionally disabled — only scene/object-level detection. */
  noFaceRecognition: true,
  /** Audio is never captured (audio: false in getUserMedia constraints). */
  noAudioCapture: true,
  /** JPEG quality used when encoding a frame before sending to the analysis API. */
  jpegCompressionQuality: 0.7,
  /** getUserMedia width constraint; limits data volume per frame. */
  maxFrameWidthPx: 640,
  /** Text embedded in privacy notices shown to users. */
  framePurposeDescription: 'Assistive scene analysis only — frames are not retained after processing',
} as const;

/** Audit-trail description of the current camera input state. */
export function getCameraInputDescription(status: CameraStatus, frameCount: number): string {
  if (status === 'active') {
    return `Real camera — ${frameCount} frame${frameCount === 1 ? '' : 's'} analysed (no storage)`;
  }
  return 'Simulation — no real camera data used';
}

/** State transition: which statuses allow requesting camera access? */
export function canStartCamera(status: CameraStatus): boolean {
  return status === 'inactive' || status === 'denied' || status === 'fallback';
}

/** State transition: which statuses allow stopping the camera? */
export function canStopCamera(status: CameraStatus): boolean {
  return status === 'active' || status === 'requesting';
}

/** Returns a spoken announcement appropriate to the camera status transition. */
export function getCameraStatusAnnouncement(status: CameraStatus): string {
  switch (status) {
    case 'active':     return 'Camera active. Real camera frames will be used for scene analysis.';
    case 'denied':     return 'Camera access denied. Session will use simulation mode.';
    case 'fallback':   return 'Camera connection lost. Switching to simulation mode. You may retry camera.';
    case 'inactive':   return 'Camera stopped. Session is in simulation mode.';
    case 'requesting': return 'Requesting camera access. Please check your browser prompt.';
  }
}
