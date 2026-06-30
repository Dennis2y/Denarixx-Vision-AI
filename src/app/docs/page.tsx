import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

const API_ROUTES = [
  { method: 'GET', path: '/api/health', desc: 'System health check', body: null, response: '{ status, version, mode, timestamp }' },
  { method: 'POST', path: '/api/sessions/start', desc: 'Start a new vision session', body: null, response: '{ sessionId, startedAt }' },
  { method: 'POST', path: '/api/sessions/end', desc: 'End a session', body: '{ sessionId }', response: '{ sessionId, ended }' },
  { method: 'GET', path: '/api/sessions', desc: 'List all sessions', body: null, response: '{ sessions[], active, total }' },
  { method: 'POST', path: '/api/vision/analyze-frame', desc: 'Analyze a video frame for detections', body: '{ sessionId, imageData?, source }', response: '{ detections[], provider, latencyMs }' },
  { method: 'POST', path: '/api/hazards/evaluate', desc: 'Evaluate detections for hazards', body: '{ sessionId, detections[] }', response: '{ alerts[], count, hasHighPriority }' },
  { method: 'POST', path: '/api/safety/decide', desc: 'Safety decision from hazard alerts', body: '{ sessionId, alerts[] }', response: '{ decision }' },
  { method: 'POST', path: '/api/scene/describe', desc: 'Cloud-tier scene reasoning', body: '{ sessionId, detections[], imageData? }', response: '{ scene }' },
  { method: 'GET', path: '/api/memory', desc: 'Get all memory items', body: null, response: '{ items[], count }' },
  { method: 'POST', path: '/api/memory/save', desc: 'Save a memory item', body: '{ type, label, description, metadata }', response: '{ item }' },
  { method: 'POST', path: '/api/conversation/ask', desc: 'Ask the conversation engine', body: '{ sessionId, question, context? }', response: '{ answer }' },
  { method: 'POST', path: '/api/audio/speak', desc: 'Log and return audio request', body: '{ text, priority, interrupt }', response: '{ text, priority, instruction }' },
];

const ENGINES = [
  { name: 'VisionEngine', tier: 'Local', desc: 'Runs continuous frame analysis. Provider-swappable. Default: MockVisionProvider.' },
  { name: 'HazardDetectionEngine', tier: 'Local', desc: 'Rule-based classifier for safety-critical detections. Always-on, low latency.' },
  { name: 'SafetyDecisionEngine', tier: 'Local', desc: 'Decides whether to interrupt narration and assigns urgency levels.' },
  { name: 'SceneReasoningEngine', tier: 'Cloud', desc: 'Contextual scene understanding from detections. Simulated in Phase 1.' },
  { name: 'MemoryEngine', tier: 'Both', desc: 'Persistent queryable memory store for locations, routes, preferences.' },
  { name: 'ConversationEngine', tier: 'Cloud', desc: 'Rule-based Q&A in Phase 1. Plug in LLM in Phase 2.' },
  { name: 'NavigationEngine', tier: 'Local', desc: 'Stub navigation engine. GPS + routing integration planned for Phase 2.' },
];

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-white mb-2">Developer Documentation</h1>
      <p className="text-gray-400 text-sm mb-8">
        Denarixx Vision AI — Phase 1 MVP technical reference.
      </p>

      <section aria-labelledby="arch-heading" className="mb-10">
        <h2 id="arch-heading" className="text-xl font-bold text-white mb-4">Engine Pipeline</h2>
        <Card>
          <pre className="text-green-400 text-xs font-mono leading-relaxed overflow-x-auto">
{`Camera / Sensor Input
    ↓
Vision Engine (local tier — frame analysis)
    ↓
┌──────────────────────────────────────────┐
│ Local Tier (fast, always-on)             │
│   Hazard Detection Engine                │
│   Safety Decision Engine                 │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│ Cloud Tier (richer, slower)              │
│   Scene Reasoning Engine                 │
│   Object Intelligence Engine (Phase 2)  │
└──────────────────────────────────────────┘
    ↓
Memory Engine ← recalls relevant context
    ↓
Conversation Engine + Accessibility Engine
    ↓
Audio Guidance Engine (Web Speech API)`}
          </pre>
        </Card>
      </section>

      <section aria-labelledby="engines-heading" className="mb-10">
        <h2 id="engines-heading" className="text-xl font-bold text-white mb-4">Engines</h2>
        <div className="space-y-3">
          {ENGINES.map((e) => (
            <Card key={e.name}>
              <div className="flex items-start gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                  e.tier === 'Local' ? 'bg-blue-900 text-blue-300' :
                  e.tier === 'Cloud' ? 'bg-purple-900 text-purple-300' :
                  'bg-gray-800 text-gray-300'
                }`}>
                  {e.tier}
                </span>
                <div>
                  <p className="text-white font-mono font-semibold text-sm">{e.name}</p>
                  <p className="text-gray-400 text-sm">{e.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="api-heading" className="mb-10">
        <h2 id="api-heading" className="text-xl font-bold text-white mb-4">API Routes</h2>
        <div className="space-y-2">
          {API_ROUTES.map((r) => (
            <Card key={r.path}>
              <div className="flex flex-wrap items-start gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  r.method === 'GET' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
                }`}>
                  {r.method}
                </span>
                <code className="text-yellow-400 text-sm font-mono">{r.path}</code>
              </div>
              <p className="text-gray-400 text-sm">{r.desc}</p>
              {r.body && (
                <p className="text-gray-500 text-xs mt-1">
                  Body: <code className="text-gray-400">{r.body}</code>
                </p>
              )}
              <p className="text-gray-500 text-xs">
                Response: <code className="text-gray-400">{r.response}</code>
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="providers-heading" className="mb-10">
        <h2 id="providers-heading" className="text-xl font-bold text-white mb-4">
          Adding a Vision Provider
        </h2>
        <Card>
          <pre className="text-green-400 text-xs font-mono overflow-x-auto">
{`// 1. Implement VisionProvider interface
import type { VisionProvider } from '@/engines/types';

export class MyProvider implements VisionProvider {
  readonly name = 'MyProvider';
  readonly capabilities = { ... };

  async analyzeFrame(frame: VisionFrame): Promise<Detection[]> {
    // call your model here
    return [];
  }
}

// 2. Inject into VisionEngine
const engine = getVisionEngine();
engine.setProvider(new MyProvider());

// Supported: MockVisionProvider (default), OpenAIVisionProvider,
// or any class implementing VisionProvider.`}
          </pre>
        </Card>
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-xl font-bold text-white mb-4">
          Phase 1 Limitations
        </h2>
        <Card className="border-orange-800">
          <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
            <li>All vision analysis is simulated — no real camera model is trained</li>
            <li>No GPS integration — navigation is stub-only</li>
            <li>Memory is in-process (resets on server restart) — Prisma persistence not wired to API yet</li>
            <li>No real-time WebSocket push — session loop runs client-side polling</li>
            <li>Face recognition disabled — structure is ready but feature is gated</li>
            <li>Emergency streaming not implemented</li>
            <li>No authentication — single demo user mode only</li>
            <li>Prisma client not generated (engines run without DB in simulation mode)</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
