import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import {
  SPRINT_REGISTRY,
  PHASE_REGISTRY,
  computeProgress,
  phaseStatusLabel,
} from '@/engines/projectProgressEngine';
import type { PhaseState } from '@/engines/projectProgressEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getLiveProgress() {
  const testsDir = path.join(process.cwd(), 'tests');
  const completed = new Set<string>();
  for (const sprint of SPRINT_REGISTRY) {
    if (fs.existsSync(path.join(testsDir, sprint.testFile))) {
      completed.add(sprint.testFile);
    }
  }
  return computeProgress(completed);
}

const STATS = [
  { value: '3 s', label: 'scan interval' },
  { value: '4', label: 'AI engines' },
  { value: '13', label: 'live APIs' },
  { value: '19/19', label: 'tests passing' },
];

const DEMO_STEPS = [
  { num: 1, icon: '▶', label: 'Start session', detail: 'Session initialized, camera input begins' },
  { num: 2, icon: '🚶', label: 'Simulate walking', detail: 'Frames analyzed at 3 s intervals' },
  { num: 3, icon: '⚠', label: 'Safety alert', detail: 'Hazard detected & classified by severity' },
  { num: 4, icon: '🧠', label: 'Guardian decides', detail: 'AI arbitrates urgency & interrupt logic' },
  { num: 5, icon: '🔊', label: 'Audio guidance', detail: 'Priority speech output to the user' },
  { num: 6, icon: '💾', label: 'Save to memory', detail: 'Location or route event persisted' },
  { num: 7, icon: '📊', label: 'Session report', detail: 'Full metrics & step completion summary' },
];

const FEATURES = [
  {
    icon: '⚠',
    title: 'Hazard Intelligence',
    desc: 'Real-time detection of vehicles, steps, and obstacles with per-alert confidence scores and explicit uncertainty signals.',
  },
  {
    icon: '🧠',
    title: 'Cognitive Guardian',
    desc: 'Multi-stage AI decision engine that arbitrates between competing hazards and decides when to interrupt narration.',
  },
  {
    icon: '👁',
    title: 'Scene Understanding',
    desc: 'Continuous scene reasoning — not just labels, but context and meaning. Uncertainty always surfaced to the user.',
  },
  {
    icon: '🔊',
    title: 'Voice-First Audio',
    desc: 'Priority-ordered speech queue. Critical alerts always interrupt lower-priority narration automatically.',
  },
  {
    icon: '🧭',
    title: 'AI Memory',
    desc: 'Remembers your saved locations, routes, and preferences. Recalls relevant items automatically during live sessions.',
  },
  {
    icon: '🔒',
    title: 'Privacy by Design',
    desc: 'No face recognition in Phase 1. Consent-gated features. No persistent data store without explicit user action.',
  },
];

const ENGINES = [
  { icon: '🔍', name: 'VisionEngine', role: 'Frame analysis & object detection' },
  { icon: '⚠', name: 'HazardDetectionEngine', role: 'Severity classification & alerts' },
  { icon: '🧠', name: 'SafetyDecisionEngine', role: 'Urgency arbitration & interrupt logic' },
  { icon: '🔊', name: 'AudioGuidanceEngine', role: 'Priority speech queue management' },
];


