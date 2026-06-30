'use client';

import { useVisionSession } from '@/hooks/useVisionSession';
import { SessionControls } from '@/components/session/SessionControls';
import { HazardPanel } from '@/components/session/HazardPanel';
import { ScenePanel } from '@/components/session/ScenePanel';
import { AudioLog } from '@/components/session/AudioLog';
import { ConversationBox } from '@/components/session/ConversationBox';

export default function SessionPage() {
  const { state, startSession, stopSession } = useVisionSession();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Vision Session</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Simulation mode — all detections are synthetic. Real camera support in a future build.
      </p>

      {state.error && (
        <div
          className="bg-red-950 border border-red-700 text-red-200 rounded-xl p-4 mb-6"
          role="alert"
          aria-live="assertive"
        >
          Error: {state.error}
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <HazardPanel alerts={state.currentAlerts} decision={state.currentDecision} />
        <ScenePanel scene={state.currentScene} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AudioLog log={state.log} />
        <ConversationBox scene={state.currentScene} sessionId={state.sessionId} />
      </div>
    </div>
  );
}
