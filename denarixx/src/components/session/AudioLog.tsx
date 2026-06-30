'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface AudioLogProps {
  log: string[];
}

export function AudioLog({ log }: AudioLogProps) {
  return (
    <Card role="log" aria-label="Narration log" aria-live="polite" aria-relevant="additions">
      <CardHeader>
        <CardTitle>🔊 Narration Log</CardTitle>
      </CardHeader>
      {log.length === 0 ? (
        <p className="text-gray-500 text-sm">No narration yet.</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto" role="list">
          {log.map((entry, i) => (
            <li key={i} className="text-gray-300 text-sm font-mono leading-tight">
              {entry}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
