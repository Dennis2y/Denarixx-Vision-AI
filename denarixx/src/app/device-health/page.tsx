'use client';
import { useState, useEffect } from 'react';
import {
  createRuntimeState,
  bootGlasses,
  buildRuntimeSummary,
} from '@/engines/glassesRuntimeEngine';
import {
  buildDeviceHealthReport,
  getHealthColor,
  identifyDegradedComponents,
  isHealthCritical,
} from '@/engines/deviceHealthEngine';
import { buildDefaultPowerProfile } from '@/engines/glassesPowerEngine';
import { activateAllSensors, initializeAllSensors } from '@/engines/glassesOSSensorEngine';
import type { DeviceHealth, RuntimeState } from '@/types/glassesOS';

const STATUS_STYLE: Record<string, string> = {
  healthy:  'border-green-600/40 bg-green-900/10 text-green-300',
  degraded: 'border-yellow-600/40 bg-yellow-900/10 text-yellow-300',
  critical: 'border-red-600/40 bg-red-900/10 text-red-300',
  offline:  'border-gray-600/40 bg-gray-800/20 text-gray-500',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-700/40 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

export default function DeviceHealthPage() {
  const [state, setState] = useState<RuntimeState>(() => bootGlasses(createRuntimeState()));
  const [health, setHealth] = useState<DeviceHealth>(() => {
    const sensors = activateAllSensors(initializeAllSensors(0), 1);
    const power = buildDefaultPowerProfile();
    return buildDeviceHealthReport(sensors, power, true, true, 1);
  });

  useEffect(() => {
    const report = buildDeviceHealthReport(
      state.sensors, state.power, state.bootResult?.success ?? false,
      state.guardianActive, state.sessionTick
    );
    setHealth(report);
  }, [state]);

  const summary = buildRuntimeSummary(state);
  const degraded = identifyDegradedComponents(health);
  const healthColor = getHealthColor(health.overallScore);
  const critical = isHealthCritical(health);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Device Health</h1>
          <p className="text-gray-400 text-sm">
            Glasses compute module, sensors, cameras, audio, storage, and Guardian engine status.
          </p>
        </div>

        {/* Overall Score */}
        <div className={`mb-6 rounded-xl border p-5 ${critical ? 'border-red-600/40 bg-red-900/10' : 'border-gray-700/50 bg-gray-800/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">Overall Health</h2>
            <span className={`text-2xl font-bold ${healthColor === 'green' ? 'text-green-400' : healthColor === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
              {health.overallScore}%
            </span>
          </div>
          <ScoreBar score={health.overallScore} />
          <div className="mt-2 text-xs text-gray-400">
            {health.isOperational ? '✓ Glasses operational' : '✗ Glasses not operational'}
            {degraded.length > 0 && ` · ${degraded.length} component(s) degraded`}
          </div>
          {health.criticalIssues.length > 0 && (
            <div className="mt-3 space-y-1">
              {health.criticalIssues.map((i, idx) => (
                <div key={idx} className="text-xs text-red-300 flex items-start gap-1">
                  <span>⚠</span><span>{i}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Component Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {health.components.map(comp => (
            <div key={comp.component} className={`rounded-xl border p-4 ${STATUS_STYLE[comp.status]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium capitalize">{comp.component.replace(/-/g, ' ')}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/40 capitalize">{comp.status}</span>
              </div>
              <ScoreBar score={comp.score} />
              <div className="text-xs mt-1 opacity-60">{comp.score}% health</div>
              {comp.issues.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {comp.issues.map((i, idx) => (
                    <li key={idx} className="text-xs opacity-80">• {i}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-blue-700/30 bg-blue-900/10 p-4 text-xs text-blue-300">
          Glasses are the primary computer. Health checks run on the glasses compute module.
          Phone and cloud are not required for device health monitoring.
        </div>
      </div>
    </div>
  );
}
