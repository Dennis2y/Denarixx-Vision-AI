# Field Trial Safety Protocol — Denarixx Vision AI

**Version:** Phase 17 (Germany Pilot)  
**Status:** Controlled prototype testing only  
**Date:** 2026  

---

## Who Can Test

### Eligible Participants
- Adults aged 18+ with a confirmed visual impairment (blind or low vision)
- Enrolled in a formal research partnership (university, NGO, or disability organisation)
- Able to communicate clearly with the supervisor during the session
- Not under acute medical stress or distress on the day of testing

### Who Should NOT Test Yet
- Children under 18
- Users with any acute health condition that day
- Users without a trusted human supervisor present
- Anyone in an unsecured outdoor environment
- Anyone without prior session briefing and consent signing

---

## Where to Test

### Phase 17 Approved Environments

| Environment | Status | Notes |
|---|---|---|
| Indoor hallway (research lab or office) | ✅ Approved | Low risk, ideal for first session |
| Obstacle course (controlled room) | ✅ Approved | Padded obstacles, slow pace |
| Supermarket (quiet hours, partner store) | ✅ Approved | Staff-cleared aisle, quiet hours only |
| Outdoor residential pavement | ✅ Approved | Low-traffic street, no road crossings |
| Stair navigation (handrail required) | ✅ Approved (2 supervisors) | Must have handrail, one step at a time |
| Road crossing simulation | ✅ Approved simulation only | Car park or indoor only — NO real traffic |
| Public transport simulation | ✅ Approved simulation only | Indoor mock platform only — NO live platforms |
| Real road crossings | ❌ NOT approved — Phase 18+ | Too high risk without certified safety protocols |
| Busy public spaces | ❌ NOT approved — Phase 18+ | Crowd density unpredictable |

---

## How to Supervise

### Before the Session
- [ ] Read and sign the session briefing document
- [ ] Confirm the environment is secured and cleared
- [ ] Verify the participant has signed the digital consent
- [ ] Confirm all 5 consent checkboxes are checked in the app
- [ ] Set participant ID (anonymized, e.g. `P001`)
- [ ] Brief the participant on the Emergency Stop button location
- [ ] Check device battery (≥ 50% recommended)
- [ ] Test audio guidance is audible in the environment
- [ ] Confirm the session scenario is appropriate for this participant

### During the Session
- Position yourself 1–2 meters ahead of the participant at all times
- Never let the participant approach a hazard you cannot immediately intercept
- Log supervisor notes in real time using the Notes panel
- If ANY incident occurs — even minor — log it immediately
- Speak gently and clearly if the AI guidance is unclear
- Do NOT override the AI guidance unless there is a safety risk
- Watch for signs of distress: disorientation, increased anxiety, trembling, silence

### If Something Goes Wrong
1. Say "Stop. We're pausing." clearly
2. Tap the **Emergency Stop** button in the app
3. Guide the participant to a seated safe position
4. Log an incident report (severity: minor/moderate/serious)
5. Do not resume the session in the same location
6. Debrief the participant

---

## What NOT to Test in Phase 17

| Activity | Reason |
|---|---|
| Real road crossings with live traffic | Insufficient AI certainty — V13 crossing engine is advisory only |
| Live train/bus platforms | Unpredictable edges and vehicle movement |
| Night-time outdoor navigation | Camera + GPS accuracy insufficient |
| Stair navigation without handrail | Fall risk without secondary support |
| Crowded city centres | Social AI (V9) is advisory; crowd density unpredictable |
| Navigation without supervisor | Single point of failure — always 2-person minimum |
| Sessions >60 minutes | Cognitive fatigue risk; break every 20 minutes |

---

## Emergency Stop Rules

The Emergency Stop button is 72px tall, always visible during active sessions.

**When to use it:**
- Any sign of physical danger to the participant
- Participant requests to stop
- AI gives guidance that contradicts real-world safety
- Hardware failure (glasses disconnected, audio lost, phone dies)
- Any incident, regardless of severity

**Effect:**
- Ends the session immediately
- Marks `emergencyStopUsed: true` in the session record
- Generates a session report automatically
- Does NOT delete any data — data is preserved for safety review

**After Emergency Stop:**
- Do not start a new session until the incident is reviewed
- Submit the report to the research lead
- Discuss with the participant what happened
- Adjust the test environment before any further sessions

---

## Consent Checklist

Before each session, confirm ALL of the following are ✅:

- [ ] Participant consent given (verbal + digital checkbox)
- [ ] Human supervisor is physically present
- [ ] "Assistive support only" disclaimer accepted
- [ ] No video storage confirmed by participant
- [ ] No face recognition confirmed by participant
- [ ] Anonymized participant ID set (no real names)
- [ ] Environment cleared and safety-checked
- [ ] Emergency Stop button demonstrated to participant

---

## Privacy Checklist

| Rule | Enforced by |
|---|---|
| No video footage stored | V14 CAMERA_PRIVACY constants |
| No face recognition | V8/V9/V14 SAFETY_RULES |
| No emergency livestreaming | V11 + V17 TRIAL_PRIVACY |
| No biometric data | No biometric sensors |
| Location storage disabled by default | V7 locationEnabled: false |
| Full data deletion available | `deleteSessionData()` + `deleteReport()` |
| Participant ID anonymized | No real names ever stored |
| Report only saved after consent | Checkbox before report generation |

---

## Germany Pilot Testing Notes

### Regulatory Context
- EU Accessibility Act (2025) applies — Denarixx must meet EN 301 549 accessibility standard
- GDPR applies fully — participant data treated as sensitive (disability status inferred)
- Research ethics approval required from partner institution (TU Berlin / RWTH Aachen)
- German disability registry partnerships via BMAS (Federal Ministry of Labour and Social Affairs)

### Partner Organisation Requirements
- Written IRB/ethics approval from partner university
- Named research lead responsible for session safety
- Supervisor training (minimum 2-hour briefing + mock session)
- Incident reporting within 24 hours via partner protocol
- Data stored only on GDPR-compliant EU servers (not Replit production — dedicated server)

### What Participants Should Know
- "The AI helps you navigate — it does not guarantee safety"
- "A human supervisor is always with you — you are never alone"
- "You can stop at any time, for any reason"
- "No video of you is recorded"
- "All your data is identified by a code, not your name"
- "You can ask for all your data to be deleted at any time"

### What the Germany Pilot Covers (Phase 17)
- 10–30 participants across 3 scenarios (hallway, obstacle path, outdoor pavement)
- 2 sessions per participant (familiarisation + test)
- Full V17 safety metrics collected
- V11 pilot testing protocol remains active for lab scenarios
- Feedback used to improve V18+ guidance, alert timing, and wording

---

## Safety Rules Summary

| Rule | Details |
|---|---|
| Supervisor always present | No unsupervised sessions ever |
| 2 supervisors for high-risk | Stairs, road crossing simulation, crowded areas |
| Emergency Stop always visible | 72px button, always on screen during active session |
| No real road crossings | Phase 18+ only, with certified protocol |
| No sessions >60 minutes | 20-minute break intervals |
| Consent before data collection | `createTrialSession` throws without valid consent |
| Data deletion on request | Immediate, complete, irreversible |
| Incident reporting within session | Log all incidents, even minor |
