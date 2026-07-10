'use client';

/**
 * SocialAwarenessPanel (V9)
 *
 * Displays real-time social context: nearby people, crowd density,
 * interaction probability, personal space status, and risk level.
 *
 * Runs its own simulation loop — no dependency on the vision session.
 * Privacy: never identifies people, never infers emotions as facts.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { analyzeSocialScenario } from '@/engines/socialAwarenessEngine';
import type { SocialContext, SocialScenario, NearbyPerson } from '@/types/social';

// ─── Scenario rotation ────────────────────────────────────────────────────────

const SCENARIOS: SocialScenario[] = [
  'empty_street',
  'someone_approaching',
  'someone_waiting',
  'small_queue',
  'people_crossing',
  'dense_crowd',
  'person_waving',
];

const SCENARIO_LABELS: Record<SocialScenario, string> = {
  empty_street:       'Empty street',
  someone_approaching:'Someone approaching',
  someone_waiting:    'Someone waiting',
  small_queue:        'Small queue ahead',
  people_crossing:    'People crossing',
  dense_crowd:        'Dense crowd',
  person_waving:      'Person waving',
  person_falling:     'Person falling',
};

const TICK_INTERVAL_MS = 4000;

// ─── Sub-components ───────────────────────────────────────────────────────────

function DensityBar({ density }: { density: SocialContext['crowd']['density'] }) {
  const levels: SocialContext['crowd']['density'][] = ['empty','sparse','moderate','dense','very_dense'];
  const idx = levels.indexOf(density);
  const colors = ['bg-gray-700','bg-green-600','bg-yellow-500','bg-orange-500','bg-red-500'];
  return (
    <div className="flex gap-1 items-center">
      {levels.map((_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full transition-colors duration-500 ${i <= idx ? colors[idx] : 'bg-gray-800'}`}
        />
      ))}
    </div>
  );
}

function RiskBadge({ level }: { level: 'none' | 'low' | 'medium' | 'high' }) {
  const styles = {
    none:   'bg-gray-800 text-gray-500',
    low:    'bg-green-900/60 text-green-300',
    medium: 'bg-yellow-900/60 text-yellow-300',
    high:   'bg-red-900/60 text-red-300',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[level]}`}>
      {level === 'none' ? 'None' : level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function AlertBadge({ severity }: { severity: 'info' | 'warning' | 'urgent' }) {
  const styles = {
    info:    'bg-blue-900/50 text-blue-300 border-blue-800/50',
    warning: 'bg-yellow-900/50 text-yellow-300 border-yellow-800/50',
    urgent:  'bg-red-900/50 text-red-300 border-red-800/50',
  };
  const icons = { info: 'ℹ', warning: '⚠', urgent: '🚨' };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${styles[severity]}`}>
      {icons[severity]}
    </span>
  );
}

function ActivityIcon({ activity }: { activity: NearbyPerson['activity'] }) {
  const icons: Record<NearbyPerson['activity'], string> = {
    walking:         '🚶',
    running:         '🏃',
    standing:        '🧍',
    sitting:         '🪑',
    waiting:         '⏳',
    waving:          '👋',
    pointing:        '👉',
    approaching:     '→',
    moving_away:     '←',
    crossing_road:   '🚸',
    opening_door:    '🚪',
    entering_vehicle:'🚗',
    leaving_vehicle: '🚘',
    falling:         '⚠',
    unknown:         '•',
  };
  return <span>{icons[activity] ?? '•'}</span>;
}

function PersonRow({ person }: { person: NearbyPerson }) {
  const distLabel: Record<NearbyPerson['distanceZone'], string> = {
    very_close: '< 1 m',
    close:      '1–3 m',
    near:       '3–6 m',
    medium:     '6–15 m',
    far:        '> 15 m',
  };
  const dirLabel: Record<NearbyPerson['direction'], string> = {
    ahead:        'Ahead',
    ahead_left:   'Ahead left',
    ahead_right:  'Ahead right',
    left:         'Left',
    right:        'Right',
    behind:       'Behind',
    behind_left:  'Behind left',
    behind_right: 'Behind right',
  };

  return (
    <div className={`flex items-center gap-3 text-xs py-2 border-b border-gray-800 last:border-0 ${person.inPersonalSpace ? 'text-red-300' : 'text-gray-300'}`}>
      <span className="text-base w-6 text-center">
        <ActivityIcon activity={person.activity} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{person.activity.replace(/_/g, ' ')}</div>
        <div className="text-gray-500">{dirLabel[person.direction]} · {distLabel[person.distanceZone]}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={person.isApproaching ? 'text-orange-400' : 'text-gray-500'}>
          {person.isApproaching ? '↗ approaching' : person.approachSpeed}
        </div>
        {person.interactionProbability > 0.35 && (
          <div className="text-blue-400">{Math.round(person.interactionProbability * 100)}% interact</div>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SocialAwarenessPanelProps {
  sessionActive?: boolean;
}

export function SocialAwarenessPanel({ sessionActive = false }: SocialAwarenessPanelProps) {
  const [context, setContext] = useState<SocialContext | null>(null);
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const scenario = SCENARIOS[scenarioIdx % SCENARIOS.length];
    const result = analyzeSocialScenario(scenario, 'walking');
    setContext(result);
    setScenarioIdx((i) => i + 1);
  }, [scenarioIdx]);

  useEffect(() => {
    if (!sessionActive) return;
    tick();
    tickRef.current = setInterval(tick, TICK_INTERVAL_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionActive]);

  // Run once on mount for display purposes
  useEffect(() => {
    if (!sessionActive) {
      const result = analyzeSocialScenario('someone_approaching', 'walking');
      setContext(result);
    }
  }, [sessionActive]);

  if (!context) return null;

  const { nearbyPersons, crowd, personalSpaceClear, primaryGuidance, alerts } = context;
  const currentScenario = SCENARIOS[(scenarioIdx - 1 + SCENARIOS.length) % SCENARIOS.length];

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <h3 className="text-sm font-bold text-white">Social Awareness</h3>
          <span className="text-xs text-gray-600">V9</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 truncate max-w-28">{SCENARIO_LABELS[currentScenario]}</span>
          <RiskBadge level={crowd.riskLevel} />
        </div>
      </div>

      {/* Primary guidance */}
      {primaryGuidance && (
        <div className="mb-3 text-xs text-yellow-300 bg-yellow-950/30 rounded-lg px-3 py-2 border border-yellow-800/30">
          {primaryGuidance}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-gray-400">Nearby</div>
          <div className="text-white font-bold text-base">{nearbyPersons.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-gray-400">Approaching</div>
          <div className={`font-bold text-base ${crowd.approachingCount > 0 ? 'text-orange-400' : 'text-white'}`}>
            {crowd.approachingCount}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-gray-400">Space</div>
          <div className={`font-bold text-base ${personalSpaceClear ? 'text-green-400' : 'text-red-400'}`}>
            {personalSpaceClear ? 'Clear' : '⚠'}
          </div>
        </div>
      </div>

      {/* Crowd density */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Crowd density</span>
          <span className="text-gray-400 capitalize">{crowd.density.replace('_', ' ')}</span>
        </div>
        <DensityBar density={crowd.density} />
        {crowd.hasQueue && (
          <div className="text-xs text-blue-400 mt-1">Queue detected ahead</div>
        )}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <AlertBadge severity={alert.severity} />
              <span className={
                alert.severity === 'urgent' ? 'text-red-300' :
                alert.severity === 'warning' ? 'text-yellow-300' : 'text-blue-300'
              }>{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Nearby persons list */}
      {nearbyPersons.length > 0 ? (
        <div>
          <div className="text-xs text-gray-500 mb-1">Nearby people</div>
          <div>
            {nearbyPersons.slice(0, 4).map((p) => (
              <PersonRow key={p.id} person={p} />
            ))}
            {nearbyPersons.length > 4 && (
              <div className="text-xs text-gray-600 pt-1">+{nearbyPersons.length - 4} more</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-600 text-center py-2">No people detected nearby</div>
      )}

      {/* Privacy notice */}
      <div className="mt-3 pt-2 border-t border-gray-800 text-xs text-gray-700">
        No identity inferred · Observable behaviour only · V9 simulation
      </div>
    </div>
  );
}
