'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface SessionControlsProps {
  isActive: boolean;
  isLoading: boolean;
  frameCount: number;
  alertCount: number;
  onStart: () => void;
  onStop: () => void;
}

export function SessionControls({
  isActive,
  isLoading,
  frameCount,
  alertCount,
  onStart,
  onStop,
}: SessionControlsProps) {
  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Session controls">
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={onStart}
          disabled={isActive || isLoading}
          size="xl"
          fullWidth
          aria-label="Start vision session"
        >
          {isLoading ? 'Starting…' : '▶ Start Vision Session'}
        </Button>

        <Button
          onClick={onStop}
          disabled={!isActive}
          variant="danger"
          size="xl"
          fullWidth
          aria-label="Stop vision session — emergency stop"
        >
          ■ Stop Session
        </Button>
      </div>

      <div className="flex gap-3 text-sm" aria-live="polite" aria-atomic="true">
        <div className="flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}
            aria-hidden="true"
          />
          <span className="text-gray-300">{isActive ? 'Active' : 'Stopped'}</span>
        </div>
        <Badge variant="muted">{frameCount} frames</Badge>
        <Badge variant={alertCount > 0 ? 'high' : 'muted'}>{alertCount} alerts</Badge>
      </div>
    </div>
  );
}
