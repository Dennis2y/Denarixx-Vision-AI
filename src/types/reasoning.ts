// V3 Cognitive Reasoning Engine — type definitions

export type ReasoningRiskLevel =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'informational'
  | 'none';

export type ReasoningAction =
  | 'continue_walking'
  | 'slow_down'
  | 'stop'
  | 'turn_left'
  | 'turn_right'
  | 'move_left'
  | 'move_right'
  | 'wait'
  | 'cross_now'
  | 'avoid_obstacle'
  | 'none';

export type ReasoningPriority = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type EnvironmentType =
  | 'pavement'
  | 'crossing'
  | 'supermarket'
  | 'train_station'
  | 'corridor'
  | 'traffic'
  | 'market'
  | 'unknown';

// ─── Engine outputs ───────────────────────────────────────────────────────────

export interface EnvironmentUnderstanding {
  summary: string;
  environmentType: EnvironmentType;
  confidence: number;
  detectedLabels: string[];
  isIndoor: boolean;
}

export interface CognitiveReasoning {
  whatIsHappening: string;
  whatIsLikelyNext: string;
  isUserSafe: boolean;
  needsGuidance: boolean;
  shouldStaySilent: boolean;
  shouldInterruptImmediately: boolean;
  shouldReassure: boolean;
  shouldPredictDanger: boolean;
  confidence: number;
}

export interface V3RiskPrediction {
  predictedEvent: string | null;
  riskLevel: ReasoningRiskLevel;
  confidence: number;
  factors: string[];
  timeToImpactSeconds: number | null;
}

export interface ActionDecision {
  action: ReasoningAction;
  instruction: string;
  priority: ReasoningPriority;
  confidence: number;
  shouldInterrupt: boolean;
  reasoning: string;
}

export interface HumanGuideMessage {
  text: string;
  priority: ReasoningPriority;
  shouldSpeak: boolean;
  uncertaintyNote: string | null;
}

// ─── Combined pipeline result ─────────────────────────────────────────────────

export interface V3ReasoningResult {
  environment: EnvironmentUnderstanding;
  reasoning: CognitiveReasoning;
  riskPrediction: V3RiskPrediction;
  action: ActionDecision;
  guideMessage: HumanGuideMessage;
  processingTimeMs: number;
}
