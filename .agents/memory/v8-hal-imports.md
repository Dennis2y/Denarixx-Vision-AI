---
name: V8 HAL import placement
description: HARDWARE_DEFAULTS is in types/hardware.ts not in engine files — import split matters for tree-shaking and avoids a build warning.
---

## Rule

- `HARDWARE_DEFAULTS` (the default `HardwareSettings` object) lives in `src/types/hardware.ts`
- `SAFETY_RULES` (the frozen safety constraint constants) lives in `src/engines/hardwareBridgeEngine.ts`
- `HardwareBridgeEngine` class also lives in `hardwareBridgeEngine.ts`

Incorrect pattern (causes "defined but never used" ESLint warning in build):
```ts
import { HARDWARE_DEFAULTS, SAFETY_RULES } from '@/engines/hardwareBridgeEngine';
```

Correct pattern:
```ts
import { SAFETY_RULES } from '@/engines/hardwareBridgeEngine';
import { HARDWARE_DEFAULTS } from '@/types/hardware';
```

**Why:** Forgetting this split causes the build to emit an unused-import warning for whichever symbol isn't actually used from the engine file. The types file is pure — no side effects — so importing constants from there is always safe.

**How to apply:** Whenever adding a new import of hardware constants, check the file they're defined in (`grep HARDWARE_DEFAULTS src/types/hardware.ts`) rather than assuming they're co-located with the engine class.
