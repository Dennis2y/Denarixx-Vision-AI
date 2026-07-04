/**
 * ActionDecisionEngine (V3)
 *
 * Maps the output of CognitiveReasoningEngine + RiskPredictionEngine to a
 * concrete recommended action and a human-readable instruction for the user.
 *
 * Possible actions:
 *   continue_walking · slow_down · stop · turn_left · turn_right
 *   move_left · move_right · wait · cross_now · avoid_obstacle · none
 */

import type {
  ActionDecision,
  CognitiveReasoning,
  EnvironmentType,
  EnvironmentUnderstanding,
  ReasoningAction,
  ReasoningPriority,
  V3RiskPrediction,
} from '@/types/reasoning';

interface ActionRule {
  condition: (
    r: CognitiveReasoning,
    risk: V3RiskPrediction,
    env: EnvironmentUnderstanding
  ) => boolean;
  action: ReasoningAction;
  instruction: string;
  priority: ReasoningPriority;
  shouldInterrupt: boolean;
  reasoning: string;
}

const TRAFFIC_TYPES = new Set<EnvironmentType>(['traffic', 'crossing']);

const ACTION_RULES: ActionRule[] = [
  // Critical — always stop
  {
    condition: (_r, risk) => risk.riskLevel === 'critical',
    action: 'stop',
    instruction: 'Stop immediately — do not move.',
    priority: 'critical',
    shouldInterrupt: true,
    reasoning: 'Critical hazard detected — stopping is the safest response.',
  },
  // High risk in traffic — wait for clear gap
  {
    condition: (_r, risk, env) =>
      risk.riskLevel === 'high' && TRAFFIC_TYPES.has(env.environmentType),
    action: 'wait',
    instruction: 'Wait — traffic present. Do not cross until it is clear.',
    priority: 'high',
    shouldInterrupt: true,
    reasoning: 'High-risk traffic environment — waiting for a safe gap.',
  },
  // High risk — slow down and be cautious
  {
    condition: (_r, risk) => risk.riskLevel === 'high',
    action: 'slow_down',
    instruction: 'Slow down and proceed with caution.',
    priority: 'high',
    shouldInterrupt: true,
    reasoning: 'High risk detected — reducing pace improves reaction time.',
  },
  // Medium risk at crossing — pause
  {
    condition: (_r, risk, env) =>
      risk.riskLevel === 'medium' && TRAFFIC_TYPES.has(env.environmentType),
    action: 'wait',
    instruction: 'Pause and wait for the crossing to clear.',
    priority: 'medium',
    shouldInterrupt: false,
    reasoning: 'Medium risk at crossing — waiting is safer than crossing now.',
  },
  // Medium risk with obstacle in corridor/unknown
  {
    condition: (_r, risk, env) =>
      risk.riskLevel === 'medium' &&
      (env.environmentType === 'corridor' || env.environmentType === 'unknown'),
    action: 'avoid_obstacle',
    instruction: 'Move carefully around the obstacle ahead.',
    priority: 'medium',
    shouldInterrupt: false,
    reasoning: 'Obstacle detected in path — navigate around it.',
  },
  // Medium risk — general slow down
  {
    condition: (_r, risk) => risk.riskLevel === 'medium',
    action: 'slow_down',
    instruction: 'Reduce your pace — something ahead needs attention.',
    priority: 'medium',
    shouldInterrupt: false,
    reasoning: 'Medium-level risk — careful movement advised.',
  },
  // Low risk — slight caution
  {
    condition: (_r, risk) => risk.riskLevel === 'low',
    action: 'slow_down',
    instruction: 'Keep going, but stay aware — something minor is nearby.',
    priority: 'low',
    shouldInterrupt: false,
    reasoning: 'Low-level risk only — awareness without urgency.',
  },
  // Safe and reassurable — affirm and continue
  {
    condition: (r) => r.shouldReassure && r.isUserSafe,
    action: 'continue_walking',
    instruction: 'The path is clear. Continue walking.',
    priority: 'informational',
    shouldInterrupt: false,
    reasoning: 'No hazards detected — environment is safe.',
  },
  // Default — carry on
  {
    condition: () => true,
    action: 'continue_walking',
    instruction: 'Continue forward.',
    priority: 'informational',
    shouldInterrupt: false,
    reasoning: 'No significant hazard identified.',
  },
];

export class ActionDecisionEngine {
  decide(
    reasoning: CognitiveReasoning,
    risk: V3RiskPrediction,
    environment: EnvironmentUnderstanding
  ): ActionDecision {
    const rule = ACTION_RULES.find((r) => r.condition(reasoning, risk, environment));
    const r = rule ?? ACTION_RULES[ACTION_RULES.length - 1];

    return {
      action: r.action,
      instruction: r.instruction,
      priority: r.priority,
      confidence: reasoning.confidence,
      shouldInterrupt: r.shouldInterrupt,
      reasoning: r.reasoning,
    };
  }
}
