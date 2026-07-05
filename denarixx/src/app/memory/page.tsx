'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { MemoryItem } from '@/types';
import {
  createLongTermMemoryStore,
  addMemoryEntry,
  getEntriesByCategory,
  deleteEntry,
  deleteAllEntries,
  confirmEntry,
  buildMemoryContextSummary,
  exportMemoryPlaceholder,
  saveGuidancePreference,
} from '@/engines/longTermMemoryEngine';
import {
  createRouteMemoryStore,
  recordRouteAttempt,
  getFrequentRoutes,
  getRouteSuccessRate,
  deleteRoute,
  deleteAllRoutes,
} from '@/engines/routeMemoryEngine';
import { getPrivacyRulesList } from '@/engines/memoryPrivacyEngine';
import type { LongTermMemoryStore, RouteMemoryEntry } from '@/types/longTermMemory';
import { MEMORY_PRIVACY_STATEMENT } from '@/types/longTermMemory';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'places' | 'routes' | 'hazards' | 'preferences' | 'privacy';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_ENTRIES = [
  { category: 'saved_place' as const, label: 'Home entrance', description: 'Front door. Three steps down, then flat path to gate.', confidence: 'user-confirmed' as const },
  { category: 'saved_place' as const, label: 'Local café', description: 'Favourite café. Counter 10 steps ahead from entrance.', confidence: 'remembered' as const },
  { category: 'repeated_hazard' as const, label: 'Wet floor (café entrance)', description: 'Slippery surface near café door in wet weather.', confidence: 'remembered' as const },
  { category: 'repeated_hazard' as const, label: 'Uneven paving (high street)', description: 'Cracked pavement outside newsagent.', confidence: 'uncertain' as const },
  { category: 'frequent_landmark' as const, label: 'Post box on corner', description: 'Red post box at junction, useful orientation point.', confidence: 'remembered' as const },
];

const CATEGORY_ICON: Record<string, string> = {
  saved_place: '📍',
  common_route: '🗺',
  guidance_preference: '⚙',
  repeated_hazard: '⚠',
  frequent_landmark: '🏷',
  navigation_session: '🧭',
};

