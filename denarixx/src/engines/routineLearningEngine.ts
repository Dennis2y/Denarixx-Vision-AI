import { v4 as uuidv4 } from 'uuid';
import type { RoutineEntry, RoutinePhase } from '@/types/cognitive';

function getPhase(date: Date): RoutinePhase {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export class RoutineLearningEngine {
  private entries: Map<string, RoutineEntry> = new Map();

  observe(label: string, location?: string) {
    const now = new Date();
    const phase = getPhase(now);
    const key = `${label}:${phase}`;

    const existing = this.entries.get(key);
    if (existing) {
      existing.frequency++;
      existing.lastObserved = now;
      if (location && !existing.associatedLocations.includes(location)) {
        existing.associatedLocations.push(location);
      }
    } else {
      this.entries.set(key, {
        id: uuidv4(),
        label,
        timeOfDay: phase,
        frequency: 1,
        lastObserved: now,
        associatedLocations: location ? [location] : [],
      });
    }
  }

  getRoutines(): RoutineEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.frequency - a.frequency);
  }

  getFrequentRoutines(minFrequency = 2): RoutineEntry[] {
    return this.getRoutines().filter((r) => r.frequency >= minFrequency);
  }

  isKnownRoutine(label: string): boolean {
    const phase = getPhase(new Date());
    return this.entries.has(`${label}:${phase}`);
  }

  getEntryCount(): number {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }
}
