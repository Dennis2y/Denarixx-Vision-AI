// V2 Cognitive Guardian — type definitions

export type AlertFatigue = 'none' | 'low' | 'medium' | 'high';
export type UserActivity = 'walking' | 'stopped' | 'turning' | 'crossing' | 'unknown';
export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type RoutinePhase = 'morning' | 'afternoon' | 'evening' | 'night';

export interface ProactiveAlert {
  id: string;
  message: string;
  riskLevel: RiskLevel;
  confidence: number;
  anticipatedIn: number; // seconds until hazard may materialise
  triggerLabel: string;
  timestamp: Date;
}

export interface SilenceDecision {
  shouldSilence: boolean;
  reason: string;
  fatigueLevel: AlertFatigue;
  silenceDurationMs: number;
}

export interface RiskPrediction {
  predictedRisk: RiskLevel;
  confidence: number;
  timeHorizonSeconds: number;
  factors: string[];
  reasoning: string;
}

export interface UserContext {
  activity: UserActivity;
  sessionDurationSeconds: number;
  alertsInLastMinute: number;
  lastAlertTimestamp: Date | null;
  isIndoors: boolean;
  confidence: number;
}

export interface RoutineEntry {
  id: string;
  label: string;
  timeOfDay: RoutinePhase;
  frequency: number;
  lastObserved: Date;
  associatedLocations: string[];
}

export interface GuardianDecision {
  shouldAlert: boolean;
  shouldSilence: boolean;
  proactiveAlerts: ProactiveAlert[];
  riskPrediction: RiskPrediction;
  userContext: UserContext;
  message: string | null;
  confidence: number;
  reasoning: string;
}