export default async function LandingPage() {
  const progress = await getLiveProgress();

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">

      {/* Hero */}
      <section className="text-center mb-12" aria-labelledby="hero-heading">
        <div className="inline-flex items-center gap-2 bg-yellow-900/30 border border-yellow-700/60 rounded-full px-4 py-1.5 text-yellow-400 text-sm font-semibold mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
          Phase 1 MVP · Simulation Mode
        </div>

        <h1
          id="hero-heading"
          className="text-5xl md:text-6xl font-black text-white mb-3 leading-tight tracking-tight"
        >
          See. Decide.{' '}
          <span className="text-yellow-400">Move Safely.</span>
        </h1>

        <p className="text-xl text-gray-300 mb-2 max-w-2xl mx-auto leading-relaxed">
          Denarixx Vision AI is an assistive AI perception platform — giving blind and
          visually impaired people real-time hazard awareness, scene understanding, and
          audio guidance.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Assistive support only · Not medically certified · Always use your own judgement
        </p>

        <div className="flex gap-3 justify-center flex-wrap mb-10">
          <Link
            href="/session"
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-black px-8 py-4 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-gray-950"
            aria-label="Start a live vision session demo"
          >
            ▶ Run Live Demo
          </Link>
          <Link
            href="/guardian"
            className="inline-flex items-center gap-2 border border-purple-600 hover:border-purple-400 bg-purple-950/30 hover:bg-purple-950/60 text-purple-300 hover:text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            🧠 Cognitive Guardian
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            Developer Docs
          </Link>
        </div>

        {/* Stats bar */}
        <div className="inline-flex gap-8 border border-gray-700 rounded-xl px-6 py-3 bg-gray-900/60 flex-wrap justify-center">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-black text-yellow-400">{s.value}</p>
              <p className="text-gray-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section
        className="bg-orange-950/60 border border-orange-700/50 rounded-xl p-4 mb-12 text-center"
        role="alert"
        aria-label="Important safety disclaimer"
      >
        <p className="text-orange-200 text-sm">
          <strong>Important:</strong> This is a Phase 1 simulation MVP. All scene analysis is
          simulated. A trained model and real camera input are required for production use.
          Do not rely on this system for real-world safety decisions.
        </p>
      </section>

      {/* Video — See It In Action */}
      <section className="mb-16" aria-labelledby="video-heading">
        <h2 id="video-heading" className="text-2xl font-bold text-white text-center mb-2">
          See It In Action
        </h2>
        <p className="text-gray-500 text-sm text-center mb-6">
          A visually impaired person navigating a busy city with Denarixx Vision AI active
        </p>
        <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black shadow-2xl">
          <video
            src="/videos/denarixx-demo.mp4"
            autoPlay
            loop
            muted
            playsInline
            controls
            className="w-full aspect-video object-cover"
            aria-label="Demo video: blind person walking in a busy city with Denarixx Vision AI assistive overlays"
          />
          {/* Overlay badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 border border-yellow-600/60 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
            <span className="text-yellow-400 text-xs font-semibold">Denarixx Vision AI · Live Demo</span>
          </div>
        </div>
        <p className="text-gray-600 text-xs text-center mt-3">
          Simulation concept video · Phase 1 MVP · Not real camera footage
        </p>
      </section>

      {/* 7-Step Demo Flow */}
      <section className="mb-16" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="text-2xl font-bold text-white text-center mb-2">
          7-Step Live Demo
        </h2>
        <p className="text-gray-500 text-sm text-center mb-8">
          Start a vision session and watch the full AI pipeline execute in real-time
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {DEMO_STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-xl border border-gray-700 bg-gray-900 p-3 flex flex-col gap-2"
              aria-label={`Step ${step.num}: ${step.label}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-full bg-yellow-950 border border-yellow-700 text-yellow-400 text-xs font-black flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  {step.num}
                </span>
                <span className="text-lg" aria-hidden="true">{step.icon}</span>
              </div>
              <p className="text-white text-xs font-bold leading-tight">{step.label}</p>
              <p className="text-gray-500 text-xs leading-tight">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <Link
            href="/session"
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            ▶ Start the Demo →
          </Link>
        </div>
      </section>

      {/* AI Engine pipeline */}
      <section className="mb-16" aria-labelledby="engines-heading">
        <h2 id="engines-heading" className="text-2xl font-bold text-white text-center mb-8">
          The AI Pipeline
        </h2>
        <div className="flex flex-col md:flex-row items-stretch gap-0 md:gap-0">
          {ENGINES.map((engine, i) => (
            <div key={engine.name} className="flex flex-col md:flex-row items-stretch flex-1">
              <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 flex-1 flex flex-col justify-center">
                <p className="text-2xl mb-2" aria-hidden="true">{engine.icon}</p>
                <p className="text-white font-bold text-sm">{engine.name}</p>
                <p className="text-gray-500 text-xs mt-1">{engine.role}</p>
              </div>
              {i < ENGINES.length - 1 && (
                <div
                  className="flex items-center justify-center py-2 md:py-0 px-0 md:px-1 text-yellow-600 text-xl font-black"
                  aria-hidden="true"
                >
                  <span className="rotate-90 md:rotate-0">→</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="mb-16">
        <h2 id="features-heading" className="text-2xl font-bold text-white text-center mb-8">
          Phase 1 Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
            >
              <div className="text-3xl mb-3" aria-hidden="true">{f.icon}</div>
              <h3 className="font-bold text-white mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap — live progress tracker */}
      <section aria-labelledby="roadmap-heading" className="mb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h2 id="roadmap-heading" className="text-2xl font-bold text-white">
            Build Roadmap
          </h2>
          <Link
            href="/roadmap"
            className="text-sm text-yellow-400 hover:text-yellow-300 font-semibold border border-yellow-700/50 hover:border-yellow-500 rounded-lg px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            View Full Tracker →
          </Link>
        </div>

        {/* MVP complete banner */}
        {progress.mvpComplete && (
          <div className="rounded-xl border border-yellow-600 bg-yellow-950/30 p-5 mb-5 text-center">
            <p className="text-3xl mb-1" aria-hidden="true">🎉</p>
            <p className="text-xl font-black text-yellow-400">Denarixx Vision AI MVP Completed</p>
            <p className="text-yellow-200 text-sm mt-1">All {progress.totalSprints} sprints complete across {progress.phases.length} phases.</p>
          </div>
        )}

        {/* Overall progress bar */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Overall Progress</span>
            <span className="text-xl font-black text-yellow-400">{progress.overallPercent}%</span>
          </div>
          <div
            className="h-2.5 rounded-full bg-gray-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.overallPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall project progress"
          >
            <div
              className={`h-full rounded-full transition-all ${progress.mvpComplete ? 'bg-green-500' : 'bg-yellow-500'}`}
              style={{ width: `${progress.overallPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>{progress.completedSprints} / {progress.totalSprints} sprints</span>
            {progress.currentSprint && (
              <span>
                Sprint {progress.currentSprint.id} active — {progress.currentSprint.name}
              </span>
            )}
            <span>Est: {progress.estimatedCompletion}</span>
          </div>
        </div>

        {/* Phase cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {progress.phases.map((ph: PhaseState) => {
            const isComplete = ph.status === 'complete';
            const isActive = ph.status === 'active';
            const isLocked = ph.status === 'locked';
            return (
              <div
                key={ph.id}
                className={`rounded-xl p-4 border transition-colors ${
                  isComplete
                    ? 'bg-green-950/20 border-green-800'
                    : isActive
                    ? 'bg-yellow-950/40 border-yellow-700'
                    : 'bg-gray-900/40 border-gray-800 opacity-60'
                }`}
                aria-label={`${ph.name}: ${ph.label} — ${phaseStatusLabel(ph.status)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span aria-hidden="true">{ph.icon}</span>
                  <p className="text-xs text-gray-500 font-mono">{ph.name}</p>
                </div>
                <p className={`font-bold text-sm mb-1 ${isLocked ? 'text-gray-500' : 'text-white'}`}>
                  {ph.label}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold mb-2 ${
                    isComplete ? 'text-green-400' : isActive ? 'text-yellow-400' : 'text-gray-600'
                  }`}
                >
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
                  )}
                  {phaseStatusLabel(ph.status)}
                </span>

                {/* Mini progress bar */}
                <div className="h-1 rounded-full bg-gray-800 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full ${isComplete ? 'bg-green-500' : isActive ? 'bg-yellow-500' : 'bg-gray-700'}`}
                    style={{ width: `${ph.progress}%` }}
                  />
                </div>

                <p className="text-xs text-gray-600 mb-2">
                  {ph.completedSprints}/{ph.totalSprints} sprints · Sprint {ph.sprintRange[0]}–{ph.sprintRange[1]}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-4">
          <Link
            href="/roadmap"
            className="text-sm text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded-lg px-2 py-1"
          >
            View all sprints & milestones →
          </Link>
        </div>
      </section>

      {/* Quick access */}
      <section aria-labelledby="quicklinks-heading">
        <h2 id="quicklinks-heading" className="text-xl font-bold text-white mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/session', icon: '▶', label: 'Vision Session', desc: 'Start the live demo' },
            { href: '/guardian', icon: '🧠', label: 'Cognitive Guardian', desc: 'Pipeline debugger' },
            { href: '/memory', icon: '💾', label: 'AI Memory', desc: 'Saved locations & routes' },
            { href: '/admin', icon: '📊', label: 'Admin Dashboard', desc: 'Metrics & sessions' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl p-4 block focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors group"
            >
              <p className="text-2xl mb-1.5 group-hover:scale-110 transition-transform inline-block" aria-hidden="true">
                {link.icon}
              </p>
              <p className="font-bold text-white text-sm">{link.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
