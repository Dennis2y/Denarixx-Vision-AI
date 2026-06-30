import Link from 'next/link';

const features = [
  {
    icon: '⚠',
    title: 'Hazard Intelligence',
    desc: 'Real-time detection of vehicles, steps, obstacles, and moving hazards with confidence scoring.',
  },
  {
    icon: '👁',
    title: 'Live Visual Intelligence',
    desc: 'Continuous scene understanding — not just labels, but context and meaning.',
  },
  {
    icon: '🧠',
    title: 'AI Memory',
    desc: 'Remembers your locations, routes, and preferences across sessions.',
  },
  {
    icon: '🔊',
    title: 'Voice-First Audio',
    desc: 'Priority-ordered speech output — critical hazard alerts always interrupt.',
  },
  {
    icon: '🧭',
    title: 'Navigation Foundation',
    desc: 'Obstacle-aware guidance with explicit uncertainty signals. GPS integration in Phase 2.',
  },
  {
    icon: '🔒',
    title: 'Privacy by Design',
    desc: 'Face recognition disabled. No emergency streaming. Consent-gated. GDPR-aware.',
  },
];

const phases = [
  {
    phase: 'Phase 1 — Now',
    label: 'Safety Core MVP',
    status: 'current',
    items: ['Hazard detection', 'Scene reasoning', 'Audio guidance', 'Memory foundation'],
  },
  {
    phase: 'Phase 2',
    label: 'Context & Trust',
    status: 'planned',
    items: ['AI Memory (full)', 'Conversation', 'Document reading', 'Face recognition (consent)'],
  },
  {
    phase: 'Phase 3',
    label: 'Expanded Capability',
    status: 'planned',
    items: ['Multi-language', 'Offline mode', 'Medication safety', 'GPS navigation'],
  },
  {
    phase: 'Phase 4',
    label: 'Platform & Hardware',
    status: 'planned',
    items: ['Smart glasses', 'Emergency Guardian', 'Custom AI hardware'],
  },
];

export default function LandingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Hero */}
      <section className="text-center mb-16" aria-labelledby="hero-heading">
        <div className="inline-flex items-center gap-2 bg-yellow-900/30 border border-yellow-700 rounded-full px-4 py-1.5 text-yellow-400 text-sm font-medium mb-6">
          Phase 1 MVP — Simulation Mode
        </div>
        <h1
          id="hero-heading"
          className="text-5xl font-black text-white mb-4 leading-tight"
        >
          Denarixx Vision AI
        </h1>
        <p className="text-xl text-gray-300 mb-2 max-w-2xl mx-auto">
          An AI perception platform that gives blind and visually impaired people
          greater awareness, safety, and independence.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Assistive support only — not medically certified — always use your own judgement.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/session"
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-4 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
            aria-label="Start a vision session"
          >
            ▶ Start Vision Session
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            Developer Docs
          </Link>
        </div>
      </section>

      {/* Warning banner */}
      <section
        className="bg-orange-950 border border-orange-700 rounded-xl p-4 mb-12 text-center"
        role="alert"
        aria-label="Important safety disclaimer"
      >
        <p className="text-orange-200 text-sm">
          <strong>Important:</strong> This is a Phase 1 simulation MVP. All scene
          analysis is simulated. Do not rely on this system for real-world safety decisions.
          A trained model and real camera input will be required for production use.
        </p>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="mb-16">
        <h2
          id="features-heading"
          className="text-2xl font-bold text-white text-center mb-8"
        >
          Phase 1 Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-700 rounded-xl p-5"
            >
              <div className="text-3xl mb-3" aria-hidden="true">
                {f.icon}
              </div>
              <h3 className="font-bold text-white mb-1">{f.title}</h3>
              <p className="text-gray-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section aria-labelledby="roadmap-heading" className="mb-16">
        <h2
          id="roadmap-heading"
          className="text-2xl font-bold text-white text-center mb-8"
        >
          Build Roadmap
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {phases.map((p) => (
            <div
              key={p.phase}
              className={`rounded-xl p-4 border ${
                p.status === 'current'
                  ? 'bg-yellow-950 border-yellow-700'
                  : 'bg-gray-900 border-gray-700 opacity-70'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">{p.phase}</p>
              <p className="font-bold text-white text-sm mb-2">{p.label}</p>
              {p.status === 'current' && (
                <span className="text-xs text-yellow-400 font-semibold">● Active</span>
              )}
              <ul className="mt-2 space-y-1">
                {p.items.map((item) => (
                  <li key={item} className="text-gray-400 text-xs flex gap-1">
                    <span aria-hidden="true">{p.status === 'current' ? '✓' : '○'}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section aria-labelledby="quicklinks-heading">
        <h2 id="quicklinks-heading" className="text-xl font-bold text-white mb-4">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/session', label: '▶ Vision Session', desc: 'Start scanning' },
            { href: '/admin', label: '📊 Admin Dashboard', desc: 'Metrics & sessions' },
            { href: '/memory', label: '🧠 Memory', desc: 'Saved locations & routes' },
            { href: '/privacy', label: '🔒 Privacy', desc: 'Consent & data settings' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl p-4 block focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors"
            >
              <p className="font-semibold text-white text-sm">{link.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
