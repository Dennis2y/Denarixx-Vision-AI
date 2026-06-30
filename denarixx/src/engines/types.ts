import type {
  VisionFrame,
  Detection,
  HazardAlert,
  SceneDescription,
  SafetyDecision,
  MemoryItem,
  NavigationGuidance,
  ConfidenceScore,
  ProviderCapabilities,
} from '@/types';

export type { ProviderCapabilities };

// ─── Provider abstraction ─────────────────────────────────────────────────────

export interface VisionProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  analyzeFrame(frame: VisionFrame): Promise<Detection[]>;
}

export interface HazardProvider {
  readonly name: string;
  evaluate(detections: Detection[]): Promise<HazardAlert[]>;
}

export interface SceneProvider {
  readonly name: string;
  describe(frame: VisionFrame, detections: Detection[]): Promise<SceneDescription>;
}

// ─── Engine interfaces ────────────────────────────────────────────────────────

export interface IVisionEngine {
  analyzeFrame(frame: VisionFrame): Promise<Detection[]>;
  getProvider(): VisionProvider;
}

export interface IHazardDetectionEngine {
  evaluate(detections: Detection[]): Promise<HazardAlert[]>;
}

export interface ISafetyDecisionEngine {
  decide(alerts: HazardAlert[]): SafetyDecision;
}

export interface ISceneReasoningEngine {
  describe(frame: VisionFrame, detections: Detection[]): Promise<SceneDescription>;
}

export interface IMemoryEngine {
  save(item: Omit<MemoryItem, 'id' | 'createdAt' | 'lastSeenAt'>): Promise<MemoryItem>;
  query(label: string): Promise<MemoryItem | null>;
  getAll(): Promise<MemoryItem[]>;
  recall(context: string): Promise<MemoryItem[]>;
}

export interface IConversationEngine {
  ask(question: string, context: SceneDescription | null): Promise<string>;
}

export interface INavigationEngine {
  guide(destination: string, currentScene: SceneDescription): Promise<NavigationGuidance>;
}

export interface IAudioGuidanceEngine {
  speak(text: string, priority?: 'critical' | 'high' | 'normal' | 'low'): void;
  stop(): void;
}

// ─── Confidence utilities ─────────────────────────────────────────────────────

export function confidenceLabel(score: ConfidenceScore): string {
  if (score >= 0.85) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

export function uncertaintyMessage(score: ConfidenceScore): string | undefined {
  if (score < 0.6) return "I'm not sure. Please check carefully.";
  if (score < 0.75) return "I'm not fully sure. Please check carefully.";
  return undefined;
}

export const SAFETY_DISCLAIMER =
  'This system provides assistive support only. It cannot guarantee your safety. Always use your own judgement.';
