---
name: Sprint history and GitHub push pattern
description: Completed sprint history, test counts, and the working GitHub push approach
---

# Sprint history

## Sprint 1 — Audit
- Audit report: docs/PHASE_1_TO_18_AUDIT_REPORT.md
- Pushed: commit ac8bc61

## Sprint 2 — Dead code + route wiring
- Removed 27 build warnings (unused imports across 7 pages, 2 components, 5 engines)
- Added /api/navigation/start + /api/navigation/end wiring in useVisionSession
- Added public/favicon.ico (fixed Next.js 15.5 PageNotFoundError)
- Pushed: commit ac8bc61

## Sprint 3 — Real Camera Flow
- Added CameraStatus 'fallback' (5th state: camera was active then stream lost)
- cameraStateEngine.ts: pure functions for state machine, labels, privacy rules
- useCameraCapture.ts: track.ended listener → 'fallback', type re-export from engine
- session/page.tsx: fallback badge/UI/Retry Camera button, isSimulationMode(), getCameraModeLabel()
- tests/cameraFlow.test.ts: 72 tests
- Total tests: 1896 passing
- Pushed: commit a8f1ac5

## GitHub push pattern
**Why:** process.env is undefined in code_execution sandbox; must use bash.
**How to apply:** Use `node -e "..."` in bash with https.request to GitHub REST API.
Steps: GET /refs/heads/main → GET /git/commits/{sha} → POST /git/blobs (per file) →
POST /git/trees → POST /git/commits → PATCH /git/refs/heads/main
Repo: Dennis2y/Denarixx-Vision-AI, branch: main

## Build critical rules
- After any `npm run build`, always `rm -rf denarixx/.next` and restart workflow
- Test runner: `npx tsx tests/<name>.test.ts` — pure Node.js, no browser
- TypeScript: `cd denarixx && npm run type-check`
