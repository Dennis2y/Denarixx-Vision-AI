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

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ type: 'location', label: '', description: '' });
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">AI Memory</h1>
          <p className="text-gray-400 text-sm">
            Saved locations, routes, and preferences. Memory recalls relevant items
            automatically during a live session.
          </p>
        </div>
        <Button onClick={() => setShowAdd((v) => !v)} size="md">
          {showAdd ? 'Cancel' : '+ Add Memory'}
        </Button>
      </div>

      {showAdd && (
        <Card className="mb-6 border-yellow-700">
          <CardHeader>
            <CardTitle>New Memory Item</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-type">Type</label>
              <select
                id="mem-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="location">Location</option>
                <option value="route">Route</option>
                <option value="preference">Preference</option>
                <option value="object">Object</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-label">Label</label>
              <input
                id="mem-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Home entrance"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-1" htmlFor="mem-desc">Description</label>
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

      {loading ? (
        <p className="text-gray-500" aria-live="polite">Loading memory…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-gray-500 text-sm">No memory items yet. Add locations, routes, or preferences above.</p>
        </Card>
      ) : (
        <div className="space-y-3" role="list" aria-label="Memory items">
          {items.map((item) => (
            <Card key={item.id} role="listitem">
              <div className="flex items-start gap-3">
                <Badge variant={TYPE_BADGE[item.type] ?? 'muted'} className="mt-0.5 shrink-0">
                  {item.type}
                </Badge>
                <div>
                  <p className="text-white font-semibold">{item.label}</p>
                  <p className="text-gray-400 text-sm mt-0.5">{item.description}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    Last seen: {new Date(item.lastSeenAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
