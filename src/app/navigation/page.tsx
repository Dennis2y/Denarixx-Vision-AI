'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createNavigationSession,
  processNavigationTick,
  selectGuidance,
  currentSegment,
  nextSegment,
  getRouteProgressPct,
  getRouteStateLabel,
  isRouteActive,
  pauseNavigation,
  resumeNavigation,
  endNavigationSession,
} from '@/engines/navigationIntelligenceEngine';
import { evaluateCrossing, buildCrossingGuidanceLine } from '@/engines/crossingDecisionEngine';
import { assessRouteRisk, getRiskLabel, getRiskColor } from '@/engines/routeSafetyEngine';
import { formatDistance } from '@/engines/outdoorNavigationEngine';
import { parseHeading } from '@/engines/outdoorNavigationEngine';
import { getVenueModeIntro } from '@/engines/indoorNavigationEngine';
import { NAVIGATION_PRIVACY } from '@/types/navigation';
import type {
  NavigationSession,
  NavigationMode,
  CrossingDecision,
  GuidanceLine,
  IndoorVenueMode,
} from '@/types/navigation';

// ─── Simulation scenario labels ───────────────────────────────────────────────
const OUTDOOR_LABELS = ['person', 'pavement', 'sign'];
const CROSSING_LABELS = ['car', 'traffic_light', 'crosswalk'];
const INDOOR_LABELS = ['chair', 'table', 'door'];

