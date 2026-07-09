# Deployment Pipeline — Denarixx Vision Glasses

**Revision:** Sprint 20
**Platform:** Denarixx V1 prototype

---

## 1. Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT STAGES                                                  │
│                                                                     │
│  dev ──────────► staging ──────────► prototype ──────► production  │
│  (local)         (CI/CD)             (EVT/DVT/PVT)    (mass mfg)   │
│                                                                     │
│  Each stage:                                                        │
│  • firmware (signed in staging+)                                    │
│  • ai-models (quantized for NPU)                                    │
│  • config (per-device, per-stage)                                   │
│  • locale-pack (Sprint 13 translations)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stage Definitions

### Stage 1 — dev

| Attribute | Value |
|---|---|
| Purpose | Local development and rapid iteration |
| Platform | Simulation (Sprint 18 Digital Twin) |
| Signing | No code signing required |
| Rollback | Not applicable |
| Diagnostics | Full — all logs enabled |
| Recovery mode | N/A |

Build command (current):
```bash
cd denarixx && npm run dev   # Next.js dev server
pnpm --filter @workspace/api-server run dev  # Express proxy
```

---

### Stage 2 — staging

| Attribute | Value |
|---|---|
| Purpose | Pre-prototype integration test |
| Platform | Linux Wearable or Android XR emulator |
| Signing | Staging key (internal, not production) |
| Rollback | Automatic on test failure |
| Diagnostics | Full — all logs enabled |
| Recovery mode | Available |

Staging validation:
```bash
cd denarixx
npm run type-check  # zero errors required
npm run build       # zero build errors
npx tsx tests/prototypeIntegration.test.ts
npx tsx tests/hardwareAbstraction.test.ts
```

---

### Stage 3 — prototype

| Attribute | Value |
|---|---|
| Purpose | Physical prototype devices (EVT/DVT/PVT) |
| Platform | `'prototype'` HAL platform |
| Signing | Production key (HSM-backed) — placeholder for EVT |
| Rollback | rollbackVersion stored per device |
| Diagnostics | Privacy-safe diagnostic subset |
| Recovery mode | Available via USB-C ADB |

OTA update flow:
1. `hardwareDeploymentEngine.checkForOTA(deviceId)` returns `{ available: true, version: '0.2.0' }`
2. Maintenance window check: no active session
3. Download: firmware + ai-models + config + locale-pack
4. Signature verification (HSM key)
5. Flash to inactive partition
6. Reboot → activate new partition
7. Health check: 60 s window — if any critical failure → rollback

---

### Stage 4 — production

| Attribute | Value |
|---|---|
| Purpose | Mass production devices (post-PVT) |
| Platform | `'denarixx-v1'` |
| Signing | Production key (hardware root of trust) |
| Rollback | Last 2 versions kept on device |
| Diagnostics | Opt-in only (Sprint 12 consent) |
| Recovery mode | USB-C recovery mode |

---

## 3. Build Artifacts

| Artifact | Description | Max size |
|---|---|---|
| `firmware` | Bootloader + kernel + OS image | 2 GB |
| `ai-models` | Quantized ONNX / TFLite models (Sprint 15) | 8 GB |
| `config` | Device ID, platform string, HAL config | 100 KB |
| `locale-pack` | 8-language translation pack (Sprint 13) | 50 MB |

---

## 4. Signed Firmware

**Placeholder for EVT** — production signing requires an HSM.

```
firmware_image.bin
└─ Header:
   ├─ Magic: 0x44454E41 ('DENA')
   ├─ Version: semver (e.g. 0.1.0-evt1)
   ├─ Platform: 'prototype'
   ├─ HAL version: must match hardwareAbstractionEngine.ts
   └─ SHA-256 digest of firmware body
└─ Body: bootloader + kernel + rootfs
└─ Signature: RSA-4096 or ECDSA-P256 (HSM placeholder)
```

---

## 5. Rollback Strategy

| Trigger | Action |
|---|---|
| Health check fails within 60 s of OTA | Automatic rollback to `rollbackVersion` |
| User initiates rollback | Manual via USB-C ADB command |
| Critical sensor failure post-OTA | Auto-rollback + diagnostic log |
| AI model failure | Roll back models only (firmware retained) |

Rollback is implemented in `hardwareDeploymentEngine.rollback()`.

---

## 6. Diagnostic Logs

Log collection is governed by Sprint 12 (Privacy Dashboard):

| Log type | Retention | Consent required |
|---|---|---|
| System health (sensor status) | 7 days on device | No |
| Guardian alert log | Session only | Yes (pilot mode) |
| Crash logs | 30 days | Yes |
| Navigation data | Session only, deleted after | Yes |
| OTA log | Permanent (version history) | No |

Logs are accessible via USB-C ADB in dev/staging, and via encrypted upload in production (opt-in).

---

## 7. Recovery Mode

Recovery mode is activated when:
- Device fails to boot 3× consecutively
- User holds power button for 10 s
- USB-C recovery cable detected on boot

Recovery mode allows:
- Wipe + re-provision (factory reset → Sprint 20 provisioning flow)
- Emergency firmware flash (unsigned in EVT; signed in DVT+)
- Diagnostic dump to USB-C host

Safety rule: Guardian and all safety alerts operate in recovery mode using minimum firmware image.

---

## 8. Deployment Engine API

From `hardwareDeploymentEngine.ts`:

| Function | Purpose |
|---|---|
| `createDeploymentPipeline()` | Initialise 4-stage pipeline with defaults |
| `getStageConfig(stage)` | Get configuration for a specific stage |
| `checkForOTA(state, deviceId)` | Check if OTA update is available |
| `applyOTA(state, version)` | Advance to next version |
| `rollback(state)` | Roll back to previous version |
| `addDiagnosticEntry(state, level, msg, source)` | Log a diagnostic event |
| `isProductionReady(state)` | Check if all stages are configured and signed |
| `getDeploymentSummary(state)` | Human-readable deployment status |
