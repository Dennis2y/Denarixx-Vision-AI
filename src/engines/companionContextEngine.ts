import type { UserContext, UserActivity } from '@/types/cognitive';

export class CompanionContextEngine {
  private sessionStart: Date = new Date();
  private alertTimestamps: Date[] = [];
  private currentActivity: UserActivity = 'unknown';
  private isIndoors = false;

  updateActivity(frameCount: number, alertCount: number) {
    const alertsPerFrame = frameCount > 0 ? alertCount / frameCount : 0;

    if (alertsPerFrame > 0.5) {
      this.currentActivity = 'walking';
    } else if (frameCount > 5 && alertsPerFrame < 0.1) {
      this.currentActivity = 'stopped';
    } else if (frameCount > 0) {
      this.currentActivity = 'walking';
    }
  }

  recordAlert() {
    const now = new Date();
    this.alertTimestamps.push(now);
    // Keep only last 60 seconds
    const cutoff = new Date(Date.now() - 60_000);
    this.alertTimestamps = this.alertTimestamps.filter((t) => t >= cutoff);
  }

  setActivity(activity: UserActivity) {
    this.currentActivity = activity;
  }

  setIndoors(indoors: boolean) {
    this.isIndoors = indoors;
  }

  getContext(): UserContext {
    const now = Date.now();
    const cutoff = new Date(now - 60_000);
    const recentAlerts = this.alertTimestamps.filter((t) => t >= cutoff);
    const lastAlert = recentAlerts.length > 0
      ? recentAlerts[recentAlerts.length - 1]
      : null;

    return {
      activity: this.currentActivity,
      sessionDurationSeconds: Math.round((now - this.sessionStart.getTime()) / 1000),
      alertsInLastMinute: recentAlerts.length,
      lastAlertTimestamp: lastAlert,
      isIndoors: this.isIndoors,
      confidence: this.currentActivity === 'unknown' ? 0.4 : 0.8,
    };
  }

  reset() {
    this.sessionStart = new Date();
    this.alertTimestamps = [];
    this.currentActivity = 'unknown';
    this.isIndoors = false;
  }
}