function speakText(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.05;
    window.speechSynthesis.speak(utt);
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NavigationPage() {
  const [mode, setMode] = useState<NavigationMode>('outdoor');
  const [venueMode, setVenueMode] = useState<IndoorVenueMode>('generic');
  const [destination, setDestination] = useState('');
  const [session, setSession] = useState<NavigationSession | null>(null);
  const [crossingDecision, setCrossingDecision] = useState<CrossingDecision | null>(null);
  const [guidanceLog, setGuidanceLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);

  const tickRef = useRef(0);
  const lastSpokenAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addGuidance = useCallback((text: string) => {
    setGuidanceLog((prev) => [text, ...prev].slice(0, 6));
    speakText(text);
    lastSpokenAtRef.current = Date.now();
  }, []);

  const runTick = useCallback((currentSession: NavigationSession) => {
    const tick = tickRef.current++;
    const { session: updated, guidance } = processNavigationTick(
      currentSession,
      tick,
      lastSpokenAtRef.current,
    );

    // Detect crossing segments and evaluate
    const seg = currentSegment(updated);
    if (seg?.type === 'crossing') {
      const labels = mode === 'outdoor' ? CROSSING_LABELS : INDOOR_LABELS;
      const decision = evaluateCrossing(labels, 'crossing');
      setCrossingDecision(decision);

      const crossingLine = buildCrossingGuidanceLine(decision);
      const now = Date.now();
      if (now - lastSpokenAtRef.current > 5000) {
        addGuidance(crossingLine.text);
      }
    } else {
      setCrossingDecision(null);
    }

    if (guidance) addGuidance(guidance.text);

    if (updated.state === 'arrived') {
      addGuidance(`You have arrived at ${updated.destination}.`);
      setRunning(false);
    }

    setSession(updated);
    return updated;
  }, [mode, addGuidance]);

  useEffect(() => {
    if (!running || !session) return;

    let current = session;
    intervalRef.current = setInterval(() => {
      current = runTick(current);
      if (current.state === 'arrived') {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, runTick]); // deliberately omit session to avoid re-subscribing on each state update

  const handleStart = () => {
    if (!destination.trim()) return;
    tickRef.current = 0;
    lastSpokenAtRef.current = 0;
    setGuidanceLog([]);
    setCrossingDecision(null);

    const newSession = createNavigationSession(destination.trim(), mode, locationConsent, { venueMode });
    setSession(newSession);
    setRunning(true);

    const intro = mode === 'indoor' ? getVenueModeIntro(venueMode) : `Navigating to ${destination}.`;
    addGuidance(intro);
  };

  const handleStop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (session) setSession(endNavigationSession(session));
  };

  const handlePauseResume = () => {
    if (!session) return;
    if (session.state === 'paused') {
      const resumed = resumeNavigation(session);
      setSession(resumed);
      setRunning(true);
    } else {
      const paused = pauseNavigation(session);
      setSession(paused);
      setRunning(false);
      addGuidance('Navigation paused.');
    }
  };

  const currentSeg = session ? currentSegment(session) : null;
  const nextSeg = session ? nextSegment(session) : null;
  const progress = session ? getRouteProgressPct(session) : 0;
  const isActive = session ? isRouteActive(session) : false;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-yellow-400">🧭 Navigation Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">Indoor & outdoor guidance — simulation mode</p>
        </div>

        {/* Privacy bar */}
        <div className="bg-green-950 border border-green-800/40 rounded-xl px-5 py-2 flex flex-wrap gap-4 text-xs text-green-400">
          <span>✓ no precise location by default</span>
          <span>✓ route memory only with consent</span>
          <span>✓ no third-party sharing</span>
        </div>

        {/* Config */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['outdoor', 'indoor'] as NavigationMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setSession(null); setRunning(false); }}
                disabled={running}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                  mode === m
                    ? 'bg-yellow-400 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {m === 'outdoor' ? '🌳 Outdoor' : '🏢 Indoor'}
              </button>
            ))}
            {mode === 'indoor' && (
              <select
                value={venueMode}
                onChange={(e) => setVenueMode(e.target.value as IndoorVenueMode)}
                disabled={running}
                className="ml-auto bg-gray-800 border border-gray-600 rounded-xl px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                <option value="generic">Generic</option>
                <option value="office">Office</option>
                <option value="supermarket">Supermarket</option>
                <option value="station">Station</option>
                <option value="airport">Airport</option>
                <option value="shopping_mall">Shopping Mall</option>
              </select>
            )}
          </div>

          {/* Destination */}
          <div className="flex gap-3">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !running && handleStart()}
              placeholder={mode === 'outdoor' ? 'e.g. Bus stop, Park, Station…' : 'e.g. Exit, Elevator, Stairs…'}
              disabled={running}
              aria-label="Enter destination"
              className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
            />
          </div>

          {/* Location consent */}
          <label className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={locationConsent}
              onChange={(e) => setLocationConsent(e.target.checked)}
              className="w-4 h-4 accent-yellow-400"
              disabled={running}
            />
            I consent to route memory being saved (optional)
          </label>

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            {!running && session?.state !== 'arrived' && (
              <button
                onClick={handleStart}
                disabled={!destination.trim()}
                className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold disabled:opacity-40 transition-colors"
              >
                ▶ Start Navigation
              </button>
            )}
            {running && (
              <>
                <button
                  onClick={handlePauseResume}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
                >
                  {session?.state === 'paused' ? '▶ Resume' : '⏸ Pause'}
                </button>
                <button
                  onClick={handleStop}
                  className="px-5 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                >
                  ⏹ Stop
                </button>
              </>
            )}
            {session?.state === 'arrived' && (
              <button
                onClick={() => { setSession(null); setRunning(false); setGuidanceLog([]); }}
                className="px-5 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors"
              >
                ✓ New Route
              </button>
            )}
          </div>
        </div>

        {/* Main grid */}
        {session && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Route status */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Route Status</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  session.state === 'navigating' ? 'bg-yellow-900/50 text-yellow-400'
                  : session.state === 'arrived' ? 'bg-green-900/50 text-green-400'
                  : session.state === 'paused' ? 'bg-blue-900/50 text-blue-400'
                  : 'bg-gray-800 text-gray-400'
                }`}>
                  {getRouteStateLabel(session.state)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ['Destination', session.destination],
                  ['Mode', session.mode === 'indoor' ? `Indoor (${session.venueMode})` : 'Outdoor'],
                  ['Heading', `${Math.round(session.currentHeadingDeg)}° ${parseHeading(session.currentHeadingDeg)}`],
                  ['Remaining', formatDistance(session.distanceRemainingM)],
                  ['Risk', getRiskLabel(session.riskLevel)],
                  ['Segment', `${session.currentSegmentIndex + 1} / ${session.segments.length}`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-800 rounded-xl p-2">
                    <p className="text-gray-500">{label}</p>
                    <p className={`font-medium text-xs mt-0.5 ${label === 'Risk' ? getRiskColor(session.riskLevel) : 'text-white'}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Current instruction */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Current Instruction</h3>
              {currentSeg ? (
                <div className="space-y-3">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <p className={`text-base font-semibold ${
                      currentSeg.type === 'crossing' ? 'text-orange-300'
                      : currentSeg.type === 'stairs' ? 'text-yellow-300'
                      : 'text-white'
                    }`}>
                      {currentSeg.instruction}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {currentSeg.type.replace(/_/g, ' ')} · {formatDistance(currentSeg.estimatedDistanceM)}
                    </p>
                  </div>
                  {nextSeg && (
                    <div className="bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">Then:</p>
                      <p className="text-sm text-gray-300">{nextSeg.instruction}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No active instruction</p>
              )}
            </div>

            {/* Crossing decision */}
            {crossingDecision && (
              <div className={`bg-gray-900 border rounded-2xl p-5 space-y-3 col-span-full ${
                crossingDecision.riskLevel === 'critical' ? 'border-red-700'
                : crossingDecision.riskLevel === 'high' ? 'border-orange-700'
                : 'border-yellow-700'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">⚠️ Crossing Decision</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    crossingDecision.riskLevel === 'critical' ? 'bg-red-900/60 text-red-300'
                    : crossingDecision.riskLevel === 'high' ? 'bg-orange-900/60 text-orange-300'
                    : 'bg-yellow-900/60 text-yellow-300'
                  }`}>
                    {getRiskLabel(crossingDecision.riskLevel)}
                  </span>
                </div>
                <p className="text-white font-medium">{crossingDecision.message}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-800 rounded-xl p-2">
                    <p className="text-gray-500">Vehicles</p>
                    <p className="text-white font-mono">{crossingDecision.vehiclesDetected}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-2">
                    <p className="text-gray-500">Signal</p>
                    <p className="text-white font-mono">{crossingDecision.lightState}</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-2">
                    <p className="text-gray-500">Action</p>
                    <p className="text-white font-mono">{crossingDecision.suggestedAction.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 border-t border-gray-700 pt-2">
                  Assistive only — always stop and check carefully before crossing. Never rely solely on this system.
                </p>
              </div>
            )}

            {/* Simulated route map */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Simulated Route</h3>
              <svg viewBox="0 0 300 180" className="w-full h-36 bg-gray-800 rounded-xl" aria-hidden="true">
                {/* Route line */}
                <line x1="30" y1="150" x2="270" y2="30" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
                {/* Segments */}
                {session.segments.map((seg, i) => {
                  const x = 30 + (i / Math.max(session.segments.length - 1, 1)) * 240;
                  const y = 150 - (i / Math.max(session.segments.length - 1, 1)) * 120;
                  const active = i === session.currentSegmentIndex;
                  const done = i < session.currentSegmentIndex;
                  return (
                    <g key={seg.segmentId}>
                      <circle
                        cx={x} cy={y} r={active ? 10 : 6}
                        fill={done ? '#22c55e' : active ? '#facc15' : '#4b5563'}
                        stroke={active ? '#fde68a' : 'none'}
                        strokeWidth={active ? 3 : 0}
                      />
                      {seg.type === 'crossing' && (
                        <text x={x} y={y - 14} textAnchor="middle" fill="#f97316" fontSize="10">⚠</text>
                      )}
                      {seg.type === 'stairs' && (
                        <text x={x} y={y - 14} textAnchor="middle" fill="#fbbf24" fontSize="10">▲</text>
                      )}
                    </g>
                  );
                })}
                {/* Start / End labels */}
                <text x="30" y="168" fill="#6b7280" fontSize="9">Start</text>
                <text x="245" y="22" fill="#6b7280" fontSize="9">{session.destination.slice(0, 10)}</text>
              </svg>
              <p className="text-xs text-gray-600 mt-2 text-center">
                🟡 Current · 🟢 Done · ⚠ Crossing · ▲ Stairs
              </p>
            </div>

            {/* Guidance log */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">🔊 Guidance Queue</h3>
              <div className="space-y-2">
                {guidanceLog.length === 0 && (
                  <p className="text-gray-500 text-sm">No guidance yet</p>
                )}
                {guidanceLog.map((text, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      i === 0 ? 'bg-yellow-900/40 text-yellow-100 border border-yellow-700/40' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Route segments */}
        {session && session.segments.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Full Route</h3>
            <div className="space-y-2">
              {session.segments.map((seg, i) => {
                const isCurrentSeg = i === session.currentSegmentIndex;
                const isDone = i < session.currentSegmentIndex;
                return (
                  <div
                    key={seg.segmentId}
                    className={`flex items-center gap-3 text-xs rounded-xl px-3 py-2 ${
                      isCurrentSeg ? 'bg-yellow-900/40 border border-yellow-700/40'
                      : isDone ? 'bg-gray-800/40 text-gray-500'
                      : 'bg-gray-800'
                    }`}
                  >
                    <span className="font-mono w-6 text-center text-gray-500">{i + 1}</span>
                    <span className={isCurrentSeg ? 'text-yellow-200 font-medium' : isDone ? 'line-through text-gray-600' : 'text-gray-300'}>
                      {seg.instruction}
                    </span>
                    <span className="ml-auto text-gray-600">{formatDistance(seg.estimatedDistanceM)}</span>
                    {seg.type === 'crossing' && <span className="text-orange-400">⚠</span>}
                    {seg.type === 'stairs' && <span className="text-yellow-400">▲</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Privacy notes */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-white">Location Privacy</h3>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            <li>No precise GPS coordinates are stored by default</li>
            <li>Route memory is only saved if you explicitly tick the consent checkbox</li>
            <li>No location data is shared with third parties</li>
            <li>All navigation data is processed locally on this device</li>
            <li>This is an assistive tool only — always verify your surroundings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
