'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { MemoryItem } from '@/types';

const TYPE_BADGE: Record<string, 'info' | 'success' | 'muted' | 'medium'> = {
  location: 'info',
  route: 'success',
  preference: 'muted',
  object: 'medium',
};

const TYPE_ICON: Record<string, string> = {
  location: '📍',
  route: '🗺',
  preference: '⚙',
  object: '🔍',
  person: '👤',
};

const SAMPLE_MEMORIES = [
  { type: 'location', label: 'Home entrance', description: 'Front door. Three steps down, then flat path to gate.' },
  { type: 'route', label: 'Corner shop route', description: 'Turn left out of entrance, walk 80 m, cross at lights.' },
  { type: 'preference', label: 'Alert verbosity: brief', description: 'User prefers short audio alerts, not full descriptions.' },
];

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'location', label: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/memory');
    const { data } = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    await fetch('/api/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, metadata: {} }),
    });
    setForm({ type: 'location', label: '', description: '' });
    setShowAdd(false);
    setSaving(false);
    await load();
  };

  const seedDemo = async () => {
    setSeedingDemo(true);
    for (const mem of SAMPLE_MEMORIES) {
      await fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mem, metadata: { demo: true } }),
      });
    }
    await load();
    setSeedingDemo(false);
  };

  const typeCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">AI Memory</h1>
          <p className="text-gray-400 text-sm max-w-lg">
            Saved locations, routes, and preferences. The AI recalls relevant items
            automatically during a live vision session.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={seedDemo}
            disabled={seedingDemo}
            variant="outline"
            size="md"
            aria-label="Add sample memory items for demo"
          >
            {seedingDemo ? 'Adding…' : '+ Seed Demo'}
          </Button>
          <Button onClick={() => setShowAdd((v) => !v)} size="md">
            {showAdd ? 'Cancel' : '+ Add Memory'}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-white">{items.length}</p>
            <p className="text-gray-500 text-xs">Total items</p>
          </div>
          {['location', 'route', 'preference'].map((type) => (
            <div key={type} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{typeCounts[type] ?? 0}</p>
              <p className="text-gray-500 text-xs capitalize">{type}s</p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6 border-yellow-700/60">
          <CardHeader>
            <CardTitle>New Memory Item</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-type">
                Type
              </label>
              <select
                id="mem-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="location">📍 Location</option>
                <option value="route">🗺 Route</option>
                <option value="preference">⚙ Preference</option>
                <option value="object">🔍 Object</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-label">
                Label
              </label>
              <input
                id="mem-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Home entrance"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-desc">
                Description
              </label>
              <textarea
                id="mem-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Front door. Three steps down, then flat path."
                rows={2}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <Button onClick={save} disabled={saving || !form.label.trim()} fullWidth>
              {saving ? 'Saving…' : 'Save Memory Item'}
            </Button>
          </div>
        </Card>
      )}

      {/* Items list */}
      {loading ? (
        <div className="text-center py-12" aria-live="polite">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-yellow-400 rounded-full animate-spin mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-500 text-sm">Loading memory…</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-4xl mb-3" aria-hidden="true">🧠</p>
          <p className="text-white font-semibold mb-1">No memory items yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Add locations, routes, or preferences — or seed the demo with sample data.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button onClick={seedDemo} disabled={seedingDemo} variant="outline" size="sm">
              {seedingDemo ? 'Adding…' : '+ Seed Demo Data'}
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm">
              + Add Memory Item
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3" role="list" aria-label="Memory items">
          {items.map((item) => (
            <Card key={item.id} role="listitem" className="hover:border-gray-600 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg shrink-0">
                  {TYPE_ICON[item.type] ?? '💾'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-white font-semibold">{item.label}</p>
                    <Badge variant={TYPE_BADGE[item.type] ?? 'muted'}>
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                  <p className="text-gray-600 text-xs mt-1.5">
                    Last seen: {new Date(item.lastSeenAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-gray-600 text-xs mt-6 text-center">
          Memory is in-session only in Phase 1 — cleared on server restart. Persistent storage
          (Postgres via Prisma) is planned for Phase 2.
        </p>
      )}
    </div>
  );
}
