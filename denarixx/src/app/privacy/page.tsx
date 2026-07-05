/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  createDashboardState,
  buildPrivacySummary,
  clearMemories,
  clearNavigationHistory,
  deleteAllData,
  exportAsJson,
  resetPrivacySettings,
  riskLabel,
  riskColor,
  retentionStatusLabel,
} from '@/engines/privacyDashboardEngine';
import {
  toggleConsent,
  impactLabel,
  impactColor,
  statusLabel,
} from '@/engines/consentManagementEngine';
import {
  logPermissionGranted,
  logPermissionRevoked,
  logDataDeleted,
  logDataExported,
  logAuditCleared,
  getRecentEvents,
  auditEventIcon,
} from '@/engines/permissionAuditEngine';
import { RETENTION_RULES, policyLabel } from '@/engines/dataRetentionEngine';
import type { PrivacyDashboardState } from '@/types/privacy';
import {
  PRIVACY_DISCLAIMER,
  PRIVACY_PHILOSOPHY,
  GDPR_NOTE,
} from '@/types/privacy';

type Tab = 'overview' | 'consents' | 'data' | 'audit' | 'retention';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🔒' },
  { id: 'consents', label: 'Permissions', icon: '✅' },
  { id: 'data', label: 'Your Data', icon: '🗂' },
  { id: 'audit', label: 'Activity Log', icon: '📋' },
  { id: 'retention', label: 'Retention', icon: '🕐' },
];

