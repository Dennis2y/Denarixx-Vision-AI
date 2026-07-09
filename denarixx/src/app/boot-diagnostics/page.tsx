'use client';
import { useState, useCallback } from 'react';
import {
  runBootSequence,
  buildBootDiagnostic,
  estimateTotalBootTimeMs,
  getBootPhaseLabel,
  getFailureRecoveryMessage,
} from '@/engines/bootSequenceEngine';
import { BOOT_PHASES_IN_ORDER } from '@/types/glassesOS';
import type { BootSequenceResult, BootPhase } from '@/types/glassesOS';

const PHASE_ICONS: Record<BootPhase, string> = {
  'power-on':       '⚡',
  'hardware-check': '🔧',
  'sensor-init':    '📡',
  'ai-load':        '🧠',
  'guardian-start': '🛡',
  'wake-word':      '🎙',
  'ready':          '✅',
};

export default function BootDiagnosticsPage() {
  const [result, setResult] = useState<BootSequenceResult | null>(null);
  const [booting, setBooting] = useState(false);
  const [failAtPhase, setFailAtPhase] = useState<BootPhase | 'none'>('none');
  const [stepIndex, setStepIndex] = useState(-1);

  const handleBoot = useCallback(() => {
    setBooting(true);
    setStepIndex(-1);
    setResult(null);

    const phases = [...BOOT_PHASES_IN_ORDER];
    let i = 0;
    const interval = setInterval(() => {
      setStepIndex(i);
      i++;
      if (i >= phases.length) {
        clearInterval(interval);
        const r = runBootSequence({
          failAtPhase: failAtPhase === 'none' ? undefined : failAtPhase,
        });
        setResult(r);
        setBooting(false);
        setStepIndex(-1);
      }
    }, 300);
  }, [failAtPhase]);

  const diag = result ? buildBootDiagnostic(result) : null;
  const totalEstimated = estimateTotalBootTimeMs();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Boot Diagnostics</h1>
          <p className="text-gray-400 text-sm">
            7-phase Denarixx Vision Glasses standalone boot sequence.
            Estimated boot time: ~{totalEstimated}ms.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Simulate Boot</h2>
          <div className="mb-4">
            <label className="text-xs text-gray-400 block mb-2">Inject failure at phase</label>
            <select
              value={failAtPhase}
              onChange={e => setFailAtPhase(e.target.value as BootPhase | 'none')}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none"
            >
              <option value="none">No failure — normal boot</option>
              {BOOT_PHASES_IN_ORDER.filter(p => p !== 'ready').map(p => (
                <option key={p} value={p}>{getBootPhaseLabel(p)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleBoot}
            disabled={booting}
            className="px-6 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {booting ? 'Booting…' : 'Run Boot Sequence'}
          </button>
        </div>

        {/* Live Boot Progress */}
        {booting && (
          <div className="mb-6 rounded-xl border border-blue-600/40 bg-blue-900/10 p-5">
            <h2 className="text-sm font-semibold text-blue-300 mb-3">Booting Glasses OS…</h2>
            <div className="space-y-2">
              {BOOT_PHASES_IN_ORDER.map((phase, i) => (
                <div key={phase} className={`flex items-center gap-3 text-sm transition-opacity ${
                  i < stepIndex ? 'opacity-100' : i === stepIndex ? 'opacity-100' : 'opacity-30'
                }`}>
                  <span>{i <= stepIndex ? '✓' : i === stepIndex ? '⟳' : '○'}</span>
                  <span>{PHASE_ICONS[phase]} {getBootPhaseLabel(phase)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Boot Result */}
        {result && diag && (
          <>
            <div className={`mb-6 rounded-xl border p-5 ${
              result.success
                ? 'border-green-600/40 bg-green-900/10'
                : 'border-red-600/40 bg-red-900/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold">
                  {result.success ? '✓ Boot Successful' : '✗ Boot Failed'}
                </h2>
                <span className="text-sm text-gray-400">{result.totalDurationMs}ms total</span>
              </div>
              {result.failedPhase && (
                <div className="text-sm text-red-300 mb-2">
                  Failed at: <strong>{getBootPhaseLabel(result.failedPhase)}</strong>
                </div>
              )}
              {result.failedPhase && (
                <div className="text-xs text-yellow-300 border border-yellow-600/30 bg-yellow-900/10 rounded-lg p-3">
                  Recovery: {getFailureRecoveryMessage(result.failedPhase)}
                </div>
              )}
            </div>

            {/* Step Table */}
            <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr className="text-xs text-gray-400">
                    <th className="text-left px-4 py-2">Phase</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {result.steps.map(step => (
                    <tr key={step.phase} className="border-t border-gray-700/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span>{PHASE_ICONS[step.phase]}</span>
                          <span>{getBootPhaseLabel(step.phase)}</span>
                        </div>
                        {step.error && <div className="text-xs text-red-300 mt-0.5">{step.error}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          step.success
                            ? 'bg-green-700/30 text-green-300'
                            : 'bg-red-700/30 text-red-300'
                        }`}>
                          {step.success ? 'OK' : 'FAILED'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">
                        {step.durationMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4 text-xs text-gray-400">
              Completed phases: {diag.completedPhases.map(getBootPhaseLabel).join(' → ') || 'None'}<br />
              Status: <span className="text-gray-200 capitalize">{diag.status}</span>
            </div>
          </>
        )}

        {!result && !booting && (
          <div className="rounded-xl border border-gray-700/50 bg-gray-800/20 p-8 text-center text-sm text-gray-500">
            Run a boot sequence to see diagnostics.
          </div>
        )}
      </div>
    </div>
  );
}