const CONFIDENCE_VARIANT: Record<string, 'success' | 'info' | 'muted' | 'medium'> = {
  'user-confirmed': 'success',
  remembered: 'info',
  uncertain: 'medium',
  expired: 'muted',
};

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'places', label: 'Saved Places' },
  { id: 'routes', label: 'Routes' },
  { id: 'hazards', label: 'Hazards' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'privacy', label: 'Privacy' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>('overview');

  // V1 items from API
  const [v1Items, setV1Items] = useState<MemoryItem[]>([]);
  const [v1Loading, setV1Loading] = useState(true);

  // Sprint 8 client-side store (session-persistent)
  const [ltmStore, setLtmStore] = useState<LongTermMemoryStore>(() => createLongTermMemoryStore());
  const [routes, setRoutes] = useState<RouteMemoryEntry[]>(() => createRouteMemoryStore());

  // UI state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ category: 'saved_place' as const, label: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [personality, setPersonality] = useState<'minimal' | 'balanced' | 'detailed' | 'companion'>('balanced');

  // Load V1 items from API
  const loadV1 = useCallback(async () => {
    setV1Loading(true);
    try {
      const res = await fetch('/api/memory');
      const { data } = await res.json();
      setV1Items(data.items ?? []);
    } finally {
      setV1Loading(false);
    }
  }, []);

  useEffect(() => { loadV1(); }, [loadV1]);

  // Seed demo Sprint 8 data
  const seedDemo = () => {
    let s = ltmStore;
    for (const e of DEMO_ENTRIES) {
      s = addMemoryEntry(s, e);
    }
    let r = routes;
    r = recordRouteAttempt(r, 'Home entrance', 'Local café', true);
    r = recordRouteAttempt(r, 'Home entrance', 'Local café', true);
    r = recordRouteAttempt(r, 'Home entrance', 'Local café', false);
    r = recordRouteAttempt(r, 'Home entrance', 'Corner shop', true);
    setLtmStore(s);
    setRoutes(r);
  };

  // Add Sprint 8 entry
  const handleAdd = () => {
    if (!addForm.label.trim()) return;
    setSaving(true);
    setLtmStore((s) =>
      addMemoryEntry(s, {
        category: addForm.category,
        label: addForm.label,
        description: addForm.description,
      }),
    );
    setAddForm({ category: 'saved_place', label: '', description: '' });
    setShowAdd(false);
    setSaving(false);
  };

  const handleConfirm = (id: string) => {
    setLtmStore((s) => confirmEntry(s, id));
  };

  const handleDeleteEntry = (id: string) => {
    setLtmStore((s) => deleteEntry(s, id));
  };

  const handleDeleteRoute = (id: string) => {
    setRoutes((r) => deleteRoute(r, id));
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    await fetch('/api/memory', { method: 'DELETE' });
    setLtmStore(deleteAllEntries(ltmStore));
    setRoutes(deleteAllRoutes());
    await loadV1();
    setConfirmDeleteAll(false);
    setDeleting(false);
    setTab('overview');
  };

  const handleSavePreference = () => {
    setLtmStore((s) =>
      saveGuidancePreference(s, { personality, speechRate: 1.0, verbosity: 'standard' }),
    );
  };

  const handleExport = () => {
    setExporting(true);
    const exp = exportMemoryPlaceholder(ltmStore);
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `denarixx-memory-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const summary = buildMemoryContextSummary(ltmStore);
  const places = getEntriesByCategory(ltmStore, 'saved_place');
  const hazards = getEntriesByCategory(ltmStore, 'repeated_hazard');
  const landmarks = getEntriesByCategory(ltmStore, 'frequent_landmark');
  const frequentRoutes = getFrequentRoutes(routes, 1);
  const privacyRules = getPrivacyRulesList();
  const totalItems =
    v1Items.length + ltmStore.entries.filter((e) => e.confidence !== 'expired').length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">AI Memory</h1>
          <p className="text-gray-400 text-sm max-w-lg">
            Saved places, routes, hazards, and preferences — recalled automatically during
            live sessions.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={seedDemo} variant="outline" size="md">+ Seed Demo</Button>
          <Button onClick={() => setShowAdd((v) => !v)} size="md">
            {showAdd ? 'Cancel' : '+ Add Memory'}
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6 border-yellow-700/60">
          <CardHeader><CardTitle>New Memory Entry</CardTitle></CardHeader>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="cat-select">Category</label>
              <select
                id="cat-select"
                value={addForm.category}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, category: e.target.value as typeof addForm.category }))
                }
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="saved_place">📍 Saved Place</option>
                <option value="repeated_hazard">⚠ Repeated Hazard</option>
                <option value="frequent_landmark">🏷 Frequent Landmark</option>
                <option value="guidance_preference">⚙ Preference</option>
                <option value="navigation_session">🧭 Navigation Note</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="label-input">Label</label>
              <input
                id="label-input"
                value={addForm.label}
                onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Home entrance"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="desc-input">Description</label>
              <textarea
                id="desc-input"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Front door — three steps down, then flat path."
                rows={2}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <Button onClick={handleAdd} disabled={saving || !addForm.label.trim()} fullWidth>
              {saving ? 'Saving…' : 'Save Entry'}
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-6" role="tablist">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-yellow-400 text-black'
                : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Total items', value: totalItems },
              { label: 'Saved places', value: places.length },
              { label: 'Routes', value: frequentRoutes.length },
              { label: 'Hazards', value: hazards.length },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader><CardTitle>Guardian Memory Context</CardTitle></CardHeader>
            <p className="text-gray-300 text-sm leading-relaxed">
              {summary.totalEntries === 0
                ? 'No memory yet. Add places, hazards, or landmarks and the Guardian will use them.'
                : [
                    summary.repeatedHazards.length > 0 &&
                      `Known hazards: ${summary.repeatedHazards.slice(0, 3).join(', ')}.`,
                    summary.savedPlaces.length > 0 &&
                      `Familiar places: ${summary.savedPlaces.slice(0, 3).join(', ')}.`,
                    summary.preferredPersonality &&
                      `Preferred style: ${summary.preferredPersonality}.`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
            </p>
          </Card>

          {!v1Loading && v1Items.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Session Items ({v1Items.length})</CardTitle></CardHeader>
              <div className="space-y-2">
                {v1Items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-5 text-center shrink-0">
                      {item.type === 'location' ? '📍' : item.type === 'route' ? '🗺' : '💾'}
                    </span>
                    <span className="text-white font-medium">{item.label}</span>
                    <span className="text-gray-500 truncate text-xs">{item.description}</span>
                  </div>
                ))}
                {v1Items.length > 5 && (
                  <p className="text-gray-600 text-xs">…and {v1Items.length - 5} more</p>
                )}
              </div>
            </Card>
          )}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
              {exporting ? 'Preparing…' : '⬇ Export Memory (Placeholder)'}
            </Button>
            <Button
              onClick={() => setConfirmDeleteAll(true)}
              variant="outline"
              size="sm"
              className="border-red-800 text-red-400 hover:bg-red-900/20"
            >
              🗑 Delete All Memory
            </Button>
          </div>

          {confirmDeleteAll && (
            <Card className="border-red-700/60 bg-red-950/30">
              <p className="text-red-300 font-semibold mb-1">Delete all memory?</p>
              <p className="text-gray-400 text-sm mb-3">
                Removes all saved places, routes, hazards, preferences, and session items.
                Cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  size="sm"
                  className="bg-red-700 hover:bg-red-600 text-white"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete all'}
                </Button>
                <Button onClick={() => setConfirmDeleteAll(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Saved Places ── */}
      {tab === 'places' && (
        <div className="space-y-3" role="list" aria-label="Saved places">
          {places.length === 0 && landmarks.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-4xl mb-3" aria-hidden="true">📍</p>
              <p className="text-white font-semibold mb-1">No saved places yet</p>
              <p className="text-gray-500 text-sm mb-4">
                Add places like Home, Café, or Post office.
              </p>
              <Button onClick={() => setShowAdd(true)} size="sm">+ Add Place</Button>
            </Card>
          ) : (
            <>
              {[...places, ...landmarks].map((entry) => (
                <Card key={entry.id} role="listitem" className="hover:border-gray-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                      {CATEGORY_ICON[entry.category] ?? '💾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-semibold">{entry.label}</p>
                        <Badge variant={CONFIDENCE_VARIANT[entry.confidence] ?? 'muted'}>
                          {entry.confidence}
                        </Badge>
                        <Badge variant="muted">fuzzy location</Badge>
                      </div>
                      <p className="text-gray-400 text-sm">{entry.description}</p>
                      <div className="flex gap-3 mt-2">
                        {!entry.isUserConfirmed && (
                          <button
                            onClick={() => handleConfirm(entry.id)}
                            className="text-green-400 text-xs hover:text-green-300"
                          >
                            ✓ Confirm
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-400 text-xs hover:text-red-300"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Routes ── */}
      {tab === 'routes' && (
        <div className="space-y-3" role="list" aria-label="Route memories">
          {frequentRoutes.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-4xl mb-3" aria-hidden="true">🗺</p>
              <p className="text-white font-semibold mb-1">No route memories yet</p>
              <p className="text-gray-500 text-sm mb-4">
                Routes are recorded automatically during navigation sessions.
              </p>
              <Button onClick={seedDemo} variant="outline" size="sm">+ Seed Demo Routes</Button>
            </Card>
          ) : (
            frequentRoutes.map((route) => {
              const rate = getRouteSuccessRate(route);
              return (
                <Card key={route.id} role="listitem" className="hover:border-gray-600 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                      🗺
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-semibold">
                          {route.fromLabel} → {route.toLabel}
                        </p>
                        <Badge variant={rate >= 75 ? 'success' : rate >= 50 ? 'medium' : 'muted'}>
                          {rate}% success
                        </Badge>
                        <Badge variant="muted">fuzzy</Badge>
                      </div>
                      <p className="text-gray-400 text-sm">
                        {route.successCount}/{route.totalAttempts} successful · last{' '}
                        {new Date(route.lastUsed).toLocaleDateString()}
                      </p>
                      <button
                        onClick={() => handleDeleteRoute(route.id)}
                        className="text-red-400 text-xs hover:text-red-300 mt-2 block"
                      >
                        🗑 Delete route
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── Hazards ── */}
      {tab === 'hazards' && (
        <div className="space-y-3" role="list" aria-label="Repeated hazards">
          {hazards.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-4xl mb-3" aria-hidden="true">⚠</p>
              <p className="text-white font-semibold mb-1">No repeated hazards recorded</p>
              <p className="text-gray-500 text-sm mb-4">
                Hazards seen during sessions are remembered here.
              </p>
              <Button onClick={seedDemo} variant="outline" size="sm">+ Seed Demo Data</Button>
            </Card>
          ) : (
            hazards
              .sort((a, b) => b.accessCount - a.accessCount)
              .map((entry) => (
                <Card
                  key={entry.id}
                  role="listitem"
                  className="hover:border-gray-600 transition-colors border-yellow-900/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-900/30 border border-yellow-700/40 flex items-center justify-center text-lg shrink-0">
                      ⚠
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-white font-semibold">{entry.label}</p>
                        <Badge variant="medium">seen {entry.accessCount}×</Badge>
                        <Badge variant={CONFIDENCE_VARIANT[entry.confidence] ?? 'muted'}>
                          {entry.confidence}
                        </Badge>
                      </div>
                      <p className="text-gray-400 text-sm">{entry.description}</p>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-400 text-xs hover:text-red-300 mt-2 block"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </Card>
              ))
          )}
        </div>
      )}

      {/* ── Preferences ── */}
      {tab === 'preferences' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Guidance Style Preference</CardTitle></CardHeader>
            <p className="text-gray-400 text-sm mb-4">
              The AI will remember your preferred guidance personality.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(['minimal', 'balanced', 'detailed', 'companion'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPersonality(p)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    personality === p
                      ? 'border-yellow-500 bg-yellow-900/20 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <p className="font-semibold capitalize">{p}</p>
                  <p className="text-xs mt-0.5 text-gray-500">
                    {p === 'minimal' && 'Short alerts only'}
                    {p === 'balanced' && 'Balanced alerts + context'}
                    {p === 'detailed' && 'Full descriptions'}
                    {p === 'companion' && 'Conversational guidance'}
                  </p>
                </button>
              ))}
            </div>
            <Button onClick={handleSavePreference} size="sm">Save Preference</Button>
            {ltmStore.preference && (
              <p className="text-green-400 text-xs mt-2">
                ✓ Saved: {ltmStore.preference.personality} style
              </p>
            )}
          </Card>
        </div>
      )}

      {/* ── Privacy ── */}
      {tab === 'privacy' && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Privacy Statement</CardTitle></CardHeader>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {MEMORY_PRIVACY_STATEMENT}
            </p>
            <ul className="space-y-2" aria-label="Privacy rules">
              {privacyRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                  {rule}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader><CardTitle>Memory Controls</CardTitle></CardHeader>
            <div className="space-y-3">
              <Button
                onClick={handleExport}
                disabled={exporting}
                variant="outline"
                size="sm"
                fullWidth
              >
                {exporting ? 'Preparing…' : '⬇ Export Memory (Phase 1 Placeholder)'}
              </Button>
              <Button
                onClick={() => setConfirmDeleteAll(true)}
                size="sm"
                fullWidth
                className="bg-red-800 hover:bg-red-700 text-white"
              >
                🗑 Delete All Memory
              </Button>
            </div>
          </Card>

          {confirmDeleteAll && (
            <Card className="border-red-700/60 bg-red-950/30">
              <p className="text-red-300 font-semibold mb-1">Delete all memory?</p>
              <p className="text-gray-400 text-sm mb-3">
                Removes all saved places, routes, hazards, preferences, and session items.
                Cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  size="sm"
                  className="bg-red-700 hover:bg-red-600 text-white"
                >
                  {deleting ? 'Deleting…' : 'Yes, delete all'}
                </Button>
                <Button onClick={() => setConfirmDeleteAll(false)} variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          <p className="text-gray-600 text-xs text-center">
            Memory is in-session only in Phase 1 — cleared on server restart.
            Persistent encrypted storage is planned for Phase 2.
          </p>
        </div>
      )}
    </div>
  );
}
