import type { HazardAlert } from '@/types';
import type {
  IProactiveAlertEngine,
  UserState,
} from '@/types/cognitive';

const CRITICAL_COOLDOWN_MS = 4000;
const HIGH_COOLDOWN_MS = 8000;
const NORMAL_COOLDOWN_MS = 12000;

export class ProactiveAlertEngine implements IProactiveAlertEngine {
  shouldAlert(
    alerts: HazardAlert[],
    userState: UserState,
    lastAlertMs: number
  ): { alert: boolean; urgency: 'critical' | 'high' | 'normal' | null } {
    if (alerts.length === 0) return { alert: false, urgency: null };

    const msSinceLast = Date.now() - lastAlertMs;
    const critical = alerts.find((a) => a.severity === 'critical');
    const high = alerts.find((a) => a.severity === 'high');
    const top = alerts[0];

    // Critical alerts always fire if confidence is sufficient
    if (critical && critical.confidence >= 0.55) {
      if (msSinceLast >= CRITICAL_COOLDOWN_MS || userState.movement === 'emergency') {
        return { alert: true, urgency: 'critical' };
      }
    }

    // High alerts fire unless user is in safe stationary state in cooldown
    if (high && high.confidence >= 0.6) {
      if (msSinceLast >= HIGH_COOLDOWN_MS) {
        return { alert: true, urgency: 'high' };
      }
    }

    // Normal alerts only when user is walking and enough time has passed
    if (top.confidence >= 0.7 && userState.movement === 'walking') {
      if (msSinceLast >= NORMAL_COOLDOWN_MS) {
        return { alert: true, urgency: 'normal' };
      }
    }

    return { alert: false, urgency: null };
  }
}

let _instance: ProactiveAlertEngine | null = null;

export function getProactiveAlertEngine(): ProactiveAlertEngine {
  if (!_instance) _instance = new ProactiveAlertEngine();
  return _instance;
}
