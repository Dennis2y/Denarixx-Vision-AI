import { v4 as uuidv4 } from 'uuid';
import type { IMemoryEngine } from './types';
import type { MemoryItem } from '@/types';

// In-memory store for Phase 1 simulation; swap for Prisma in production
class InMemoryStore {
  private items: Map<string, MemoryItem> = new Map();

  add(item: MemoryItem): void {
    this.items.set(item.id, item);
  }

  clearAll(): void {
    this.items.clear();
  }

  findByLabel(label: string): MemoryItem | null {
    const lower = label.toLowerCase();
    for (const item of this.items.values()) {
      if (item.label.toLowerCase().includes(lower)) return item;
    }
    return null;
  }

  search(context: string): MemoryItem[] {
    const lower = context.toLowerCase();
    return Array.from(this.items.values()).filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower)
    );
  }

  getAll(): MemoryItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime()
    );
  }
}

const store = new InMemoryStore();

// Pre-seed with demo items matching seed.ts data
store.add({
  id: uuidv4(),
  type: 'location',
  label: 'Home entrance',
  description: 'Front door of home. Steps down, then flat path.',
  metadata: { indoor: false },
  createdAt: new Date(),
  lastSeenAt: new Date(),
});
store.add({
  id: uuidv4(),
  type: 'location',
  label: 'Local café',
  description: 'Favourite café. Counter is 10 steps ahead from entrance.',
  metadata: { indoor: true },
  createdAt: new Date(),
  lastSeenAt: new Date(),
});

export class MemoryEngine implements IMemoryEngine {
  async save(
    item: Omit<MemoryItem, 'id' | 'createdAt' | 'lastSeenAt'>
  ): Promise<MemoryItem> {
    const full: MemoryItem = {
      ...item,
      id: uuidv4(),
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };
    store.add(full);
    return full;
  }

  async query(label: string): Promise<MemoryItem | null> {
    return store.findByLabel(label);
  }

  async getAll(): Promise<MemoryItem[]> {
    return store.getAll();
  }

  async recall(context: string): Promise<MemoryItem[]> {
    return store.search(context);
  }

  async clearAll(): Promise<void> {
    store.clearAll();
  }
}

let _instance: MemoryEngine | null = null;

export function getMemoryEngine(): MemoryEngine {
  if (!_instance) _instance = new MemoryEngine();
  return _instance;
}
