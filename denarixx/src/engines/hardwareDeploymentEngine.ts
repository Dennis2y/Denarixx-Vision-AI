// ─── Sprint 20: Hardware Deployment Engine ────────────────────────────────────

import type {
  DeploymentPipelineState,
  DeploymentStage,
  DeploymentStageConfig,
  DeploymentArtifact,
  DiagnosticEntry,
  DiagnosticLevel,
  RollbackResult,
} from '@/types/prototype';

// ─── Default stage configs ────────────────────────────────────────────────────

const DEFAULT_STAGES: DeploymentStageConfig[] = [
  {
    stage: 'dev',
    version: '0.0.0-dev',
    artifacts: ['firmware', 'ai-models', 'config', 'locale-pack'],
    isSigned: false,
    rollbackVersion: null,
    diagnosticsEnabled: true,
    recoveryModeAvailable: false,
    notes: 'Local development. No signing required. Uses simulation platform.',
  },
  {
    stage: 'staging',
    version: '0.0.0-staging',
    artifacts: ['firmware', 'ai-models', 'config', 'locale-pack'],
    isSigned: true,
    rollbackVersion: null,
    diagnosticsEnabled: true,
    recoveryModeAvailable: true,
    notes: 'CI/CD staging. Signed with internal key. Platform: linux-wearable or android-xr.',
  },
  {
    stage: 'prototype',
    version: '0.1.0-evt1',
    artifacts: ['firmware', 'ai-models', 'config', 'locale-pack'],
    isSigned: true,
    rollbackVersion: null,
    diagnosticsEnabled: true,
    recoveryModeAvailable: true,
    notes: 'EVT/DVT/PVT physical prototype. Signed with prototype key. Platform: prototype.',
  },
  {
    stage: 'production',
    version: '1.0.0',
    artifacts: ['firmware', 'ai-models', 'config', 'locale-pack'],
    isSigned: true,
    rollbackVersion: null,
    diagnosticsEnabled: false,
    recoveryModeAvailable: true,
    notes: 'Mass production. Signed with production HSM key. Platform: denarixx-v1.',
  },
];

const STAGE_ORDER: DeploymentStage[] = ['dev', 'staging', 'prototype', 'production'];

// ─── Factory ───────────────────────────────────────────────────────────────────

export function createDeploymentPipeline(): DeploymentPipelineState {
  return {
    currentStage: 'dev',
    stages: DEFAULT_STAGES.map(s => ({ ...s })),
    canRollback: false,
    currentVersion: '0.0.0-dev',
    latestVersion: '0.0.0-dev',
    isUpToDate: true,
    deploymentLog: [],
  };
}

// ─── Stage queries ────────────────────────────────────────────────────────────

export function getStageConfig(
  state: DeploymentPipelineState,
  stage: DeploymentStage,
): DeploymentStageConfig | undefined {
  return state.stages.find(s => s.stage === stage);
}

export function getCurrentStageConfig(
  state: DeploymentPipelineState,
): DeploymentStageConfig | undefined {
  return getStageConfig(state, state.currentStage);
}

export function getNextStage(stage: DeploymentStage): DeploymentStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

// ─── OTA ──────────────────────────────────────────────────────────────────────

export function checkForOTA(
  state: DeploymentPipelineState,
  _deviceId: string,
): { available: boolean; version: string | null } {
  const available = state.currentVersion !== state.latestVersion;
  return { available, version: available ? state.latestVersion : null };
}

export function setLatestVersion(
  state: DeploymentPipelineState,
  version: string,
): DeploymentPipelineState {
  const isUpToDate = state.currentVersion === version;
  return { ...state, latestVersion: version, isUpToDate };
}

export function applyOTA(
  state: DeploymentPipelineState,
  newVersion: string,
): DeploymentPipelineState {
  const prevVersion = state.currentVersion;
  const currentStageIdx = state.stages.findIndex(s => s.stage === state.currentStage);
  const updatedStages = state.stages.map((s, i) =>
    i === currentStageIdx
      ? { ...s, version: newVersion, rollbackVersion: prevVersion }
      : s,
  );
  return {
    ...state,
    stages: updatedStages,
    currentVersion: newVersion,
    latestVersion: newVersion,
    isUpToDate: true,
    canRollback: true,
    deploymentLog: [
      ...state.deploymentLog,
      buildLogEntry('info', `OTA applied: ${prevVersion} → ${newVersion}`, 'hardwareDeploymentEngine'),
    ],
  };
}

// ─── Rollback ─────────────────────────────────────────────────────────────────

export function rollback(state: DeploymentPipelineState): RollbackResult {
  const current = getCurrentStageConfig(state);
  if (!current?.rollbackVersion) {
    return {
      success: false,
      fromVersion: state.currentVersion,
      toVersion: state.currentVersion,
      message: 'No rollback version available',
    };
  }
  return {
    success: true,
    fromVersion: state.currentVersion,
    toVersion: current.rollbackVersion,
    message: `Rolled back from ${state.currentVersion} to ${current.rollbackVersion}`,
  };
}

export function applyRollback(
  state: DeploymentPipelineState,
  result: RollbackResult,
): DeploymentPipelineState {
  if (!result.success) return state;
  const updatedStages = state.stages.map(s =>
    s.stage === state.currentStage
      ? { ...s, version: result.toVersion, rollbackVersion: null }
      : s,
  );
  return {
    ...state,
    stages: updatedStages,
    currentVersion: result.toVersion,
    canRollback: false,
    deploymentLog: [
      ...state.deploymentLog,
      buildLogEntry('warn', result.message, 'hardwareDeploymentEngine'),
    ],
  };
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

function buildLogEntry(
  level: DiagnosticLevel,
  message: string,
  source: string,
): DiagnosticEntry {
  return { ts: Date.now(), level, message, source };
}

export function addDiagnosticEntry(
  state: DeploymentPipelineState,
  level: DiagnosticLevel,
  message: string,
  source: string,
): DeploymentPipelineState {
  const entry = buildLogEntry(level, message, source);
  return { ...state, deploymentLog: [...state.deploymentLog, entry] };
}

export function getDiagnosticsByLevel(
  state: DeploymentPipelineState,
  level: DiagnosticLevel,
): DiagnosticEntry[] {
  return state.deploymentLog.filter(e => e.level === level);
}

export function clearDiagnostics(state: DeploymentPipelineState): DeploymentPipelineState {
  return { ...state, deploymentLog: [] };
}

// ─── Readiness checks ─────────────────────────────────────────────────────────

export function isProductionReady(state: DeploymentPipelineState): boolean {
  return state.stages.every(s => s.isSigned) &&
    state.stages.every(s => s.recoveryModeAvailable || s.stage === 'dev');
}

export function hasArtifact(
  state: DeploymentPipelineState,
  artifact: DeploymentArtifact,
): boolean {
  const current = getCurrentStageConfig(state);
  return current?.artifacts.includes(artifact) ?? false;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export function getDeploymentSummary(state: DeploymentPipelineState): string {
  const upToDate = state.isUpToDate ? 'up to date' : `update available: ${state.latestVersion}`;
  return (
    `Stage: ${state.currentStage} | Version: ${state.currentVersion} | ${upToDate} | ` +
    `Rollback: ${state.canRollback ? 'available' : 'none'} | ` +
    `Logs: ${state.deploymentLog.length}`
  );
}
