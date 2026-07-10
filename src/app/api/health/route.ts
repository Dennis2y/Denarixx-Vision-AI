import { ok } from '@/lib/api';

export async function GET() {
  return ok({
    status: 'healthy',
    version: '1.0.0-phase1',
    timestamp: new Date().toISOString(),
    mode: process.env.VISION_PROVIDER ?? 'simulation',
    disclaimer:
      'Denarixx Vision AI Phase 1 — assistive support only. Not medically certified.',
  });
}
