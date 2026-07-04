'use client';

/**
 * VoiceCommandIndicator (V5)
 *
 * Compact status badge showing the voice command listener state.
 * Shows: supported / listening / last command / transcript.
 * Accessible: aria-live polite for screen readers.
 */

import type { ParsedVoiceCommand } from '@/hooks/useVoiceCommands';

interface VoiceCommandIndicatorProps {
  isSupported: boolean;
  isListening: boolean;
  lastCommand: ParsedVoiceCommand | null;
  lastTranscript: string;
  onToggle: () => void;
}

const COMMAND_LABELS: Record<string, string> = {
  start_session: 'Start Session',
  stop_session: 'Stop Session',
  repeat_last: 'Repeat Last',
  describe_surroundings: 'Describe Surroundings',
  where_am_i: 'Where Am I',
  what_should_i_do: 'What Should I Do',
  save_this_place: 'Save This Place',
  emergency_stop: 'Emergency Stop',
};

export function VoiceCommandIndicator({
  isSupported,
  isListening,
  lastCommand,
  lastTranscript,
  onToggle,
}: VoiceCommandIndicatorProps) {
  if (!isSupported) {
    return (
      <div
        className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-500"
        role="status"
        aria-label="Voice commands not available in this browser"
      >
        <span aria-hidden="true">🎙</span>
        <span>Voice commands not available in this browser</span>
      </div>
    );
  }

  const commandLabel = lastCommand?.command
    ? COMMAND_LABELS[lastCommand.command] ?? lastCommand.command
    : null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
        isListening
          ? 'bg-purple-950/40 border-purple-700/60'
          : 'bg-gray-800/60 border-gray-700'
      }`}
      aria-live="polite"
      aria-label={isListening ? 'Voice commands active — listening' : 'Voice commands inactive'}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border text-sm font-bold transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
          isListening
            ? 'bg-purple-600 border-purple-500 text-white animate-pulse'
            : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
        }`}
        aria-label={isListening ? 'Stop voice command listening' : 'Start voice command listening'}
        aria-pressed={isListening}
      >
        🎙
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${isListening ? 'text-purple-300' : 'text-gray-500'}`}>
            Voice Commands
          </span>
          {isListening && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" aria-hidden="true" />
              Listening
            </span>
          )}
        </div>

        {isListening && lastTranscript && (
          <p className="text-gray-400 text-xs truncate" aria-label={`Heard: ${lastTranscript}`}>
            Heard: <span className="text-white">{lastTranscript}</span>
          </p>
        )}

        {lastCommand && lastCommand.command !== 'unknown' && commandLabel && (
          <p className="text-xs mt-0.5">
            <span className="text-gray-500">Last: </span>
            <span className="text-yellow-400 font-semibold">{commandLabel}</span>
          </p>
        )}

        {!isListening && (
          <p className="text-gray-600 text-xs">
            Press mic to enable hands-free control
          </p>
        )}
      </div>

      {/* Available commands tooltip-style hint */}
      {isListening && (
        <details className="shrink-0">
          <summary className="text-gray-600 text-xs cursor-pointer hover:text-gray-400 list-none" aria-label="Show available voice commands">
            ?
          </summary>
          <div className="absolute mt-1 right-0 z-10 bg-gray-900 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 space-y-0.5 w-48 shadow-xl">
            <p className="text-gray-300 font-semibold mb-1.5">Voice Commands</p>
            {Object.entries(COMMAND_LABELS).map(([, label]) => (
              <p key={label} className="text-yellow-400 font-mono">{label.toLowerCase()}</p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
