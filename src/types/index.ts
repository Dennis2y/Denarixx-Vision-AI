// ─── Core domain types for Denarixx Vision AI ────────────────────────────────

export type ConfidenceScore = number; // 0–1

export type HazardSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Detection {
  label: string;
  confidence: ConfidenceScore;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface HazardAlert {
  id: string;
  type: string;
  description: string;
  severity: HazardSeverity;
  confidence: ConfidenceScore;
  timestamp: Date;
  shouldInterrupt: boolean;
  disclaimer: string;
}

export interface SceneDescription {
  summary: string;
  confidence: ConfidenceScore;
  detections: Detection[];
  timestamp: Date;
  isUncertain: boolean;
  uncertaintyMessage?: string;
}

export interface SafetyDecision {
  shouldAlert: boolean;
  urgency: HazardSeverity | 'none';
  message: string;
  confidence: ConfidenceScore;
  interruptNarration: boolean;
}

export interface MemoryItem {
  id: string;
  type: 'location' | 'person' | 'route' | 'preference' | 'object';
  label: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface SessionEvent {
  type:
    | 'hazard'
    | 'scene'
    | 'navigation'
    | 'memory'
    | 'system'
    | 'error'
    | 'uncertainty';
  payload: unknown;
  timestamp: Date;
  sessionId: string;
}

export interface VisionFrame {
  imageData?: string; // base64 or URL
  timestamp: Date;
  source: 'camera' | 'simulation' | 'upload';
  metadata?: Record<string, unknown>;
}

export interface ProviderCapabilities {
  hazardDetection: boolean;
  sceneDescription: boolean;
  objectRecognition: boolean;
  faceRecognition: false; // always false in Phase 1
  confidence: boolean;
}

export interface AudioGuidanceRequest {
  text: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  interrupt: boolean;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface NavigationGuidance {
  instruction: string;
  confidence: ConfidenceScore;
  isUncertain: boolean;
  disclaimer: string;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: Date;
  duration: number; // seconds
  alertCount: number;
  frameCount: number;
  avgHazardLatency: number; // ms
  confidenceDistribution: { low: number; medium: number; high: number };
  memoryItemsSaved: number;
}
