import Link from 'next/link';

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

const PHASES = [
  {
    phase: 'Phase 1 — Now',
    label: 'Safety Core MVP',
    status: 'current',
    items: ['Hazard detection', 'Scene reasoning', 'Audio guidance', 'Memory foundation', 'Cognitive Guardian'],
  },
  {
    phase: 'Phase 2',
    label: 'Context & Trust',
    status: 'planned',
    items: ['Full AI Memory', 'Conversation AI', 'Document reading', 'Face recognition (consent)'],
  },
  {
    phase: 'Phase 3',
    label: 'Expanded Access',
    status: 'planned',
    items: ['Multi-language', 'Offline mode', 'Medication safety', 'GPS navigation'],
  },
  {
    phase: 'Phase 4',
    label: 'Platform & Hardware',
    status: 'planned',
    items: ['Smart glasses', 'Emergency Guardian', 'Custom AI hardware', 'SDK for partners'],
  },
];

export default function LandingPage() {
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

      {/* Roadmap */}
      <section aria-labelledby="roadmap-heading" className="mb-16">
        <h2 id="roadmap-heading" className="text-2xl font-bold text-white text-center mb-8">
          Build Roadmap
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PHASES.map((p) => (
            <div
              key={p.phase}
              className={`rounded-xl p-4 border ${
                p.status === 'current'
                  ? 'bg-yellow-950/40 border-yellow-700'
                  : 'bg-gray-900/60 border-gray-800 opacity-60'
              }`}
            >
              <p className="text-xs text-gray-500 mb-1 font-mono">{p.phase}</p>
              <p className="font-bold text-white text-sm mb-1">{p.label}</p>
              {p.status === 'current' && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-400 font-semibold mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
                  Active
                </span>
              )}
              <ul className="space-y-1 mt-2">
                {p.items.map((item) => (
                  <li key={item} className="text-gray-400 text-xs flex gap-1.5 items-start">
                    <span aria-hidden="true" className="text-gray-600">
                      {p.status === 'current' ? '✓' : '○'}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
