// ─── GPIO Button Driver ───────────────────────────────────────────────────────
// Linux GPIO button input driver using libgpiod.
//
// Real implementation (physical device required):
//   - Open chip: gpiod_chip_open("/dev/gpiochip0")
//   - Get lines: gpiod_chip_get_line(chip, lineOffset) for each button
//   - Configure: gpiod_line_request_falling_edge_events()
//   - Read events: gpiod_line_event_read(line, &event) [blocking or epoll]
//   - Debounce: software debounce 50 ms on press-down, 20 ms on release
//   - Classify: short press / long press (≥800 ms) / double press / triple press
//   - Close: gpiod_line_release(line); gpiod_chip_close(chip)
//
// Node.js binding options:
//   npm install node-libgpiod    (requires libgpiod-dev on target)
//   child_process: gpioget / gpioset (polling, not interrupt-driven)
//   /sys/class/gpio: legacy interface, deprecated in kernel ≥ 5.x
//
// GPIO line mapping (target: Raspberry Pi CM4 or Jetson Nano):
//   Main button:    GPIO line 17 (physical pin 11)
//   Volume up:      GPIO line 27 (physical pin 13)
//   Volume down:    GPIO line 22 (physical pin 15)
//
// Emergency stop: triple-press main button within 1500 ms.

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GpioButtonId = 'main' | 'volume-up' | 'volume-down';
export type GpioButtonDriverStatus = 'not-initialized' | 'ready' | 'degraded' | 'failed' | 'closed';
export type GpioButtonEventType = 'press-down' | 'press-up' | 'long-press' | 'double-press' | 'triple-press';

export interface GpioButtonEvent {
  buttonId: GpioButtonId;
  eventType: GpioButtonEventType;
  durationMs: number;
  timestampMs: number;
  isSimulated: false;
}

export interface GpioLineMapping {
  buttonId: GpioButtonId;
  lineOffset: number;
  activeLow: boolean;   // true if button connects to GND (typical)
}

export interface GpioButtonConfig {
  gpioChipPath: string;        // e.g. /dev/gpiochip0
  lines: GpioLineMapping[];
  debounceMs: number;          // software debounce window
  longPressThresholdMs: number;
  multiPressWindowMs: number;  // window for double/triple press classification
}

export interface GpioButtonDriverState {
  config: GpioButtonConfig;
  status: GpioButtonDriverStatus;
  pendingEvents: GpioButtonEvent[];
  errorCount: number;
  lastErrorMessage: string | null;
  chipAccessible: boolean;
}

// ─── Default Configuration ────────────────────────────────────────────────────

export function defaultGpioButtonConfig(): GpioButtonConfig {
  return {
    gpioChipPath: '/dev/gpiochip0',
    lines: [
      { buttonId: 'main',        lineOffset: 17, activeLow: true },
      { buttonId: 'volume-up',   lineOffset: 27, activeLow: true },
      { buttonId: 'volume-down', lineOffset: 22, activeLow: true },
    ],
    debounceMs: 50,
    longPressThresholdMs: 800,
    multiPressWindowMs: 1500,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createGpioButtonDriverState(
  config: GpioButtonConfig,
): GpioButtonDriverState {
  const chipAccessible = fs.existsSync(config.gpioChipPath);
  return {
    config,
    status: 'not-initialized',
    pendingEvents: [],
    errorCount: 0,
    lastErrorMessage: null,
    chipAccessible,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

export function initializeGpioButtonDriver(
  state: GpioButtonDriverState,
): { state: GpioButtonDriverState; error: string | null } {
  if (!state.chipAccessible) {
    const error = `GPIO chip not found at ${state.config.gpioChipPath}. ` +
      `Install libgpiod: apt install libgpiod2 libgpiod-dev gpiod. ` +
      `Check: gpiodetect; gpiofind`;
    return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
  }

  // TODO (physical bring-up): gpiod_chip_open + gpiod_line_request_falling_edge_events per line
  const error = `GPIO button driver not yet implemented. ` +
    `Install node-libgpiod: npm install node-libgpiod (requires libgpiod-dev).`;
  return { state: { ...state, status: 'failed', lastErrorMessage: error }, error };
}

// ─── Poll Events ──────────────────────────────────────────────────────────────
// Drain pending events from the event queue (populated by interrupt handler).
// Returns empty array when no events; never blocks.

export function pollGpioEvents(
  state: GpioButtonDriverState,
): { state: GpioButtonDriverState; events: GpioButtonEvent[] } {
  if (state.status !== 'ready') {
    return { state, events: [] };
  }
  // TODO: drain gpiod event queue; apply debounce; classify press type
  const events = [...state.pendingEvents];
  return { state: { ...state, pendingEvents: [] }, events };
}

// ─── Health + Shutdown ────────────────────────────────────────────────────────

export function getGpioButtonHealth(state: GpioButtonDriverState): GpioButtonDriverStatus {
  return state.status;
}

export function shutdownGpioButtonDriver(state: GpioButtonDriverState): GpioButtonDriverState {
  // TODO: gpiod_line_release per line; gpiod_chip_close
  return { ...state, status: 'closed', pendingEvents: [] };
}
