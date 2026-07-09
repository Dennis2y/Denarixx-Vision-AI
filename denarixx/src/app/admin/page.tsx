'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { LiveSession } from '@/lib/sessionStore';

interface HealthData {
  status: string;
  version: string;
  mode: string;
}

interface SessionsData {
  sessions: LiveSession[];
  active: number;
  total: number;
}

export default function AdminPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [sessions, setSessions] = useState<SessionsData | null>(null);
  const [memory, setMemory] = useState<{ count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const safeFetch = async (url: string) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return r.json();
    } catch {
      return null;
    }
  };

  const load = async () => {
    setLoading(true);
    const [hRes, sRes, mRes] = await Promise.all([
      safeFetch('/api/health'),
      safeFetch('/api/sessions'),
      safeFetch('/api/memory'),
    ]);
    setHealth(hRes?.data ?? null);
    setSessions(sRes?.data ?? null);
    setMemory(mRes?.data ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const avgLatency = (sessions?.sessions ?? []).flatMap((s) => s.latencyMs);
  const avgMs =
    avgLatency.length > 0
      ? Math.round(avgLatency.reduce((a, b) => a + b, 0) / avgLatency.length)
      : 0;

  const totalFrames = (sessions?.sessions ?? []).reduce((a, s) => a + s.frameCount, 0);
  const totalAlerts = (sessions?.sessions ?? []).reduce((a, s) => a + s.alertCount, 0);

  const metrics = [
    { label: 'System Status', value: health?.status ?? '…', badge: health?.status === 'healthy' ? 'success' : 'high' },
    { label: 'Active Sessions', value: sessions?.active ?? '…', badge: 'info' },
    { label: 'Total Sessions', value: sessions?.total ?? '…', badge: 'muted' },
    { label: 'Total Frames', value: totalFrames, badge: 'muted' },
    { label: 'Total Alerts', value: totalAlerts, badge: totalAlerts > 0 ? 'high' : 'muted' },
    { label: 'Avg Hazard Latency', value: avgMs ? `${avgMs} ms` : 'N/A', badge: 'muted' },
    { label: 'Memory Items', value: memory?.count ?? '…', badge: 'muted' },
    { label: 'Vision Mode', value: health?.mode ?? '…', badge: 'info' },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm">
            System health, session metrics, and live monitoring.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="md">↻ Refresh</Button>
      </div>

      {loading ? (
        <p className="text-gray-500" aria-live="polite">Loading metrics…</p>
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {metrics.map((m) => (
              <Card key={m.label} aria-label={`${m.label}: ${m.value}`}>
                <p className="text-gray-400 text-xs mb-1">{m.label}</p>
                <p className="text-2xl font-black text-white">{String(m.value)}</p>
              </Card>
            ))}
          </div>

          {/* Active sessions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <Badge variant={sessions?.active ? 'success' : 'muted'}>
                {sessions?.active} active
              </Badge>
            </CardHeader>
            {sessions?.sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">No sessions yet. Start a vision session to see data here.</p>
            ) : (
              <div className="space-y-2" role="list">
                {sessions?.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-gray-800 last:border-0"
                    role="listitem"
                  >
                    <div>
                      <p className="text-white text-sm font-mono">{s.id.slice(0, 16)}…</p>
                      <p className="text-gray-500 text-xs">
                        Started: {new Date(s.startedAt).toLocaleTimeString()} ·
                        Frames: {s.frameCount} · Alerts: {s.alertCount}
                      </p>
                    </div>
                    <Badge variant={s.isActive ? 'success' : 'muted'}>
                      {s.isActive ? 'active' : 'ended'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* API health */}
          <Card>
            <CardHeader><CardTitle>API Health</CardTitle></CardHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {[
                '/api/health',
                '/api/sessions',
                '/api/memory',
                '/api/vision/analyze-frame',
                '/api/hazards/evaluate',
                '/api/safety/decide',
                '/api/scene/describe',
                '/api/conversation/ask',
                '/api/audio/speak',
              ].map((route) => (
                <div key={route} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" aria-hidden="true" />
                  <span className="text-gray-300 font-mono text-xs truncate">{route}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
