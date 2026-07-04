'use client';

import { useVisionSession } from '@/hooks/useVisionSession';
import { SessionControls } from '@/components/session/SessionControls';
import { HazardPanel } from '@/components/session/HazardPanel';
import { ScenePanel } from '@/components/session/ScenePanel';
import { AudioLog } from '@/components/session/AudioLog';
import { ConversationBox } from '@/components/session/ConversationBox';
import { DemoFlow } from '@/components/session/DemoFlow';
import { SessionReportPanel } from '@/components/session/SessionReport';

export default function SessionPage() {
  const { state, startSession, stopSession, saveMemoryEvent } = useVisionSession();

  if (state.report && !state.isActive) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SessionReportPanel report={state.report} onNewSession={startSession} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white mb-1">Vision Session</h1>
        <p className="text-gray-500 text-sm">
          Simulation mode — all detections are synthetic. Real camera support in a future build.
        </p>
      </div>

      {state.error && (
        <div
          className="bg-red-950 border border-red-700 text-red-200 rounded-xl p-4 mb-6"
          role="alert"
          aria-live="assertive"
        >
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* Demo flow tracker */}
      <div className="mb-6">
        <DemoFlow
          completedSteps={state.completedSteps}
          isActive={state.isActive}
          onSaveMemory={state.isActive ? saveMemoryEvent : undefined}
        />
      </div>

      {/* Session controls */}
      <div className="mb-6">
        <SessionControls
          isActive={state.isActive}
          isLoading={state.isLoading}
          frameCount={state.frameCount}
          alertCount={state.alertCount}
          onStart={startSession}
          onStop={stopSession}
        />
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <HazardPanel alerts={state.currentAlerts} decision={state.currentDecision} />
        <ScenePanel scene={state.currentScene} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AudioLog log={state.log} />
        <ConversationBox scene={state.currentScene} sessionId={state.sessionId} />
      </div>

      {!state.isActive && !state.report && (
        <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6 text-center">
          <p className="text-2xl mb-2" aria-hidden="true">▶</p>
          <p className="text-white font-bold mb-1">Ready to start</p>
          <p className="text-gray-500 text-sm">
            Click <strong className="text-yellow-400">Start Vision Session</strong> above to begin the
            7-step demo. The Cognitive Guardian will analyze each frame and provide audio guidance.
          </p>
        </div>
      )}
    </div>
  );
}
