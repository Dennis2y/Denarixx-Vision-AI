'use client';

import { useMemo, useState } from 'react';
import { getHardwareComponentRegistry, calculateReadinessScore, formatReadinessGrade, buildRecommendedNextActions, getManufacturingOptions } from '@/engines/manufacturingReadinessEngine';
import { getComplianceRegistry, calculateComplianceScore, getComplianceWarnings, formatComplianceStatus } from '@/engines/compliancePlanningEngine';
import { getProductRiskRegistry, getRiskSummary, formatRiskLevel, formatRiskStatus, getCriticalOpenRisks } from '@/engines/productRiskEngine';
import { getCertificationMilestones, buildRoadmapSummary, formatCertificationPhase, getImmediateMilestones } from '@/engines/certificationRoadmapEngine';
import { MANUFACTURING_DISCLAIMER } from '@/types/manufacturing';
import type { CertificationPhase } from '@/types/manufacturing';

type Tab = 'overview' | 'hardware' | 'compliance' | 'risks' | 'roadmap' | 'manufacturing';

export default function ManufacturingPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const specs = useMemo(() => getHardwareComponentRegistry(), []);
  const compliance = useMemo(() => getComplianceRegistry(), []);
  const risks = useMemo(() => getProductRiskRegistry(), []);
  const milestones = useMemo(() => getCertificationMilestones(), []);
  const options = useMemo(() => getManufacturingOptions(), []);

  const complianceScore = useMemo(() => calculateComplianceScore(compliance), [compliance]);
  const score = useMemo(() => calculateReadinessScore(specs, 45, complianceScore, 60), [specs, complianceScore]);
  const warnings = useMemo(() => getComplianceWarnings(compliance), [compliance]);
  const riskSummary = useMemo(() => getRiskSummary(risks), [risks]);
  const roadmapSummary = useMemo(() => buildRoadmapSummary(milestones), [milestones]);
  const nextActions = useMemo(() => buildRecommendedNextActions(specs), [specs]);
  const criticalRisks = useMemo(() => getCriticalOpenRisks(risks), [risks]);
  const immediateMilestones = useMemo(() => getImmediateMilestones(milestones), [milestones]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'hardware', label: `Hardware (${specs.length})` },
    { id: 'compliance', label: `Compliance (${compliance.length})` },
    { id: 'risks', label: `Risks (${riskSummary.open} open)` },
    { id: 'roadmap', label: `Roadmap (${milestones.length})` },
    { id: 'manufacturing', label: 'Manufacturing' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Disclaimer banner */}
      <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 text-xs text-yellow-400 text-center">
        ⚠ {MANUFACTURING_DISCLAIMER}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-yellow-400">🏭 Manufacturing Readiness</h1>
          <p className="text-gray-400 text-sm mt-0.5">V18 · Product Certification Planning · Germany Prototype</p>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Overall', val: score.overall },
            { label: 'Hardware', val: score.hardware },
            { label: 'Software', val: score.software },
            { label: 'Compliance', val: score.compliance },
            { label: 'Docs', val: score.documentation },
          ].map(({ label, val }) => (
            <div key={label} className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
              <p className={`text-2xl font-black ${val >= 60 ? 'text-green-400' : val >= 35 ? 'text-yellow-400' : 'text-red-400'}`}>{val}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Risk alerts */}
        {criticalRisks.length > 0 && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 mb-4 text-sm text-red-300">
            🔴 {criticalRisks.length} critical open risk(s): {criticalRisks.map(r => r.title).join(' · ')}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="bg-yellow-950 border border-yellow-800 rounded-xl px-4 py-3 mb-4 text-xs text-yellow-300 space-y-0.5">
            {warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6 border-b border-gray-800 pb-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id ? 'bg-yellow-400 text-black' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-300 mb-2">Readiness Status</h2>
              <p className="text-lg font-bold text-yellow-400">{formatReadinessGrade(score.overall)}</p>
              <p className="text-xs text-gray-500 mt-1">Target: Mid Planning → Late Planning before hardware vendor engagement</p>
            </div>

            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-300 mb-3">Recommended Next Actions</h2>
              <ol className="space-y-2">
                {nextActions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-300">
                    <span className="text-yellow-500 font-bold min-w-[16px]">{i + 1}.</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Critical Risks', val: riskSummary.critical, color: 'text-red-400' },
                { label: 'Open Risks', val: riskSummary.open, color: 'text-orange-400' },
                { label: 'Cert Milestones', val: roadmapSummary.totalMilestones, color: 'text-blue-400' },
                { label: 'Immediate Tasks', val: immediateMilestones.length, color: 'text-yellow-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
                  <p className={`text-xl font-black ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Hardware ── */}
        {tab === 'hardware' && (
          <div className="space-y-3">
            {specs.map(s => (
              <div key={s.component} className={`bg-gray-900 rounded-xl p-4 border ${s.criticalPath ? 'border-yellow-800/50' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-sm text-white">{s.name}</span>
                  <div className="flex gap-1.5 ml-2 flex-shrink-0">
                    {s.criticalPath && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400 border border-yellow-800">critical</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      s.readinessLevel === 'production_ready' ? 'bg-green-900/50 text-green-400 border-green-800' :
                      s.readinessLevel === 'prototype' ? 'bg-blue-900/50 text-blue-400 border-blue-800' :
                      s.readinessLevel === 'specification' ? 'bg-purple-900/50 text-purple-400 border-purple-800' :
                      s.readinessLevel === 'planning' ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' :
                      'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>{s.readinessLevel.replace('_', ' ')}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">{s.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Target</p>
                    <p className="text-gray-300">{s.targetSpec}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Current</p>
                    <p className={s.currentSpec ? 'text-gray-300' : 'text-red-400'}>{s.currentSpec ?? '— Not selected'}</p>
                  </div>
                </div>
                {s.blockers.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">Blockers:</p>
                    {s.blockers.map((b, i) => <p key={i} className="text-xs text-red-400">• {b}</p>)}
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-1">Est. cost: {s.estimatedUnitCost}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Compliance ── */}
        {tab === 'compliance' && (
          <div className="space-y-3">
            <div className="bg-gray-900 rounded-xl p-3 text-xs text-gray-400 border border-gray-800">
              All items are <strong className="text-yellow-400">planning/roadmap only</strong>. None are certified. Do not claim compliance until formally verified.
            </div>
            {compliance.map(item => (
              <div key={item.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-semibold text-sm text-white">{item.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatComplianceStatus(item.status)}</span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{item.description}</p>
                <p className="text-xs text-gray-500">Timeline: {item.estimatedTimeline}</p>
                <p className="text-xs text-gray-500">{item.notes}</p>
                {item.warningMessage && (
                  <p className="text-xs text-red-400 mt-1 font-semibold">⚠ {item.warningMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Risks ── */}
        {tab === 'risks' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              {[
                { label: 'Critical', val: riskSummary.critical, color: 'text-red-400' },
                { label: 'High', val: riskSummary.high, color: 'text-orange-400' },
                { label: 'Medium', val: riskSummary.medium, color: 'text-yellow-400' },
                { label: 'Low', val: riskSummary.low, color: 'text-green-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="bg-gray-900 rounded-xl p-2 border border-gray-800">
                  <p className={`text-lg font-black ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            {risks.map(r => (
              <div key={r.riskId} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">{r.riskId}</span>
                    <span className="font-semibold text-sm text-white">{r.title}</span>
                  </div>
                  <div className="flex gap-1.5 ml-2 flex-shrink-0">
                    <span className="text-xs">{formatRiskLevel(r.level)}</span>
                    <span className="text-xs text-gray-400">{formatRiskStatus(r.status)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-1">{r.description}</p>
                <p className="text-xs text-blue-400">Mitigation: {r.mitigationPlan}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Roadmap ── */}
        {tab === 'roadmap' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h2 className="text-sm font-bold text-gray-300 mb-2">Budget Estimate</h2>
              <p className="text-xs text-gray-400">Total certification budget: <span className="text-yellow-400 font-semibold">{roadmapSummary.estimatedBudget.low} – {roadmapSummary.estimatedBudget.high}</span></p>
              <p className="text-xs text-gray-500 mt-0.5">CE marking target: {roadmapSummary.timeline.ceMarking}</p>
            </div>
            {(['pre_prototype', 'prototype', 'pre_production', 'production'] as CertificationPhase[]).map(phase => {
              const phaseMilestones = milestones.filter(m => m.phase === phase);
              if (phaseMilestones.length === 0) return null;
              return (
                <div key={phase}>
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{formatCertificationPhase(phase)}</h2>
                  <div className="space-y-2">
                    {phaseMilestones.map(m => (
                      <div key={m.milestoneId} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-semibold text-white">{m.title}</span>
                          <span className="text-xs text-gray-500">{m.estimatedQuarter}</span>
                        </div>
                        <p className="text-xs text-gray-400">{m.notes}</p>
                        <p className="text-xs text-yellow-700 mt-0.5">Est. cost: {m.estimatedCost}</p>
                        {m.prerequisites.length > 0 && (
                          <p className="text-xs text-gray-600">Requires: {m.prerequisites.join(', ')}</p>
                        )}
                        <span className="text-xs text-orange-500">📋 Roadmap placeholder — not certified</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Manufacturing Options ── */}
        {tab === 'manufacturing' && (
          <div className="space-y-4">
            {options.map(opt => (
              <div key={opt.region} className={`bg-gray-900 rounded-xl p-4 border ${opt.region === 'hybrid' ? 'border-yellow-800' : 'border-gray-800'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-white">{opt.name}</h2>
                  {opt.region === 'hybrid' && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700">Recommended</span>}
                </div>
                <p className="text-xs text-gray-400 mb-3">{opt.description}</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-green-400 font-semibold mb-1">Advantages</p>
                    {opt.advantages.map((a, i) => <p key={i} className="text-gray-300">+ {a}</p>)}
                  </div>
                  <div>
                    <p className="text-red-400 font-semibold mb-1">Disadvantages</p>
                    {opt.disadvantages.map((d, i) => <p key={i} className="text-gray-400">− {d}</p>)}
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>Lead time: {opt.estimatedLeadTimeWeeks}w</span>
                  <span>Prototype cost: {opt.estimatedPrototypeCost}</span>
                </div>
                <p className="text-xs text-blue-400 mt-1">Best for: {opt.recommendedFor}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
