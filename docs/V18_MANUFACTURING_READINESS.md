# V18 — Manufacturing Readiness & Product Certification Layer

> **All certification items in this document are planning/roadmap only.**
> Denarixx Vision AI is not CE marked, not medically approved, and is not a medical device.
> This document is for internal planning purposes only.

---

## Overview

Phase 18 creates the complete software infrastructure for manufacturing planning, compliance tracking, product risk management, and certification roadmapping. No hardware is manufactured in this phase.

---

## Files Added

| File | Purpose |
|---|---|
| `src/types/manufacturing.ts` | 11 hardware component types, compliance types, risk types, readiness scoring, `MANUFACTURING_DISCLAIMER` |
| `src/engines/manufacturingReadinessEngine.ts` | Hardware registry (11 components), readiness scoring, manufacturing options (3 regions), next actions |
| `src/engines/compliancePlanningEngine.ts` | 9 compliance items, score calculation, warnings, high-priority filtering |
| `src/engines/productRiskEngine.ts` | 14 risks across 6 categories, scoring, filtering, formatting |
| `src/engines/certificationRoadmapEngine.ts` | 10 certification milestones across 4 phases, budget estimates, timeline |
| `src/app/manufacturing/page.tsx` | 6-tab dashboard: Overview, Hardware, Compliance, Risks, Roadmap, Manufacturing |
| `src/app/api/manufacturing/readiness/route.ts` | GET full readiness report |
| `src/app/api/manufacturing/risk/route.ts` | GET risks (filterable by level/category/critical) |
| `src/app/api/manufacturing/certification/route.ts` | GET certification milestones + compliance warnings |
| `tests/manufacturingReadiness.test.ts` | Comprehensive engine tests |
| `docs/V18_MANUFACTURING_READINESS.md` | This file |
| `docs/CERTIFICATION_AND_COMPLIANCE_ROADMAP.md` | Detailed certification roadmap |
| `docs/MANUFACTURER_REQUIREMENTS_BRIEF.md` | Manufacturer briefing document |

---

## Hardware Component Registry (11 components)

| Component | Readiness | Critical Path |
|---|---|---|
| Camera Modules (×4) | Specification | ✅ Yes |
| LiPo Battery (300mAh) | Specification | ✅ Yes |
| Bone-Conduction Audio | Planning | ✅ Yes |
| Haptic Motor (LRA) | Planning | No |
| Compute Module (AR2 placeholder) | Planning | ✅ Yes |
| Bluetooth LE 5.3 | Planning | ✅ Yes |
| Wi-Fi 6 (optional) | Not Started | No |
| Thermal Management | Planning | No |
| Frame Structure | Planning | ✅ Yes |
| USB-C Charging | Planning | No |
| IMU Sensor | Planning | No |

**Overall hardware readiness: ~34/100 (Mid Planning)**

---

## Compliance Planning (9 items)

| Standard | Status | Priority |
|---|---|---|
| GDPR | In Progress | 🔴 Critical |
| DPIA (GDPR Art. 35) | Planning | 🔴 Critical |
| Medical Device Boundary (MDR) | Planning | 🔴 Critical |
| Battery Safety (IEC 62368) | Planning | 🔴 Critical |
| EU Accessibility Act (EAA) | Planning | 🟠 High |
| CE Marking (EMC + RED) | Planning | 🟠 High |
| EU Product Safety (GPSR) | Planning | 🟠 High |
| ETSI EN 300 328 (Bluetooth EU) | Planning | 🟡 Medium |
| FCC Part 15 (US, if applicable) | Not Assessed | 🟢 Low |

---

## Product Risks (14 risks)

| Risk ID | Category | Level | Status |
|---|---|---|---|
| HW-001 | Hardware | Critical | Open |
| HW-002 | Hardware | High | Open |
| HW-003 | Hardware | High | Open |
| HW-004 | Hardware | Medium | Open |
| SW-001 | Software | High | Open |
| SW-002 | Software | Medium | Open |
| SW-003 | Software | Low | Accepted |
| REG-001 | Regulatory | Critical | Open |
| REG-002 | Regulatory | High | Open |
| SAF-001 | Safety | High | Mitigated |
| SAF-002 | Safety | High | Mitigated |
| SC-001 | Supply Chain | Medium | Open |
| PRIV-001 | Privacy | High | Mitigated |
| PRIV-002 | Privacy | Medium | Mitigated |

**2 critical risks are open (HW-001, REG-001). Both must be addressed before investor or manufacturer meetings.**

---

## Certification Roadmap (10 milestones)

### Pre-Prototype (Q2–Q3 2026)
- GDPR DPO Appointment — €3–8k/year
- Data Protection Impact Assessment — €5–15k
- Medical Device Boundary Assessment — €8–20k ⚠ Required before any public launch
- Battery Safety Pre-Assessment (IEC 62368) — €3–8k

### Prototype (Q3–Q4 2026)
- EU Accessibility Act Conformance Audit — €10–25k
- Battery Safety Full Certification — €15–40k
- ETSI EN 300 328 (Bluetooth) — €5–15k

### Pre-Production (Q1 2027)
- CE Marking — €20–60k ⚠ Cannot claim until certified
- EU General Product Safety (GPSR) — included in CE marking

### Production (Q3 2027+)
- FCC Part 15 (US market, if applicable) — €10–25k

**Total estimated certification budget: €79,000 – €216,000**

---

## Manufacturing Options

| Option | Lead Time | Prototype Cost | Recommended For |
|---|---|---|---|
| Hybrid (EU design + CN manufacturing) | 20 weeks | €8–30k | Phase 18→19 transition |
| China (Shenzhen EMS) | 16 weeks | €5–20k | Scale >1,000 units |
| Europe (Germany/Netherlands EMS) | 24 weeks | €15–60k | GDPR-first pilot prototypes |

**Recommended path: Hybrid — industrial design in Germany, component manufacturing and assembly in China.**

---

## What Is Real vs Simulated/Planned

| Feature | V18 Status |
|---|---|
| Hardware registry + scoring | ✅ Real logic |
| Compliance checklist | ✅ Real planning data |
| Risk registry + scoring | ✅ Real logic |
| Certification roadmap | ✅ Real planning data (placeholders) |
| Manufacturing option comparison | ✅ Real analysis |
| Physical hardware prototype | ⬜ Does not exist |
| CE marking | ⬜ Not started |
| GDPR certification | ⬜ In progress (consent in V11/V17) |
| Any manufacturer NDA | ⬜ Not started |
| Medical device assessment | ⬜ Not started |
