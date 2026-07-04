'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

interface AudioLogProps {
  log: string[];
}

type LogEntryKind = 'alert' | 'quiet' | 'scene' | 'memory' | 'error' | 'normal';

function classifyEntry(entry: string): LogEntryKind {
  if (entry.includes('] ALERT [')) return 'alert';
  if (entry.includes('] [quiet]')) return 'quiet';
  if (entry.includes('] [scene]')) return 'scene';
  if (entry.includes('] Memory recall:')) return 'memory';
  if (entry.includes('] Error:')) return 'error';
  return 'normal';
}

const KIND_STYLES: Record<LogEntryKind, string> = {
  alert: 'text-amber-300 font-semibold',
  quiet: 'text-gray-600 italic',
  scene: 'text-blue-500/70',
  memory: 'text-purple-400',
  error: 'text-red-400',
  normal: 'text-gray-400',
};

const KIND_ICON: Record<LogEntryKind, string> = {
  alert: '⚠',
  quiet: '🔇',
  scene: '🔁',
  memory: '💾',
  error: '✗',
  normal: '·',
};

export function AudioLog({ log }: AudioLogProps) {
  return (
    <Card role="log" aria-label="Narration log" aria-live="polite" aria-relevant="additions">
      <CardHeader>
        <CardTitle>🔊 Narration Log</CardTitle>
      </CardHeader>
      {log.length === 0 ? (
        <p className="text-gray-500 text-sm">No narration yet.</p>
      ) : (
        <ul className="space-y-0.5 max-h-52 overflow-y-auto" role="list">
          {log.map((entry, i) => {
            const kind = classifyEntry(entry);
            return (
              <li
                key={i}
                className={`flex gap-1.5 items-start text-xs font-mono leading-tight ${KIND_STYLES[kind]}`}
                aria-label={kind === 'quiet' ? `Silenced: ${entry}` : entry}
              >
                <span className="shrink-0 mt-px" aria-hidden="true">{KIND_ICON[kind]}</span>
                <span>{entry}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
