'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SceneDescription } from '@/types';

interface ScenePanelProps {
  scene: SceneDescription | null;
}

export function ScenePanel({ scene }: ScenePanelProps) {
  return (
    <Card role="region" aria-label="Scene description" aria-live="polite">
      <CardHeader>
        <CardTitle>👁 Scene</CardTitle>
        {scene && (
          <Badge variant={scene.isUncertain ? 'medium' : 'success'}>
            {Math.round(scene.confidence * 100)}% conf
          </Badge>
        )}
      </CardHeader>

      {!scene ? (
        <p className="text-gray-500 text-sm">Waiting for vision session to start…</p>
      ) : (
        <>
          <p className="text-white text-base leading-relaxed">{scene.summary}</p>
          {scene.uncertaintyMessage && (
            <p className="mt-2 text-yellow-400 text-sm font-medium">
              ⚠ {scene.uncertaintyMessage}
            </p>
          )}
          {scene.detections.length > 0 && (
            <div className="mt-3">
              <p className="text-gray-400 text-xs mb-1 uppercase tracking-wider">
                Detected objects
              </p>
              <div className="flex flex-wrap gap-1">
                {scene.detections.map((d, i) => (
                  <span
                    key={i}
                    className="text-xs bg-gray-800 text-gray-300 rounded px-2 py-0.5 border border-gray-700"
                  >
                    {d.label} {Math.round(d.confidence * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-gray-500 text-xs">
            {new Date(scene.timestamp).toLocaleTimeString()}
          </p>
        </>
      )}
    </Card>
  );
}
