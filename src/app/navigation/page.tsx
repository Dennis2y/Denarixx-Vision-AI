'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAudioGuidance } from '@/hooks/useAudioGuidance';
import type { NavigationGuidance } from '@/types';

const DEMO_SCENE = {
  summary: 'You are on a pavement. One person is ahead.',
  confidence: 0.82,
  detections: [{ label: 'person', confidence: 0.82 }, { label: 'pavement', confidence: 0.95 }],
  timestamp: new Date().toISOString(),
  isUncertain: false,
};

export default function NavigationPage() {
  const { speak } = useAudioGuidance();
  const [destination, setDestination] = useState('');
  const [guidance, setGuidance] = useState<NavigationGuidance | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = async () => {
    if (!destination.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scene/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'nav-demo',
          source: 'simulation',
          detections: DEMO_SCENE.detections,
        }),
      });
      await res.json(); // scene data reserved for Phase 2 GPS integration

      // Navigation engine is accessed via conversation for now
      const msg =
        guidance?.instruction ??
        `Navigation to "${destination}" — I will alert you to hazards as you move. GPS integration is planned for Phase 2.`;

      setGuidance({
        instruction: `Heading to "${destination}". ${msg}`,
        confidence: 0.52,
        isUncertain: true,
        disclaimer:
          'Navigation guidance is approximate. Assistive support only — does not guarantee safety.',
      });

      speak(`Navigating to ${destination}. ${msg}`, 'high');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Navigation Foundation</h1>
      <p className="text-gray-400 text-sm mb-8">
        Phase 1 navigation is hazard-aware but does not yet include GPS turn-by-turn
        routing. Destination awareness and real-time obstacle alerts are active.
      </p>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Where do you want to go?</CardTitle>
        </CardHeader>
        <div className="flex gap-3">
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && navigate()}
            placeholder="e.g. Exit, Front door, Bus stop…"
            aria-label="Enter destination"
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
          <Button onClick={navigate} disabled={loading || !destination.trim()}>
            {loading ? 'Finding…' : 'Navigate'}
          </Button>
        </div>
      </Card>

      {guidance && (
        <Card className={guidance.isUncertain ? 'border-yellow-700' : 'border-green-700'}>
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">🧭</span>
            <div>
              <p className="text-white font-semibold">{guidance.instruction}</p>
              <p className="text-yellow-400 text-xs mt-1">
                Confidence: {Math.round(guidance.confidence * 100)}%
                {guidance.isUncertain && ' — uncertain'}
              </p>
              <p className="text-gray-500 text-xs mt-1">{guidance.disclaimer}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mt-6 border-gray-700">
        <CardHeader><CardTitle>Phase 1 Limitations</CardTitle></CardHeader>
        <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
          <li>No GPS integration — cannot provide precise turn-by-turn directions</li>
          <li>Navigation guidance is rule-based stubs, not a trained routing model</li>
          <li>All confidence scores are approximate from simulation</li>
          <li>Phase 2 will add GPS + indoor positioning integration</li>
        </ul>
      </Card>
    </div>
  );
}
