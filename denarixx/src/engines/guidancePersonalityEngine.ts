/**
 * GuidancePersonalityEngine (V5)
 *
 * Shapes audio guidance messages to match a user-chosen personality.
 * Pure engine — no async, no I/O. Works independently of any UI.
 *
 * Personalities:
 *   minimal   — only critical/high alerts; very short terse messages
 *   balanced  — standard messages; medium risk and above
 *   detailed  — all messages; full descriptions kept
 *   companion — warm tone; natural language; regular calm reassurance
 */

export type GuidancePersonality = 'minimal' | 'balanced' | 'detailed' | 'companion';
export type PersonalityRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

const COMPANION_REASSURANCES = [
  "You're doing well. I'm watching your surroundings carefully.",
  "All clear ahead. Take your time.",
  "I'm here with you. Your path looks clear right now.",
  "No hazards visible. Feel free to continue at your own pace.",
  "You're moving safely. I'll let you know if anything changes.",
  "Your surroundings look calm. I'm keeping watch.",
];

const RISK_RANK: Record<PersonalityRiskLevel, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export class GuidancePersonalityEngine {
  private reassuranceIndex = 0;

  /**
   * Returns true if a message at this risk level should be spoken
   * for the given personality.
   */
  shouldSpeak(riskLevel: PersonalityRiskLevel, personality: GuidancePersonality): boolean {
    const rank = RISK_RANK[riskLevel] ?? 0;
    switch (personality) {
      case 'minimal':
        return rank >= RISK_RANK['high']; // critical and high only
      case 'balanced':
        return rank >= RISK_RANK['medium']; // medium, high, critical
      case 'detailed':
        return rank >= RISK_RANK['low']; // everything except none
      case 'companion':
        return rank >= RISK_RANK['low']; // everything except none
      default:
        return rank >= RISK_RANK['medium'];
    }
  }

  /**
   * Formats a guidance message to suit the personality.
   */
  formatMessage(
    message: string,
    personality: GuidancePersonality,
    riskLevel: PersonalityRiskLevel
  ): string {
    switch (personality) {
      case 'minimal': {
        // Keep only the first sentence; strip parenthetical explanations
        const firstSentence = message.split(/[.!?]/)[0]?.trim() ?? message;
        return firstSentence.length > 0 ? firstSentence + '.' : message;
      }

      case 'balanced':
        return message;

      case 'detailed':
        return message;

      case 'companion': {
        // Add a warm prefix for non-critical alerts; use direct tone for critical
        if (riskLevel === 'critical') {
          return message;
        }
        if (riskLevel === 'high') {
          return `Heads up — ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
        }
        if (riskLevel === 'medium') {
          return `I can see something — ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
        }
        return message;
      }

      default:
        return message;
    }
  }

  /**
   * Returns a calm reassurance message.
   * Companion mode uses these during quiet periods.
   */
  getReassurance(personality: GuidancePersonality): string {
    if (personality !== 'companion') {
      return "Path looks clear. Continue.";
    }
    const msg = COMPANION_REASSURANCES[this.reassuranceIndex % COMPANION_REASSURANCES.length];
    this.reassuranceIndex++;
    return msg;
  }

  /**
   * Should a periodic reassurance be spoken?
   * Companion: yes. Others: no.
   */
  shouldReassure(personality: GuidancePersonality, secondsSinceLastAlert: number): boolean {
    if (personality !== 'companion') return false;
    return secondsSinceLastAlert >= 30;
  }

  /**
   * Brief explanation of why a message was silenced.
   */
  getSilenceReason(riskLevel: PersonalityRiskLevel, personality: GuidancePersonality): string {
    const rank = RISK_RANK[riskLevel] ?? 0;
    if (personality === 'minimal' && rank < RISK_RANK['high']) {
      return `Risk level ${riskLevel} is below minimal threshold (high required)`;
    }
    if (personality === 'balanced' && rank < RISK_RANK['medium']) {
      return `Risk level ${riskLevel} is below balanced threshold (medium required)`;
    }
    return `Silenced by ${personality} personality`;
  }

  reset() {
    this.reassuranceIndex = 0;
  }
}
