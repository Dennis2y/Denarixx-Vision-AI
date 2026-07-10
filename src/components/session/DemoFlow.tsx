'use client';

import { Button } from '@/components/ui/Button';

const DEMO_STEPS = [
  { icon: '▶', label: 'Start session', detail: 'Vision session initialized' },
  { icon: '🚶', label: 'Simulate walking', detail: 'Frames analyzed every 3 s' },
  { icon: '⚠', label: 'Safety alert', detail: 'Hazard detected & classified' },
  { icon: '🧠', label: 'Guardian decides', detail: 'AI makes the safety call' },
  { icon: '🔊', label: 'Audio guidance', detail: 'Priority speech output' },
  { icon: '💾', label: 'Save to memory', detail: 'Location event persisted' },
  { icon: '📊', label: 'Session report', detail: 'Metrics & summary ready' },
];

interface DemoFlowProps {
  completedSteps: boolean[];
  isActive: boolean;
  onSaveMemory?: () => void;
}

export function DemoFlow({ completedSteps, isActive, onSaveMemory }: DemoFlowProps) {
  const lastCompleted = completedSteps.lastIndexOf(true);

  return (
    <div
      className="rounded-xl border border-yellow-700/40 bg-yellow-950/20 p-4"
      role="region"
      aria-label="Demo flow progress"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400 font-bold text-sm uppercase tracking-wider">
          7-Step Demo Flow
        </span>
        {isActive && (
          <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
            Live
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {DEMO_STEPS.map((step, index) => {
          const done = completedSteps[index];
          const isNext = isActive && !done && index === lastCompleted + 1;
          const isMemoryStep = index === 5;

          return (
            <div
              key={index}
              className={`flex flex-col gap-1 rounded-lg p-2.5 border transition-all ${
                done
                  ? 'bg-green-950/40 border-green-700/50'
                  : isNext
                  ? 'bg-yellow-950/60 border-yellow-600 shadow-sm shadow-yellow-900'
                  : 'bg-gray-900/60 border-gray-800'
              }`}
              aria-label={`Step ${index + 1}: ${step.label} — ${done ? 'complete' : isNext ? 'in progress' : 'pending'}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    done
                      ? 'bg-green-500 text-black'
                      : isNext
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-800 text-gray-500'
                  }`}
                  aria-hidden="true"
                >
                  {done ? '✓' : index + 1}
                </span>
                <span className="text-sm" aria-hidden="true">{step.icon}</span>
              </div>
              <p
                className={`text-xs font-semibold leading-tight ${
                  done ? 'text-green-300' : isNext ? 'text-yellow-300' : 'text-gray-500'
                }`}
              >
                {step.label}
              </p>
              <p className="text-gray-600 text-xs leading-tight hidden sm:block">{step.detail}</p>

              {isMemoryStep && isActive && !done && onSaveMemory && (
                <Button
                  onClick={onSaveMemory}
                  size="sm"
                  variant="ghost"
                  className="mt-1 text-xs px-2 py-1 min-h-0 h-6 text-yellow-400 border border-yellow-700"
                  aria-label="Save current location to memory"
                >
                  Save now
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
