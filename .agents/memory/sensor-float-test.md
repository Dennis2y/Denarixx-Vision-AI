---
name: Sensor grid-snap float test
description: Modulo-based test for 0.01-degree grid snap fails due to floating-point imprecision; use round-trip diff instead.
---

## Rule

When testing that a latitude/longitude has been snapped to a 0.01° grid, do NOT use:
```ts
const remainder = Math.round((lat % 0.01) * 10000); // unreliable
expect(remainder).toBe(0);
```

Instead use a round-trip tolerance check:
```ts
const snapped = Math.round(lat / 0.01) * 0.01;
const diff = Math.abs(snapped - lat);
expect(diff < 0.0001).toBe(true);
```

**Why:** `51.51 % 0.01` returns a tiny nonzero float (e.g. 1e-15) that `Math.round(...* 10000)` amplifies to 100, causing a false failure.

**How to apply:** Any time you write tests for coordinate grid-snapping, use the round-trip approach instead of modulo.
