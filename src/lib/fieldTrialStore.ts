// In-memory field trial session store (resets on server restart).
import type { TrialSession, TrialReport } from '@/types/fieldTrial';

export const trialSessionStore = new Map<string, TrialSession>();
export const trialReportStore = new Map<string, TrialReport>();
