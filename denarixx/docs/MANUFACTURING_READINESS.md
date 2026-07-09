# Manufacturing Readiness — Denarixx Vision Glasses

**Revision:** Sprint 19
**Platform:** Denarixx V1 prototype

---

## 1. Manufacturing Stages

### Stage 0 — Software-Defined Prototype (Current)

All hardware is simulated in software (Sprint 18 Digital Twin).  The glasses do not yet exist as physical hardware.

| Status | Item |
|---|---|
| ✅ Complete | 28 software sprints (Phases 1–5) |
| ✅ Complete | Digital Twin with 11 virtual components |
| ✅ Complete | HAL (hardware abstraction layer) |
| ✅ Complete | Manufacturing readiness score in software |
| 🔲 Pending | Physical PCB |
| 🔲 Pending | Prototype frame |
| 🔲 Pending | Physical sensor integration |

**Gate to EVT:** Hardware specification approved (this document). Digital Twin 5/5 AI validations pass. Manufacturing readiness score ≥ 85.

---

### Stage 1 — EVT (Engineering Validation Test)

**Target:** Q4 2026

**Purpose:** Validate that hardware design works — not production quality, not wearable aesthetics.

| Quantity | ~5 units (hand-built) |
|---|---|
| Frame | Off-the-shelf safety glasses frame + custom PCB |
| PCB | Custom 4-layer, hand-soldered components |
| Cameras | Commercial modules (IMX sensor evaluation kits) |
| Battery | Off-shelf Li-Po with PCM |
| OS | Linux Wearable (Sprint 17 HAL `linux-wearable` platform) |
| Test focus | Camera functionality, AI latency, battery runtime, sensor fusion |

**EVT Acceptance Criteria:**
- [ ] All 4 cameras initialise and deliver frames within HAL spec
- [ ] Guardian alert latency ≤ 500 ms (critical path)
- [ ] Battery runtime ≥ 3 h (active AI mode)
- [ ] Bone-conduction audio intelligible at 85 dB ambient noise
- [ ] GPS acquires fix within 30 s (cold start, open sky)
- [ ] Fall detection triggers within 200 ms
- [ ] All Sprint 17 HAL unit tests pass on physical hardware
- [ ] No safety rule violations (Guardian never says "safe to cross")

---

### Stage 2 — DVT (Design Validation Test)

**Target:** Q2 2027

**Purpose:** Validate that the design can be manufactured reliably and meets wearability/comfort targets.

| Quantity | ~20 units |
|---|---|
| Frame | Custom-designed glasses frame (3D-printed or CNC aluminium) |
| PCB | Refined 6-layer, surface-mount, thinner |
| Weight | Target ≤ 85 g |
| IP rating | IP53 achieved |
| Battery | Custom pouch cell integrated in frame arm |
| Wireless | Wi-Fi 6 + Bluetooth 5.3 + optional eSIM integrated |
| OS | Denarixx OS (Sprint 16 Glasses Runtime) |
| Test focus | Wearability, thermal management, drop/rain/dust tests |

**DVT Acceptance Criteria:**
- [ ] Weight ≤ 85 g with battery
- [ ] IP53 (IEC 60529): dust-protected, rain test 3 minutes
- [ ] 1.2 m drop test: 6 faces, no functional failure
- [ ] Thermal: SoC < 48°C at 35°C ambient, 2 h continuous use
- [ ] Battery runtime ≥ 4 h (active), ≥ 8 h (emergency mode)
- [ ] Bone-conduction: user study, ≥ 90 % intelligibility in noisy environment
- [ ] 10 user wearability study (1 h each, representative of visually impaired users)
- [ ] All 28 sprint tests pass on DVT hardware

---

### Stage 3 — PVT (Production Validation Test)

**Target:** Q4 2027

**Purpose:** Validate that the manufacturing line produces consistent, safe, repeatable units.

| Quantity | ~100 units |
|---|---|
| Manufacturer | Contract manufacturer (EMS partner — TBD) |
| Line | Surface-mount production line + automated optical inspection |
| Test | Automated functional test (AFT) for every unit |
| Certification | CE (EU), FCC (US), EAA (EU Accessibility Act) |
| Packaging | Retail-ready with quick-start guide (accessible format) |

**PVT Acceptance Criteria:**
- [ ] Automated functional test pass rate ≥ 99.5 %
- [ ] 30-day reliability test (10 units): zero field failures
- [ ] CE marking obtained
- [ ] GDPR compliance audit complete (Sprint 12 Privacy Dashboard)
- [ ] EAA (European Accessibility Act) conformance assessment
- [ ] Authorised repair service established (right-to-repair)
- [ ] OTA update system live (Sprint 15 model OTA)

