'use client';

/**
 * useVoiceCommandRouter (Sprint 7)
 *
 * Wires the voice recognition pipeline (useVoiceCommands) to the command
 * router (voiceCommandRouterEngine) and dispatches to each target system
 * via caller-supplied handler callbacks.
 *
 * Architecture:
 *   Speech → useVoiceCommands → VoiceCommandEngine.parse()
 *       → routeVoiceCommand(context) → VoiceCommandDispatch
 *       → speak confirmation → invoke handler callback
 *
 * Safety guarantees (inherited from router engine):
 *   - emergency_stop fires before any other handler, cannot be blocked.
 *   - save_this_place only fires when locationConsentGiven is true.
 *   - No handler enables face recognition.
 *   - No location is stored without explicit "save this place" intent.
 */

import { useCallback, useRef } from 'react';
import { useVoiceCommands } from './useVoiceCommands';
import type { UseVoiceCommandsReturn } from './useVoiceCommands';
import { routeVoiceCommand } from '@/engines/voiceCommandRouterEngine';
import type { RouterContext, VoiceCommandDispatch } from '@/engines/voiceCommandRouterEngine';
import type { VoiceCommandType } from '@/engines/voiceCommandEngine';
import type { GuidancePersonality } from '@/engines/guidancePersonalityEngine';

// ─── Handler interface ────────────────────────────────────────────────────────

export interface VoiceCommandHandlers {
  /** Start a new vision session. */
  onStartSession?: () => void;
  /** Stop the current vision session. */
  onStopSession?: () => void;
  /** Re-speak the last spoken guidance message. */
  onRepeatLast?: () => void;
  /** Request a live scene description. */
  onDescribeSurroundings?: () => void;
  /** Request current location context from navigation. */
  onWhereAmI?: () => void;
  /** Request the Guardian's current recommended action. */
  onWhatShouldIDo?: () => void;
  /** Save the current location to landmark memory. */
  onSaveThisPlace?: () => void;
  /** Open / start a navigation session. */
  onStartNavigation?: () => void;
  /** End the active navigation session. */
  onStopNavigation?: () => void;
  /** Emergency stop: halt all active systems immediately. */
  onEmergencyStop?: () => void;
  /**
   * Called when a command was dispatched (blocked or executed).
   * Receives the full dispatch for logging / UI feedback.
   */
  onDispatch?: (dispatch: VoiceCommandDispatch) => void;
  /**
   * Called to speak a confirmation or blocked message.
   * Hook callers should pass their speak() function here.
   */
  onSpeak?: (text: string, priority: 'critical' | 'high' | 'normal' | 'low') => void;
}

// ─── Context builder ──────────────────────────────────────────────────────────

export interface VoiceRouterState {
  sessionActive: boolean;
  navigationActive: boolean;
  locationConsentGiven: boolean;
  personality: GuidancePersonality;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseVoiceCommandRouterReturn extends UseVoiceCommandsReturn {
  lastDispatch: VoiceCommandDispatch | null;
}

export function useVoiceCommandRouter(
  routerState: VoiceRouterState,
  handlers: VoiceCommandHandlers,
): UseVoiceCommandRouterReturn {
  const lastDispatchRef = useRef<VoiceCommandDispatch | null>(null);

  // Keep handler refs stable so the voice callback never captures stale closures.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const routerStateRef = useRef(routerState);
  routerStateRef.current = routerState;

  const onCommand = useCallback(
    (parsed: { command: VoiceCommandType }) => {
      const ctx: RouterContext = {
        sessionActive: routerStateRef.current.sessionActive,
        navigationActive: routerStateRef.current.navigationActive,
        locationConsentGiven: routerStateRef.current.locationConsentGiven,
        personality: routerStateRef.current.personality,
      };

      const dispatch = routeVoiceCommand(parsed.command, ctx);
      lastDispatchRef.current = dispatch;

      // Always fire onDispatch for logging / UI
      handlersRef.current.onDispatch?.(dispatch);

      // Speak confirmation or block message
      if (dispatch.confirmation) {
        const priority =
          dispatch.priority === 'emergency'
            ? 'critical'
            : dispatch.priority === 'high'
              ? 'high'
              : 'normal';
        handlersRef.current.onSpeak?.(dispatch.confirmation, priority);
      }

      if (dispatch.blocked) return;

      // ── Dispatch to target systems ────────────────────────────────────────
      switch (dispatch.command) {
        case 'emergency_stop':
          handlersRef.current.onEmergencyStop?.();
          break;
        case 'start_session':
          handlersRef.current.onStartSession?.();
          break;
        case 'stop_session':
          handlersRef.current.onStopSession?.();
          break;
        case 'repeat_last':
          handlersRef.current.onRepeatLast?.();
          break;
        case 'describe_surroundings':
          handlersRef.current.onDescribeSurroundings?.();
          break;
        case 'where_am_i':
          handlersRef.current.onWhereAmI?.();
          break;
        case 'what_should_i_do':
          handlersRef.current.onWhatShouldIDo?.();
          break;
        case 'save_this_place':
          handlersRef.current.onSaveThisPlace?.();
          break;
        case 'start_navigation':
          handlersRef.current.onStartNavigation?.();
          break;
        case 'stop_navigation':
          handlersRef.current.onStopNavigation?.();
          break;
      }
    },
    [], // stable — reads live values via refs
  );

  const voiceReturn = useVoiceCommands(onCommand);

  return {
    ...voiceReturn,
    lastDispatch: lastDispatchRef.current,
  };
}