function BadgeTag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color} bg-gray-800`}>
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <h3 className="text-base font-bold text-white">{title}</h3>
      {children}
    </div>
  );
}

function DangerButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm text-white font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      {confirm ? (
        <div className="flex gap-2">
          <button
            onClick={() => {
              onClick();
              setConfirm(false);
            }}
            className="text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="text-xs border border-gray-600 text-gray-400 px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="text-xs border border-red-800/60 text-red-400 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          {label.startsWith('Delete') || label.startsWith('Clear') ? 'Delete' : 'Reset'}
        </button>
      )}
    </div>
  );
}

export default function PrivacyPage() {
  const [state, setState] = useState<PrivacyDashboardState>(createDashboardState);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [exportDone, setExportDone] = useState(false);

  const summary = buildPrivacySummary(state.consents, state.auditLog);
  const recentEvents = getRecentEvents(state.auditLog, 10);

  const handleToggle = useCallback(
    (id: string) => {
      const consent = state.consents.find(c => c.id === id);
      if (!consent || !consent.isToggleable || consent.isPlaceholder) return;
      const now = new Date().toISOString();
      const wasGranted = consent.status === 'granted';
      const newConsents = toggleConsent(state.consents, id, now);
      const newLog = wasGranted
        ? logPermissionRevoked(state.auditLog, id, consent.name, now)
        : logPermissionGranted(state.auditLog, id, consent.name, now);
      setState(s => ({ ...s, consents: newConsents, auditLog: newLog }));
    },
    [state],
  );

  const handleClearMemories = useCallback(() => {
    const now = new Date().toISOString();
    const newSummary = clearMemories(state.dataSummary);
    const newLog = logDataDeleted(state.auditLog, 'memories', now);
    setState(s => ({ ...s, dataSummary: newSummary, auditLog: newLog }));
  }, [state]);

  const handleClearNavHistory = useCallback(() => {
    const now = new Date().toISOString();
    const newSummary = clearNavigationHistory(state.dataSummary);
    const newLog = logDataDeleted(state.auditLog, 'navigation_history', now);
    setState(s => ({ ...s, dataSummary: newSummary, auditLog: newLog }));
  }, [state]);

  const handleDeleteAll = useCallback(() => {
    const now = new Date().toISOString();
    const newSummary = deleteAllData(state.dataSummary);
    const newLog = logDataDeleted(state.auditLog, 'all_data', now);
    setState(s => ({ ...s, dataSummary: newSummary, auditLog: newLog }));
  }, [state]);

  const handleExport = useCallback(() => {
    const json = exportAsJson(state);
    const now = new Date().toISOString();
    const newLog = logDataExported(state.auditLog, now);
    setState(s => ({ ...s, auditLog: newLog }));
    if (typeof window !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denarixx-privacy-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2500);
  }, [state]);

  const handleReset = useCallback(() => {
    setState(resetPrivacySettings(state));
  }, [state]);

  const handleClearAudit = useCallback(() => {
    setState(s => ({ ...s, auditLog: logAuditCleared() }));
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10" aria-label="Privacy Dashboard">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/"
            className="text-gray-500 hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
          >
            ← Home
          </Link>
        </div>
        <h1 className="text-3xl font-black text-white mb-1">Privacy Dashboard</h1>
        <p className="text-gray-400 text-sm">
          Full transparency and control over your data, permissions, and AI features.
        </p>
      </div>

      {/* Privacy summary bar */}
      <div
        className="rounded-xl border border-gray-700 bg-gray-900 p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4"
        aria-label="Privacy summary"
      >
        <div className="text-center">
          <p className="text-2xl font-black text-green-400">{summary.grantedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active permissions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-red-400">{summary.deniedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Disabled</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-yellow-400">{summary.highImpactGranted}</p>
          <p className="text-xs text-gray-500 mt-0.5">High-impact granted</p>
        </div>
        <div className="text-center">
          <p className={`text-sm font-bold mt-1 ${riskColor(summary.overallRisk)}`}>
            {riskLabel(summary.overallRisk)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Overall risk level</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
              activeTab === tab.id
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-600/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Section title="Privacy Philosophy">
              <p className="text-sm text-gray-300">{PRIVACY_PHILOSOPHY}</p>
              <p className="text-xs text-gray-500 italic mt-2">{PRIVACY_DISCLAIMER}</p>
            </Section>

            <Section title="Data Summary">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Memories', value: state.dataSummary.memoriesCount, icon: '🧠' },
                  { label: 'Saved places', value: state.dataSummary.savedPlacesCount, icon: '📍' },
                  { label: 'Nav history', value: state.dataSummary.navigationHistoryCount, icon: '🗺' },
                  { label: 'AI activity', value: state.dataSummary.aiActivityCount, icon: '🤖' },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-center"
                  >
                    <p className="text-xl" aria-hidden="true">
                      {item.icon}
                    </p>
                    <p className="text-2xl font-black text-white">{item.value}</p>
                    <p className="text-xs text-gray-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Oldest data: {state.dataSummary.oldestDataAge ?? 'None'} ·{' '}
                {retentionStatusLabel(state.dataSummary.retentionStatus)}
              </p>
            </Section>

            <Section title="Quick Actions">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExport}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {exportDone ? '✓ Exported!' : '📤 Export my data'}
                </button>
                <button
                  onClick={() => setActiveTab('consents')}
                  className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  ✅ Manage permissions
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-800 hover:bg-red-900/40 text-red-400 text-sm font-medium px-4 py-2 rounded-lg border border-gray-700 hover:border-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                >
                  🔄 Reset privacy settings
                </button>
              </div>
              {state.lastReset && (
                <p className="text-xs text-gray-600">
                  Last reset: {new Date(state.lastReset).toLocaleString()}
                </p>
              )}
            </Section>

            <Section title="GDPR Readiness">
              <p className="text-sm text-gray-300">{GDPR_NOTE}</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { article: 'Art. 7', right: 'Consent management', status: 'Implemented (simulated)' },
                  { article: 'Art. 17', right: 'Right to erasure', status: 'Implemented (in-memory)' },
                  { article: 'Art. 20', right: 'Data portability', status: 'Export available' },
                ].map(g => (
                  <div key={g.article} className="rounded-lg border border-gray-700 bg-gray-800 p-2">
                    <p className="text-yellow-400 font-mono font-bold">{g.article}</p>
                    <p className="text-white font-medium">{g.right}</p>
                    <p className="text-green-400 text-xs mt-0.5">{g.status}</p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── CONSENTS ── */}
        {activeTab === 'consents' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-2">
              Toggle each permission on or off. Placeholders are future features.
            </p>
            {state.consents.map(consent => (
              <div
                key={consent.id}
                className={`rounded-xl border p-4 transition-colors ${
                  consent.isPlaceholder
                    ? 'border-gray-800 bg-gray-900/30 opacity-60'
                    : consent.status === 'granted'
                      ? 'border-green-800/40 bg-green-950/10'
                      : 'border-gray-700 bg-gray-900/60'
                }`}
                aria-label={`${consent.name}: ${statusLabel(consent.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm text-white">{consent.name}</span>
                      <BadgeTag color={impactColor(consent.privacyImpact)}>
                        {impactLabel(consent.privacyImpact)}
                      </BadgeTag>
                      {consent.isPlaceholder && (
                        <BadgeTag color="text-gray-500">Coming soon</BadgeTag>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{consent.description}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-500">Why:</span> {consent.reason}
                    </p>
                    <div className="flex gap-4 mt-1.5 text-xs text-gray-600">
                      <span>Retention: {policyLabel(consent.retentionPolicy)}</span>
                      {consent.lastAccessed && (
                        <span>Last used: {new Date(consent.lastAccessed).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {consent.isToggleable && !consent.isPlaceholder && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={consent.status === 'granted'}
                      onClick={() => handleToggle(consent.id)}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                        consent.status === 'granted' ? 'bg-green-600' : 'bg-gray-700'
                      }`}
                      aria-label={`${consent.status === 'granted' ? 'Disable' : 'Enable'} ${consent.name}`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          consent.status === 'granted' ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── YOUR DATA ── */}
        {activeTab === 'data' && (
          <div className="space-y-4">
            <Section title="Stored Data">
              <div className="space-y-0 divide-y divide-gray-800">
                <DangerButton
                  label="Clear memories"
                  description={`${state.dataSummary.memoriesCount} memory entries will be permanently deleted`}
                  onClick={handleClearMemories}
                />
                <DangerButton
                  label="Clear navigation history"
                  description={`${state.dataSummary.navigationHistoryCount} navigation records will be deleted`}
                  onClick={handleClearNavHistory}
                />
                <DangerButton
                  label="Delete all data"
                  description="All memories, saved places, navigation history, and AI activity will be deleted"
                  onClick={handleDeleteAll}
                />
              </div>
            </Section>

            <Section title="Export Data">
              <p className="text-sm text-gray-400">
                Download a machine-readable copy of your data — consents, activity summary, and audit
                log.
              </p>
              <button
                onClick={handleExport}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                {exportDone ? '✓ Export downloaded!' : '📤 Export my data (JSON)'}
              </button>
              <p className="text-xs text-gray-600">
                This is a simulation export. In production, this would be a full GDPR Art. 20 data
                portability export.
              </p>
            </Section>

            <Section title="Reset Privacy Settings">
              <p className="text-sm text-gray-400">
                Restore all permissions to their factory defaults. Your data is not deleted — only
                permission settings are reset.
              </p>
              <button
                onClick={handleReset}
                className="border border-red-800/60 hover:border-red-600 text-red-400 font-medium text-sm px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                🔄 Reset all privacy settings
              </button>
            </Section>
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-400">
                Last {recentEvents.length} events · {state.auditLog.length} total recorded
              </p>
              <button
                onClick={handleClearAudit}
                className="text-xs border border-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                🧹 Clear log
              </button>
            </div>

            {recentEvents.length === 0 ? (
              <div className="rounded-xl border border-gray-800 p-8 text-center">
                <p className="text-gray-500 text-sm">No activity recorded yet.</p>
                <p className="text-gray-600 text-xs mt-1">
                  Toggle a permission or export your data to see events here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentEvents.map(event => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 flex items-start gap-3"
                  >
                    <span className="text-lg flex-shrink-0" aria-hidden="true">
                      {auditEventIcon(event.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{event.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {Object.keys(event.metadata).length > 0 && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {Object.entries(event.metadata)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-700">
              Audit log is stored in-memory and resets on page reload. Ring-buffer: last 100 events.
            </p>
          </div>
        )}

        {/* ── RETENTION ── */}
        {activeTab === 'retention' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Each data category has a retention policy. Auto-delete runs automatically in production.
            </p>
            <div className="space-y-3">
              {RETENTION_RULES.map(rule => (
                <div
                  key={rule.dataCategory}
                  className="rounded-xl border border-gray-800 bg-gray-900/60 p-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <span className="font-bold text-sm text-white capitalize">
                      {rule.dataCategory.replace(/_/g, ' ')}
                    </span>
                    <div className="flex gap-2">
                      <BadgeTag color="text-yellow-400">{policyLabel(rule.policy)}</BadgeTag>
                      {rule.autoDelete && <BadgeTag color="text-orange-400">Auto-delete</BadgeTag>}
                      {rule.encryptedAtRest && <BadgeTag color="text-blue-400">Encrypted</BadgeTag>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{rule.retentionLabel}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-blue-800/30 bg-blue-950/10 p-4">
              <p className="text-sm text-blue-300 font-semibold mb-1">
                Future: Encrypted Cloud Sync
              </p>
              <p className="text-xs text-gray-400">
                A future release will support opt-in encrypted cloud backup with end-to-end
                encryption, meeting GDPR Article 7 (consent) and Article 17 (right to erasure)
                requirements. All cloud features require explicit consent and can be revoked at any
                time.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-700 mt-8">🔒 {PRIVACY_DISCLAIMER}</p>
    </main>
  );
}
