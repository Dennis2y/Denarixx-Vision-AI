'use client';

import { useState, useCallback } from 'react';
import {
  createEdgeModelRegistry,
  getReadyModels,
  getDownloadQueue,
  getTotalModelSizeKb,
  formatModelSize,
  getModelStatusLabel,
  getModelTypeLabel,
  getVersionSummary,
  checkAllModels,
  allIntegrityPassed,
} from '@/engines/offlineEdgeEngine';
import {
  startDownload,
  completeDownload,
  markStale,
  markCorrupted,
  removeModel,
  getStorageSummary,
  validateModelCoverage,
  isCriticalModelMissing,
  getPriorityDownloadOrder,
  listUpdatableModels,
  estimatePendingDownloadSizeKb,
} from '@/engines/offlineModelRegistryEngine';
import type { EdgeModel } from '@/types/offline';

const STATUS_COLOR: Record<string, string> = {
  'ready':           'bg-green-700/40 text-green-300',
  'not-downloaded':  'bg-gray-700/40 text-gray-400',
  'downloading':     'bg-blue-700/40 text-blue-300',
  'updating':        'bg-yellow-700/40 text-yellow-300',
  'corrupted':       'bg-red-700/40 text-red-300',
  'stale':           'bg-orange-700/40 text-orange-300',
};

export default function ModelsPage() {
  const [models, setModels] = useState<EdgeModel[]>(() => createEdgeModelRegistry());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [integrityResults, setIntegrityResults] = useState<ReturnType<typeof checkAllModels> | null>(null);

  const handleDownload = useCallback((id: string) => {
    setModels(m => startDownload(m, id));
    setDownloading(d => new Set([...d, id]));
    setTimeout(() => {
      setModels(m => completeDownload(m, id, Date.now()));
      setDownloading(d => { const next = new Set(d); next.delete(id); return next; });
    }, 2000);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setModels(m => removeModel(m, id));
  }, []);

  const handleMarkStale = useCallback((id: string) => {
    setModels(m => markStale(m, id));
  }, []);

  const handleIntegrityCheck = useCallback(() => {
    setIntegrityResults(checkAllModels(models, Date.now()));
  }, [models]);

  const storageSummary = getStorageSummary(models);
  const coverage = validateModelCoverage(models);
  const criticalMissing = isCriticalModelMissing(models);
  const downloadQueue = getPriorityDownloadOrder(models);
  const updatable = listUpdatableModels(models);
  const pending = estimatePendingDownloadSizeKb(models);
  const versionSummary = getVersionSummary(models);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Edge Model Manager</h1>
          <p className="text-gray-400 text-sm">
            Download and manage on-device AI models for offline operation.
          </p>
        </div>

        {/* Critical warning */}
        {criticalMissing && (
          <div className="mb-4 rounded-lg border border-red-600/40 bg-red-900/10 p-3 text-sm text-red-300">
            ⚠ Critical models (vision, memory) not ready. Offline hazard detection will be basic.
          </div>
        )}

        {/* Storage Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Installed', value: storageSummary.installedMb },
            { label: 'Ready', value: `${storageSummary.readyCount}/${storageSummary.modelCount}` },
            { label: 'Pending DL', value: formatModelSize(pending) },
            { label: 'Coverage', value: `${coverage.covered.length}/5 types` },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-700/50 bg-gray-800/40 p-3">
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className="text-lg font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Coverage */}
        {coverage.missing.length > 0 && (
          <div className="mb-4 rounded-lg border border-yellow-600/40 bg-yellow-900/10 p-3">
            <p className="text-sm text-yellow-300 mb-1">Missing model types:</p>
            <p className="text-xs text-yellow-400">{coverage.missing.join(', ')}</p>
          </div>
        )}

        {/* Model Cards */}
        <div className="space-y-3 mb-6">
          {models.map(model => {
            const intRes = integrityResults?.find(r => r.modelId === model.id);
            return (
              <div key={model.id} className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-white text-sm">{model.name}</div>
                    <div className="text-xs text-gray-400">{getModelTypeLabel(model.type)} · v{model.version} · {formatModelSize(model.sizeKb)}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[model.status] ?? 'bg-gray-700 text-gray-400'}`}>
                    {getModelStatusLabel(model.status)}
                  </span>
                </div>

                {intRes && (
                  <div className={`text-xs mb-2 px-2 py-1 rounded ${intRes.passed ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                    Integrity: {intRes.passed ? '✓ Passed' : '✗ Failed'}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {model.status === 'not-downloaded' && (
                    <button
                      onClick={() => handleDownload(model.id)}
                      disabled={downloading.has(model.id)}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium"
                    >
                      {downloading.has(model.id) ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                  {model.status === 'ready' && (
                    <>
                      <button onClick={() => handleMarkStale(model.id)} className="px-3 py-1 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 text-xs">
                        Mark stale
                      </button>
                      <button onClick={() => handleRemove(model.id)} className="px-3 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/40 text-xs text-red-300">
                        Remove
                      </button>
                    </>
                  )}
                  {(model.status === 'stale' || model.status === 'corrupted') && (
                    <button
                      onClick={() => handleDownload(model.id)}
                      disabled={downloading.has(model.id)}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium"
                    >
                      {model.status === 'stale' ? 'Update' : 'Re-download'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleIntegrityCheck}
            className="px-4 py-2 rounded-lg bg-gray-700/60 hover:bg-gray-600/60 text-sm font-medium"
          >
            Run integrity check
          </button>
          {downloadQueue.length > 0 && (
            <button
              onClick={() => downloadQueue.forEach(m => handleDownload(m.id))}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-medium"
            >
              Download all ({formatModelSize(pending)})
            </button>
          )}
        </div>

        {/* Version table */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30 p-4">
          <h2 className="text-sm font-semibold mb-3">Version Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700/50">
                  <th className="text-left pb-2">Type</th>
                  <th className="text-left pb-2">Version</th>
                  <th className="text-left pb-2">Status</th>
                  <th className="text-right pb-2">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {versionSummary.map(v => (
                  <tr key={v.type}>
                    <td className="py-2 pr-4">{getModelTypeLabel(v.type)}</td>
                    <td className="py-2 pr-4 font-mono">{v.version}</td>
                    <td className="py-2 pr-4">{getModelStatusLabel(v.status)}</td>
                    <td className="py-2 text-right">{formatModelSize(v.sizeKb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Edge models run entirely on-device. No data is transmitted during inference.
        </p>
      </div>
    </div>
  );
}
