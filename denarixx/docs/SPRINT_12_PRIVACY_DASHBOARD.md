# Sprint 12 — Privacy Dashboard & Consent Management

## Overview

Sprint 12 delivers complete privacy transparency and user control for Denarixx Vision AI. Every permission, stored memory, navigation record, and AI action is visible and deletable by the user. The dashboard is the final sprint of **Phase 2: Context & Trust**, automatically activating **Phase 3: Expanded Access** when complete.

---

## Architecture

### New files

| Path | Purpose |
|------|---------|
| `src/types/privacy.ts` | All privacy types: ConsentItem, AuditEvent, RetentionRule, PrivacyExport, etc. |
| `src/engines/consentManagementEngine.ts` | 10-item consent registry, grant/revoke/toggle/reset lifecycle |
| `src/engines/permissionAuditEngine.ts` | Ring-buffer audit log (100 events), all event types, summary |
| `src/engines/dataRetentionEngine.ts` | 6 retention rules, expiry detection, deletion simulation |
| `src/engines/privacyDashboardEngine.ts` | Dashboard state, privacy summary, export, reset orchestration |
| `src/app/privacy/page.tsx` | Full Privacy Dashboard (Client Component, 5 tabs) |
| `tests/privacyDashboard.test.ts` | Comprehensive test suite across all 4 engines |
| `docs/SPRINT_12_PRIVACY_DASHBOARD.md` | This document |

---

## Privacy Philosophy

Denarixx is designed **privacy-first**:

1. **Consent-gated** — every data-collecting feature requires explicit consent before activation
2. **Transparent** — users see exactly what data is stored and why
3. **Revocable** — any permission can be disabled at any time, immediately
4. **Erasable** — any stored data can be deleted at any time
5. **Local-first** — all storage is on-device; no data leaves the device in simulation mode
6. **Auditable** — every permission change and data operation is logged

---

## Consent registry (10 permissions)

| ID | Name | Default | Impact | Toggleable |
|----|------|---------|--------|-----------|
| `camera` | Camera | Granted | High | Yes |
| `microphone` | Microphone | Not requested | High | Yes |
| `navigation` | Navigation & Location | Not requested | Medium | Yes |
| `long_term_memory` | Long-Term Memory | Not requested | Medium | Yes |
| `voice_companion` | Voice Companion | Granted | Low | Yes |
| `scene_descriptions` | Scene Descriptions | Granted | Low | Yes |
| `ai_explanations` | AI Explanations | Granted | None | Yes |
| `analytics` | Session Analytics | Granted | Low | Yes |
| `cloud_sync` | Future Cloud Sync | Placeholder | High | No (future) |
| `face_recognition` | Face Recognition | Placeholder | High | No (future) |

Each item displays: current status, reason for use, last accessed time, privacy impact, and retention policy.

---

## Consent lifecycle

```
not_requested → granted (user enables)
granted → denied (user disables)
denied → granted (user re-enables)
placeholder → (no change — future feature)
```

Grant/revoke operations are **immutable** — they return new arrays without mutating the original.

---

## Audit trail

The permission audit engine maintains a **ring buffer** of 100 events. Event types:

| Type | Trigger |
|------|---------|
| `permission_granted` | User enables a consent |
| `permission_revoked` | User disables a consent |
| `memory_created` | AI creates a memory entry |
| `memory_deleted` | User deletes a memory |
| `settings_changed` | Any preference setting is changed |
| `navigation_exported` | User exports navigation history |
| `privacy_reset` | User resets all privacy settings |
| `data_exported` | User downloads their data |
| `data_deleted` | User deletes a data category |
| `audit_cleared` | User clears the audit log |

When the buffer is full (>100 events), the oldest events are discarded (FIFO).

---

## Data retention policies

| Category | Policy | Auto-delete |
|----------|--------|------------|
| Memories | 90 days | No (manual) |
| Saved places | 90 days | No (manual) |
| Navigation history | 30 days | Yes |
| AI activity | 7 days | Yes |
| Preferences | Forever | No |
| Audit log | 30 days (ring buffer) | Yes |

---

## Privacy dashboard (5 tabs)

| Tab | Contents |
|-----|----------|
| **Overview** | Privacy philosophy, data summary, quick actions, GDPR readiness |
| **Permissions** | All 10 consent toggles with status, reason, impact, retention |
| **Your Data** | Delete memories, clear nav history, delete all, export JSON |
| **Activity Log** | Last 10 audit events, clear log button |
| **Retention** | 6 retention rules, auto-delete status, future encryption note |

### Privacy summary bar

The header always shows:
- Active permissions count (green)
- Disabled permissions count (red)
- High-impact permissions granted (yellow)
- Overall risk level (low/medium/high)

---

## Data export (GDPR Art. 20)

`exportAsJson()` produces a machine-readable JSON file containing:
- All consent states with metadata
- Last 20 audit events
- Data summary counts
- Privacy disclaimer
- GDPR compliance note

In production, this would be a full Art. 20 data portability export.

---

## Integration points

| Sprint | Connection |
|--------|-----------|
| Sprint 8 (Long-Term Memory) | `long_term_memory` consent gates memory creation; clearMemories() zeroes count |
| Sprint 9 (Explainable AI) | `ai_explanations` consent controls trust transparency panel |
| Sprint 10 (Companion) | Companion respects `voice_companion` consent |
| Sprint 11 (Accessibility) | Privacy dashboard applies accessibility CSS classes via `deriveAccessibilityClasses` |
| Sprint 5 (Guardian) | `analytics` consent governs session analytics recording |
| V13 (Navigation) | `navigation` consent gates GPS; `clearNavigationHistory()` wipes records |
| V7 (Sensors) | GPS fuzzing enforced unless `navigation` consent granted with precise mode |

---

## Roadmap auto-update

When `privacyDashboard.test.ts` is detected by `projectProgressEngine.ts`:
- Sprint 12 status → **complete**
- Phase 2 (Context & Trust) → all 7 sprints complete → **Phase 2 Complete**
- Phase 3 (Expanded Access) → **Active** (auto-activates)
- Home page roadmap and `/roadmap` page update dynamically via `computeProgress()`

---

## Future GDPR-ready cloud architecture

```
User Device
├── Local storage (current: in-memory, future: IndexedDB + AES-256)
│   ├── Encrypted memories
│   ├── Route history (obfuscated GPS)
│   └── Preferences
│
├── Consent manager
│   ├── Art. 7: Granular per-feature consent
│   ├── Art. 17: Erasure on demand
│   └── Art. 20: Portable export
│
└── Cloud sync (future, opt-in)
    ├── End-to-end encryption (client-side key)
    ├── Zero-knowledge server
    └── Revocable at any time → immediate server-side deletion
```

---

## Tests

`tests/privacyDashboard.test.ts` — 7 sections:

- **Section 1:** Consent registry (7 tests)
- **Section 2:** Consent queries (14 tests)
- **Section 3:** Grant / revoke (12 tests)
- **Section 4:** Audit engine (24 tests)
- **Section 5:** Data retention engine (19 tests)
- **Section 6:** Privacy dashboard engine (19 tests)
- **Section 7:** Integration pipeline (10 tests)

Run: `cd denarixx && npx tsx tests/privacyDashboard.test.ts`
