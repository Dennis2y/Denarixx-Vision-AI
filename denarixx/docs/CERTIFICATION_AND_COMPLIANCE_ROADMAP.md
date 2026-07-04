# Certification & Compliance Roadmap — Denarixx Vision AI

> **Planning document only. No certifications have been obtained.**
> Do not claim CE marking, medical device approval, or GDPR certification based on this document.

---

## Immediate Actions (Q2–Q3 2026)

### 1. GDPR Data Protection Officer (DPO) Appointment
- **Standard:** GDPR Art. 37
- **Cost:** €3,000–8,000/year retainer
- **Why urgent:** Required before ANY real participant data is collected. V17 field trials may trigger this.
- **Action:** Contact a EU-qualified external DPO service (e.g. DPO Centre, TÜV Rheinland DPO).

### 2. Data Protection Impact Assessment (DPIA)
- **Standard:** GDPR Art. 35
- **Cost:** €5,000–15,000
- **Scope:** V7 GPS, V9 social awareness, V11/V17 participant data, disability status inferred
- **Action:** Conduct with appointed DPO. Must be completed before >10 participants in any trial.

### 3. Medical Device Boundary Assessment
- **Standard:** EU MDR 2017/745
- **Cost:** €8,000–20,000
- **Why critical:** Any device that claims to aid a medical condition could fall under MDR Class I/IIa. Navigation for blind users is borderline.
- **Action:** Engage qualified EU regulatory consultant (BSI Group, Qserve, or Qunique). Get formal written opinion.
- **Warning:** Never claim Denarixx Vision AI is a medical device. Never claim it replaces medical care.

### 4. Battery Safety Pre-Assessment (IEC 62368-1)
- **Standard:** IEC 62368-1
- **Cost:** €3,000–8,000 pre-assessment; €15–40k full certification
- **Why urgent:** Any LiPo battery in a consumer wearable must pass IEC 62368. Fire safety risk.
- **Action:** Contact accredited lab (TÜV SÜD, SGS, Intertek) for pre-assessment now, before prototype.

---

## Prototype Phase (Q3–Q4 2026)

### 5. EU Accessibility Act Conformance
- **Standard:** EN 301 549 (Directive 2019/882)
- **Cost:** €10,000–25,000
- **Scope:** Software UI (all 15 pages), hardware usability for blind/low-vision users
- **Action:** Hire accessibility auditor. Fix all EN 301 549 failures before commercial launch.

### 6. ETSI EN 300 328 (Bluetooth Radio — EU)
- **Standard:** ETSI EN 300 328 v2.2.2
- **Cost:** €5,000–15,000 (reduced with pre-certified module)
- **Tip:** Use Nordic nRF5340 or similar pre-certified module to reduce timeline and cost.

### 7. Battery Safety Full Certification
- **Standard:** IEC 62368-1
- **Cost:** €15,000–40,000
- **Requires:** Physical prototype with LiPo battery and charging circuit

---

## Pre-Production Phase (Q1 2027)

### 8. CE Marking (EMC + RED Directives)
- **Standards:** EMC Directive 2014/30/EU + Radio Equipment Directive 2014/53/EU
- **Cost:** €20,000–60,000
- **Requires:** Pre-production unit + accredited lab
- **Notified body:** TÜV Rheinland (Germany) — recommended
- **Warning:** CE marking cannot be applied to product until accredited testing passes.

### 9. EU General Product Safety (GPSR)
- **Standard:** Regulation EU 2023/988
- **Cost:** Included in CE marking process
- **Requires:** Product traceability system, user manual in local language, incident reporting system

---

## Production Phase (Q3 2027+)

### 10. FCC Part 15 (US Market — optional)
- **Standard:** FCC 47 CFR Part 15
- **Cost:** €10,000–25,000
- **When:** Only needed if entering US market after EU launch

---

## Total Budget Estimate

| Phase | Est. Budget |
|---|---|
| Pre-prototype (Q2–Q3 2026) | €19,000–51,000 |
| Prototype (Q3–Q4 2026) | €30,000–80,000 |
| Pre-production (Q1 2027) | €20,000–60,000 |
| Production (Q3 2027+) | €10,000–25,000 |
| **Total** | **€79,000–216,000** |

> These are rough estimates for a Germany-first launch. Actual costs depend on prototype readiness, chosen lab, and whether pre-certified modules are used.

---

## Compliance Privacy Summary

All privacy-related compliance obligations flow from GDPR. Key controls already in software:

| Control | Where Implemented |
|---|---|
| Consent collection | V11 pilotTestingEngine, V17 fieldTrialEngine |
| Data deletion | deleteSessionData(), deleteReport() |
| GPS fuzzing | V7 locationPrivacyEngine (0.01° grid) |
| No face recognition | V8/V9/V14 SAFETY_RULES |
| No video storage | V14 CAMERA_PRIVACY |
| No biometric storage | V16/V17 TRIAL_PRIVACY |
| Anonymized participant IDs | V11/V17 — no real names stored |

**Gap:** No persistent database yet. V18 uses in-memory stores. A GDPR-compliant PostgreSQL instance with encryption at rest is required before production.
