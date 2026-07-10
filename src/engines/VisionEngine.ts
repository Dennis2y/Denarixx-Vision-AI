import type { IVisionEngine, VisionProvider } from './types';
import type { VisionFrame, Detection } from '@/types';
import { MockVisionProvider } from './providers/MockVisionProvider';

export class VisionEngine implements IVisionEngine {
  private provider: VisionProvider;

  constructor(provider?: VisionProvider) {
    this.provider = provider ?? new MockVisionProvider();
  }

  async analyzeFrame(frame: VisionFrame): Promise<Detection[]> {
    return this.provider.analyzeFrame(frame);
  }

  getProvider(): VisionProvider {
    return this.provider;
  }

  setProvider(provider: VisionProvider): void {
    this.provider = provider;
  }
}

// Singleton for API routes — replace provider at startup via env var
let _instance: VisionEngine | null = null;

export function getVisionEngine(): VisionEngine {
  if (!_instance) {
    _instance = new VisionEngine();
  }
  return _instance;
}
