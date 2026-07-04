'use client';

import { useCallback } from 'react';
import { useVisionSession } from '@/hooks/useVisionSession';
import type { CameraStatus } from '@/hooks/useVisionSession';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';
import type { ParsedVoiceCommand } from '@/hooks/useVoiceCommands';
import { SessionControls } from '@/components/session/SessionControls';
import { HazardPanel } from '@/components/session/HazardPanel';
import { ScenePanel } from '@/components/session/ScenePanel';
import { AudioLog } from '@/components/session/AudioLog';
import { ConversationBox } from '@/components/session/ConversationBox';
import { DemoFlow } from '@/components/session/DemoFlow';
import { SessionReportPanel } from '@/components/session/SessionReport';
import { OnboardingFlow } from '@/components/session/OnboardingFlow';
import { VoiceCommandIndicator } from '@/components/session/VoiceCommandIndicator';
import { LastGuidancePanel } from '@/components/session/LastGuidancePanel';
import { SpatialMapPanel } from '@/components/session/SpatialMapPanel';

export default function SessionPage() {
  const {
    state,
    cameraStatus,
    videoRef,
    canvasRef,
    startSession,
    stopSession,
    saveMemoryEvent,
    startCamera,
    stopCamera,
    lastGuidance,
    repeatLastGuidance,
    speak,
  } = useVisionSession();

  // ── Voice command handler ──────────────────────────────────────────────────

  const handleVoiceCommand = useCallback(
    (cmd: ParsedVoiceCommand) => {
      switch (cmd.command) {
        case 'start_session':
          if (!state.isActive && !state.isLoading) startSession();
          break;
        case 'stop_session':
          if (state.isActive) stopSession();
          break;
        case 'repeat_last':
          repeatLastGuidance();
          break;
        case 'describe_surroundings':
          if (state.spatialData && state.spatialData.objects.length > 0) {
            const top = state.spatialData.objects.slice(0, 3);
            const desc = top.map((o) => `${o.label} ${o.distanceMetres.toFixed(0)} metres ${o.direction.replace(/_/g, ' ')}`).join(', ');
            speak(`I can see: ${desc}.`, 'normal', true);
          } else if (state.currentScene) {
            speak(state.currentScene.summary, 'normal', true);
          } else {
            speak('No scene data yet — session may not have started.', 'normal', true);
          }
          break;
        case 'where_am_i':
          if (state.currentScene) {
            speak(`You are in: ${state.currentScene.summary}`, 'normal', true);
          } else {
            speak('Location unknown — start a session first.', 'normal', true);
          }
          break;
        case 'what_should_i_do':
          if (state.spatialData) {
            speak(state.spatialData.recommendation.instruction, 'normal', true);
          } else if (state.currentDecision?.message) {
            speak(`Recommended action: ${state.currentDecision.message}`, 'normal', true);
          } else {
            speak('No current recommendation — session may not have started.', 'normal', true);
          }
          break;
        case 'save_this_place':
          if (state.isActive) {
            saveMemoryEvent();
            speak('Location saved.', 'normal', true);
          } else {
            speak('Start a session before saving a location.', 'normal', true);
          }
          break;
        case 'emergency_stop':
          if (state.isActive) stopSession();
          speak('Emergency stop activated. Session ended.', 'critical', true);
          break;
      }
    },
    [state, startSession, stopSession, repeatLastGuidance, saveMemoryEvent, speak]
  );

  const {
    isListening,
    isSupported,
    lastTranscript,
    lastCommand,
    startListening,
    stopListening,
  } = useVoiceCommands(handleVoiceCommand);

  const toggleVoiceListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── Session report view ────────────────────────────────────────────────────

  if (state.report && !state.isActive) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <SessionReportPanel report={state.report} onNewSession={startSession} />
        {state.report.cameraFrames > 0 && (
          <p className="text-center text-gray-500 text-xs mt-3">
            📷 {state.report.cameraFrames} of {state.report.frameCount} frames captured from live camera
          </p>
        )}
      </div>
    );
  }

  const isSimulation = cameraStatus === 'inactive' || cameraStatus === 'denied';
  const modeLabel =
    cameraStatus === 'active'
      ? 'Camera mode — live frames'
      : cameraStatus === 'denied'
      ? 'Camera denied — simulation fallback active'
      : 'Simulation mode — click Start Camera to use your device camera';

  return (
    <>
      {/* ── Onboarding (shown once via localStorage) ────────────────────── */}
      <OnboardingFlow
        onComplete={() => {}}
        onStartDemo={() => {
          if (!state.isActive && !state.isLoading) startSession();
        }}
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black text-white mb-1">Vision Session</h1>
            <p className="text-gray-500 text-sm">{modeLabel}</p>
          </div>
          <CameraStatusBadge status={cameraStatus} />
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

        {/* ── Camera panel ──────────────────────────────────────────────── */}
        <div className="mb-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">📷 Camera Input</h2>
            <CameraStatusBadge status={cameraStatus} compact />
          </div>

          {cameraStatus === 'active' ? (
            <div className="relative rounded-lg overflow-hidden bg-black mb-3">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="w-full aspect-video object-cover"
                aria-label="Live camera feed — processed for scene analysis"
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 border border-red-700/50 rounded-full px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                <span className="text-white text-xs font-bold">LIVE</span>
              </div>
              {state.isActive && (
                <div className="absolute bottom-2 left-2 bg-black/70 border border-yellow-700/50 rounded-full px-2.5 py-1">
                  <span className="text-yellow-300 text-xs font-semibold">
                    ⟳ Capturing every 3 s · {state.cameraFrames} frames sent
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-800 border border-gray-700 aspect-video flex items-center justify-center mb-3">
              <div className="text-center px-6">
                <p className="text-4xl mb-3" aria-hidden="true">
                  {cameraStatus === 'denied' ? '🚫' : cameraStatus === 'requesting' ? '⏳' : '📷'}
                </p>
                <p className="text-gray-400 text-sm font-semibold mb-1">
                  {cameraStatus === 'requesting'
                    ? 'Waiting for camera permission…'
                    : cameraStatus === 'denied'
                    ? 'Camera access denied'
                    : 'Camera not started'}
                </p>
                <p className="text-gray-600 text-xs">
                  {cameraStatus === 'denied'
                    ? 'Session is running in simulation mode. No real camera data is used.'
                    : 'Session will run in simulation mode until camera is started.'}
                </p>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          <div className="flex items-start gap-2.5 bg-blue-950/40 border border-blue-800/50 rounded-lg p-3 mb-3 text-xs text-blue-300">
            <span className="text-blue-400 mt-px shrink-0" aria-hidden="true">ℹ</span>
            <span>
              <strong>Privacy:</strong> Camera frames are processed for assistive analysis only.
              No frames are saved to disk. Face recognition is disabled.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={startCamera}
              disabled={cameraStatus === 'active' || cameraStatus === 'requesting'}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400
                disabled:opacity-50 disabled:cursor-not-allowed
                ${cameraStatus === 'active'
                  ? 'bg-green-900/40 border-green-700 text-green-300'
                  : 'bg-gray-800 border-gray-600 text-white hover:border-yellow-600 hover:bg-gray-700'
                }`}
              aria-label="Request camera access and start live video"
            >
              <span aria-hidden="true">📷</span>
              {cameraStatus === 'requesting' ? 'Requesting…' : 'Start Camera'}
            </button>
            <button
              onClick={stopCamera}
              disabled={cameraStatus !== 'active'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-700 bg-transparent text-gray-400
                hover:border-gray-500 hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400
                disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Stop camera and return to simulation mode"
            >
              Stop Camera
            </button>
            {isSimulation && (
              <span className="text-gray-600 text-xs ml-1">
                {cameraStatus === 'denied'
                  ? '⚠ Permission denied — simulation active'
                  : '● Simulation active'}
              </span>
            )}
          </div>
        </div>

        {/* ── Voice Command Indicator ────────────────────────────────────── */}
        <div className="mb-4 relative">
          <VoiceCommandIndicator
            isSupported={isSupported}
            isListening={isListening}
            lastCommand={lastCommand}
            lastTranscript={lastTranscript}
            onToggle={toggleVoiceListening}
          />
        </div>

        {/* ── Demo flow tracker ──────────────────────────────────────────── */}
        <div className="mb-6">
          <DemoFlow
            completedSteps={state.completedSteps}
            isActive={state.isActive}
            onSaveMemory={state.isActive ? saveMemoryEvent : undefined}
          />
        </div>

        {/* ── Session controls ───────────────────────────────────────────── */}
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

        {/* ── V6 Spatial Map + Hazard panel ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <SpatialMapPanel snapshot={state.spatialData} isActive={state.isActive} />
          <HazardPanel alerts={state.currentAlerts} decision={state.currentDecision} />
        </div>

        {/* ── Scene + Last Guidance ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <ScenePanel scene={state.currentScene} />
          <LastGuidancePanel
            guidance={lastGuidance}
            onRepeat={repeatLastGuidance}
            isActive={state.isActive}
          />
        </div>

        {/* ── Audio log + Conversation ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <AudioLog log={state.log} />
          <ConversationBox scene={state.currentScene} sessionId={state.sessionId} />
        </div>

        {/* ── Ready state ────────────────────────────────────────────────── */}
        {!state.isActive && !state.report && (
          <div className="mt-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6 text-center">
            <p className="text-2xl mb-2" aria-hidden="true">▶</p>
            <p className="text-white font-bold mb-1">Ready to start</p>
            <p className="text-gray-500 text-sm">
              Click <strong className="text-yellow-400">Start Vision Session</strong> above, or say{' '}
              <strong className="text-purple-400">&ldquo;start session&rdquo;</strong> to begin hands-free.{' '}
              {cameraStatus === 'active'
                ? 'Live camera frames will be sent for analysis.'
                : 'Start Camera first to use your device camera, or run in simulation mode.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Camera status badge ──────────────────────────────────────────────────────

function CameraStatusBadge({
  status,
  compact = false,
}: {
  status: CameraStatus;
  compact?: boolean;
}) {
  const configs: Record<CameraStatus, { label: string; dot: string; text: string; bg: string; border: string }> = {
    inactive: { label: compact ? 'Inactive' : 'Camera Inactive', dot: 'bg-gray-500', text: 'text-gray-400', bg: 'bg-gray-800/60', border: 'border-gray-700' },
    requesting: { label: compact ? 'Requesting…' : 'Requesting Permission…', dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-300', bg: 'bg-yellow-950/40', border: 'border-yellow-700/50' },
    active: { label: compact ? 'Live' : 'Camera Active', dot: 'bg-green-400 animate-pulse', text: 'text-green-300', bg: 'bg-green-950/40', border: 'border-green-700/50' },
    denied: { label: compact ? 'Denied — Sim' : 'Permission Denied · Simulation Fallback', dot: 'bg-amber-500', text: 'text-amber-300', bg: 'bg-amber-950/40', border: 'border-amber-700/50' },
  };

  const c = configs[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${c.bg} ${c.border} ${c.text}`}
      aria-live="polite"
      aria-label={`Camera status: ${c.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}