---

### Stage 4 — Limited Manufacturing Run

**Target:** Q1 2028

| Quantity | 500–2000 units (pilot market) |
|---|---|
| Channel | Direct (denarixx.com) + accessibility organisations |
| Support | Remote support via phone companion app (Sprint 16) |
| Warranty | 2 years (EU consumer law minimum) |
| Data | Field trial data feeds back to AI (Sprint 17) |

---

## 2. Compliance & Certification Roadmap

Defined in `src/engines/certificationRoadmapEngine.ts` (Sprint 18 `manufacturingReadiness`).

| Certification | Region | Stage | Notes |
|---|---|---|---|
| CE (Radio Equipment) | EU | DVT | Wi-Fi, BT, eSIM transmitters |
| FCC Part 15 | US | DVT | RF emissions |
| GDPR compliance | EU | DVT | Privacy audit (Sprint 12) |
| EAA (EU Accessibility Act) | EU | PVT | Accessibility conformance |
| CE (Medical Device, optional) | EU | PVT | If classified as Class I medical device |
| ISO 9001 (QMS) | Global | PVT | Quality management at EMS partner |
| UKCA | UK | PVT | Post-Brexit UK market |
| AS/NZS | AUS/NZ | LMR | Future expansion |

All compliance items carry `isRoadmapOnly: true` and `isPlaceholder: true` per Sprint 18 `MANUFACTURING_DISCLAIMER`.

---

## 3. Risk Register (Top 5)

From `productRiskEngine.ts` (Sprint 18):

| Risk | Level | Mitigation |
|---|---|---|
| Battery thermal runaway | High | PCM hardware protection; conservative software thresholds (48°C) |
| Camera failure in safety-critical moment | High | 4-camera fallback chain; camera failure alert (Sprint 15) |
| GPS unavailable (urban canyon) | Medium | IMU dead-reckoning fallback (Sprint 17); offline guardian (Sprint 15) |
| AI false positive (phantom hazard) | Medium | Confidence thresholds (Sprint 5); Guardian silence decision (Sprint 2) |
| NPU thermal throttle in hot weather | Medium | Thermal budget management (Sprint 15/18) |

---

## 4. Software Readiness

All software validation is automated.  Run before ordering any prototype hardware:

```bash
cd denarixx

# Core AI safety
npm test                                              # V1 core (24/24)
npx tsx tests/guardianAlertQuality.test.ts            # Sprint 5 (60/60)

# Hardware simulation
npx tsx tests/glassesSimulator.test.ts                # Sprint 18 Digital Twin (127/127)
npx tsx tests/hardwareAbstraction.test.ts             # Sprint 17 HAL (161/161)
npx tsx tests/multiCameraSupport.test.ts              # Sprint 14 cameras (164/164)
npx tsx tests/onDeviceAI.test.ts                      # Sprint 15 AI scheduler (170/170)

# Navigation & offline safety
npx tsx tests/navigationEngine.test.ts                # Sprint 13 nav (151/151)
npx tsx tests/streetSafety.test.ts                    # Sprint 15 offline (143/143)

# Privacy & compliance
npx tsx tests/privacyDashboard.test.ts                # Sprint 12 (103/103)
npx tsx tests/manufacturingReadiness.test.ts          # Sprint 18 mfg (144/144)

# Full type check & build
npm run type-check
npm run build
```

---

## 5. Budget Estimate (Prototype)

From `certificationRoadmapEngine.ts` (Sprint 18) — all figures are illustrative placeholders:

| Stage | Estimated Cost |
|---|---|
| EVT (5 units + engineering) | €40k – €60k |
| DVT (20 units + tooling) | €80k – €120k |
| PVT (100 units + certification) | €150k – €216k |
| **Total prototype to PVT** | **€270k – €396k** |

These figures are initial estimates.  Actual costs depend on EMS partner selection, component sourcing, and certification scope.

---

## 6. Manufacturer Requirements

See `denarixx/docs/MANUFACTURER_REQUIREMENTS_BRIEF.md` (Sprint 18) for EMS partner requirements.

Key requirements:
- Experience with wearable / head-worn electronics
- Clean-room capable (camera module integration)
- Automated optical inspection (AOI) and X-ray capability
- ISO 9001 certified
- GDPR-compliant data handling for production data
