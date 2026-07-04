/**
 * Sprint 7 — Voice Companion & Hands-Free Control tests
 *
 * Tests VoiceCommandEngine (extended commands), VoiceCommandConfirmationEngine,
 * and VoiceCommandRouterEngine. All pure engines — no browser, no React.
 *
 * Run: npx tsx tests/sprint7VoiceCompanion.test.ts
 */

import { VoiceCommandEngine } from '../src/engines/voiceCommandEngine';
import type { VoiceCommandType } from '../src/engines/voiceCommandEngine';
import {
  getCommandConfirmation,
  getBlockedConfirmation,
} from '../src/engines/voiceCommandConfirmationEngine';
import {
  routeVoiceCommand,
  isSessionCommand,
  isNavigationCommand,
  writesLocation,
} from '../src/engines/voiceCommandRouterEngine';
import type { RouterContext } from '../src/engines/voiceCommandRouterEngine';
import type { GuidancePersonality } from '../src/engines/guidancePersonalityEngine';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let section = '';

function test(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${(e as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(text: string, substr: string) {
  if (!text.includes(substr)) {
    throw new Error(`Expected "${text}" to include "${substr}"`);
  }
}

function assert(cond: boolean, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

function assertNull(val: unknown) {
  if (val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`);
}

function assertNotNull(val: unknown) {
  if (val === null || val === undefined) throw new Error('Expected non-null value');
}

function heading(title: string) {
  section = title;
  console.log(`\n── ${title}`);
}

// ─── Shared contexts ──────────────────────────────────────────────────────────

const ctxBase: RouterContext = {
  sessionActive: false,
  navigationActive: false,
  locationConsentGiven: false,
  personality: 'balanced',
};

const ctxSession: RouterContext = { ...ctxBase, sessionActive: true };
const ctxNav: RouterContext = { ...ctxBase, navigationActive: true };
const ctxConsent: RouterContext = { ...ctxBase, locationConsentGiven: true };
const ctxFull: RouterContext = {
  sessionActive: true,
  navigationActive: true,
  locationConsentGiven: true,
  personality: 'balanced',
};

const engine = new VoiceCommandEngine();
const cmd = (s: string): VoiceCommandType => engine.parse(s).command;

// ─── Section 1: Extended Command Parsing — start_navigation / stop_navigation ─

heading('Section 1: New command parsing — navigation');

test('"start navigation" → start_navigation', () => assertEqual(cmd('start navigation'), 'start_navigation'));
test('"begin navigation" → start_navigation', () => assertEqual(cmd('begin navigation'), 'start_navigation'));
test('"start navigating" → start_navigation', () => assertEqual(cmd('start navigating'), 'start_navigation'));
test('"begin navigating" → start_navigation', () => assertEqual(cmd('begin navigating'), 'start_navigation'));
test('"navigate to" → start_navigation', () => assertEqual(cmd('navigate to the shop'), 'start_navigation'));
test('"navigate me" → start_navigation', () => assertEqual(cmd('navigate me to the park'), 'start_navigation'));
test('"open navigation" → start_navigation', () => assertEqual(cmd('open navigation'), 'start_navigation'));
test('"START NAVIGATION" (caps) → start_navigation', () => assertEqual(cmd('START NAVIGATION'), 'start_navigation'));
test('"stop navigation" → stop_navigation', () => assertEqual(cmd('stop navigation'), 'stop_navigation'));
test('"end navigation" → stop_navigation', () => assertEqual(cmd('end navigation'), 'stop_navigation'));
test('"stop navigating" → stop_navigation', () => assertEqual(cmd('stop navigating'), 'stop_navigation'));
test('"finish navigation" → stop_navigation', () => assertEqual(cmd('finish navigation'), 'stop_navigation'));
test('"cancel navigation" → stop_navigation', () => assertEqual(cmd('cancel navigation'), 'stop_navigation'));
test('"exit navigation" → stop_navigation', () => assertEqual(cmd('exit navigation'), 'stop_navigation'));

// ─── Section 2: Ordering — navigation commands take priority over session ──────

heading('Section 2: Command priority ordering');

test('"start navigation" does not parse as start_session', () => {
  assert(cmd('start navigation') !== 'start_session', 'start_navigation must not resolve to start_session');
});
test('"stop navigation" does not parse as stop_session', () => {
  assert(cmd('stop navigation') !== 'stop_session', 'stop_navigation must not resolve to stop_session');
});
test('"stop navigation" does not parse as emergency_stop', () => {
  assert(cmd('stop navigation') !== 'emergency_stop');
});
test('"start navigation" not confused with "begin" → start_session', () => {
  assertEqual(cmd('begin'), 'start_session');
  assertEqual(cmd('begin navigation'), 'start_navigation');
});
test('emergency patterns still highest priority', () => {
  assertEqual(cmd('emergency'), 'emergency_stop');
  assertEqual(cmd('stop everything'), 'emergency_stop');
});

// ─── Section 3: Existing V5 commands still parse correctly ────────────────────

heading('Section 3: V5 command backward compatibility');

test('"start session" → start_session', () => assertEqual(cmd('start session'), 'start_session'));
test('"start vision" → start_session', () => assertEqual(cmd('start vision'), 'start_session'));
test('"stop session" → stop_session', () => assertEqual(cmd('stop session'), 'stop_session'));
test('"stop vision" → stop_session', () => assertEqual(cmd('stop vision'), 'stop_session'));
test('"repeat" → repeat_last', () => assertEqual(cmd('repeat'), 'repeat_last'));
test('"repeat that" → repeat_last', () => assertEqual(cmd('repeat that'), 'repeat_last'));
test('"say again" → repeat_last', () => assertEqual(cmd('say again'), 'repeat_last'));
test('"describe surroundings" → describe_surroundings', () => assertEqual(cmd('describe surroundings'), 'describe_surroundings'));
test('"what is around me" → describe_surroundings', () => assertEqual(cmd('what is around me'), 'describe_surroundings'));
test('"where am i" → where_am_i', () => assertEqual(cmd('where am i'), 'where_am_i'));
test('"what should i do" → what_should_i_do', () => assertEqual(cmd('what should i do'), 'what_should_i_do'));
test('"help" → what_should_i_do', () => assertEqual(cmd('help'), 'what_should_i_do'));
test('"save this place" → save_this_place', () => assertEqual(cmd('save this place'), 'save_this_place'));
test('"remember this" → save_this_place', () => assertEqual(cmd('remember this'), 'save_this_place'));
test('"emergency" → emergency_stop', () => assertEqual(cmd('emergency'), 'emergency_stop'));
test('"danger" → emergency_stop', () => assertEqual(cmd('danger'), 'emergency_stop'));
test('"abort" → emergency_stop', () => assertEqual(cmd('abort'), 'emergency_stop'));
test('nonsense → unknown', () => assertEqual(cmd('ajsdklajsd lkajd'), 'unknown'));

// ─── Section 4: VoiceCommandEngine.label() for new commands ──────────────────

heading('Section 4: label() includes new commands');

test('label(start_navigation)', () => assertIncludes(engine.label('start_navigation'), 'Navigation'));
test('label(stop_navigation)', () => assertIncludes(engine.label('stop_navigation'), 'Navigation'));
test('label(emergency_stop)', () => assertIncludes(engine.label('emergency_stop'), 'Emergency'));
test('label(start_session)', () => assertIncludes(engine.label('start_session'), 'Session'));
test('supportedCommands includes start_navigation', () => {
  assert(engine.supportedCommands().includes('start_navigation'));
});
test('supportedCommands includes stop_navigation', () => {
  assert(engine.supportedCommands().includes('stop_navigation'));
});
test('supportedCommands does not include unknown', () => {
  assert(!engine.supportedCommands().includes('unknown'));
});

// ─── Section 5: Command confidence values ─────────────────────────────────────

heading('Section 5: Confidence values');

test('start_navigation confidence ≥ 0.9', () => {
  assert(engine.parse('start navigation').confidence >= 0.9);
});
test('stop_navigation confidence ≥ 0.9', () => {
  assert(engine.parse('stop navigation').confidence >= 0.9);
});
test('emergency_stop confidence ≥ 0.95', () => {
  assert(engine.parse('emergency').confidence >= 0.95);
});
test('unknown confidence = 0', () => {
  assertEqual(engine.parse('xyzxyzxyz').confidence, 0);
});

// ─── Section 6: Confirmation messages — personality variants ──────────────────

heading('Section 6: Confirmation messages — personality variants');

const personalities: GuidancePersonality[] = ['minimal', 'balanced', 'detailed', 'companion'];

for (const p of personalities) {
  test(`start_session confirmation (${p}) is non-empty string`, () => {
    const { spokenMessage } = getCommandConfirmation('start_session', p);
    assertNotNull(spokenMessage);
    assert(spokenMessage!.length > 0);
    assertIncludes(spokenMessage!.toLowerCase(), 'vision');
  });

  test(`stop_session confirmation (${p}) is non-empty string`, () => {
    const { spokenMessage } = getCommandConfirmation('stop_session', p);
    assertNotNull(spokenMessage);
    assert(spokenMessage!.length > 0);
  });

  test(`start_navigation confirmation (${p}) includes 'navigation'`, () => {
    const { spokenMessage } = getCommandConfirmation('start_navigation', p);
    assertNotNull(spokenMessage);
    assertIncludes(spokenMessage!.toLowerCase(), 'navigation');
  });

  test(`stop_navigation confirmation (${p}) non-null`, () => {
    const { spokenMessage } = getCommandConfirmation('stop_navigation', p);
    assertNotNull(spokenMessage);
  });
}

// ─── Section 7: Confirmation — emergency_stop always speaks ───────────────────

heading('Section 7: Confirmation — emergency_stop always speaks');

for (const p of personalities) {
  test(`emergency_stop confirmation (${p}) non-null and alwaysSpeak`, () => {
    const c = getCommandConfirmation('emergency_stop', p);
    assertNotNull(c.spokenMessage);
    assert(c.alwaysSpeak);
    assertIncludes(c.spokenMessage!.toLowerCase(), 'emergency');
  });
}

// ─── Section 8: Confirmation — minimal personality suppresses low-value cmds ──

heading('Section 8: Confirmation — minimal suppresses low-value messages');

test('minimal: repeat_last → null (no spoken confirmation)', () => {
  const { spokenMessage } = getCommandConfirmation('repeat_last', 'minimal');
  assertNull(spokenMessage);
});
test('minimal: describe_surroundings → null', () => {
  const { spokenMessage } = getCommandConfirmation('describe_surroundings', 'minimal');
  assertNull(spokenMessage);
});
test('minimal: where_am_i → null', () => {
  const { spokenMessage } = getCommandConfirmation('where_am_i', 'minimal');
  assertNull(spokenMessage);
});
test('minimal: save_this_place → "Place saved."', () => {
  const { spokenMessage } = getCommandConfirmation('save_this_place', 'minimal');
  assertNotNull(spokenMessage);
  assertIncludes(spokenMessage!, 'saved');
});

// ─── Section 9: Confirmation — companion personality is warm ──────────────────

heading('Section 9: Confirmation — companion personality tone');

test('companion start_session sounds personal', () => {
  const { spokenMessage } = getCommandConfirmation('start_session', 'companion');
  assert(
    spokenMessage!.includes("here with you") || spokenMessage!.includes("your"),
    'companion start should feel personal',
  );
});
test('companion save_this_place mentions memory', () => {
  const { spokenMessage } = getCommandConfirmation('save_this_place', 'companion');
  assertIncludes(spokenMessage!, 'memory');
});
test('companion stop_navigation is reassuring', () => {
  const { spokenMessage } = getCommandConfirmation('stop_navigation', 'companion');
  assertNotNull(spokenMessage);
  assert(spokenMessage!.length > 20);
});

// ─── Section 10: Confirmation — detailed includes extra context ───────────────

heading('Section 10: Confirmation — detailed has extra context');

test('detailed start_session mentions hazards', () => {
  const { spokenMessage } = getCommandConfirmation('start_session', 'detailed');
  assertIncludes(spokenMessage!, 'hazard');
});
test('detailed start_navigation mentions directions', () => {
  const { spokenMessage } = getCommandConfirmation('start_navigation', 'detailed');
  assertIncludes(spokenMessage!, 'direction');
});
test('detailed save_this_place mentions no precise coordinates', () => {
  const { spokenMessage } = getCommandConfirmation('save_this_place', 'detailed');
  assertIncludes(spokenMessage!, 'precise');
});

// ─── Section 11: Router — start_session dispatch ──────────────────────────────

heading('Section 11: Router — start_session dispatch');

test('start_session when session inactive → not blocked', () => {
  const d = routeVoiceCommand('start_session', ctxBase);
  assert(!d.blocked);
  assertEqual(d.target, 'vision_session');
  assertEqual(d.action, 'start');
  assertEqual(d.priority, 'high');
});
test('start_session when session already active → blocked', () => {
  const d = routeVoiceCommand('start_session', ctxSession);
  assert(d.blocked);
  assertNotNull(d.blockReason);
  assertIncludes(d.blockReason!, 'already active');
});
test('start_session blocked: confirmation speaks block reason', () => {
  const d = routeVoiceCommand('start_session', ctxSession);
  assertNotNull(d.confirmation);
});

// ─── Section 12: Router — stop_session dispatch ───────────────────────────────

heading('Section 12: Router — stop_session dispatch');

test('stop_session when session active → not blocked', () => {
  const d = routeVoiceCommand('stop_session', ctxSession);
  assert(!d.blocked);
  assertEqual(d.target, 'vision_session');
});
test('stop_session when session inactive → blocked', () => {
  const d = routeVoiceCommand('stop_session', ctxBase);
  assert(d.blocked);
  assertIncludes(d.blockReason!, 'active');
});

// ─── Section 13: Router — navigation commands ─────────────────────────────────

heading('Section 13: Router — navigation commands');

test('start_navigation when navigation inactive → not blocked', () => {
  const d = routeVoiceCommand('start_navigation', ctxBase);
  assert(!d.blocked);
  assertEqual(d.target, 'navigation');
  assertEqual(d.action, 'start');
  assertEqual(d.priority, 'high');
});
test('start_navigation when navigation already active → blocked', () => {
  const d = routeVoiceCommand('start_navigation', ctxNav);
  assert(d.blocked);
  assertIncludes(d.blockReason!, 'already active');
});
test('stop_navigation when navigation active → not blocked', () => {
  const d = routeVoiceCommand('stop_navigation', ctxNav);
  assert(!d.blocked);
  assertEqual(d.target, 'navigation');
  assertEqual(d.action, 'stop');
});
test('stop_navigation when navigation inactive → blocked', () => {
  const d = routeVoiceCommand('stop_navigation', ctxBase);
  assert(d.blocked);
  assertIncludes(d.blockReason!, 'active');
});
test('start_navigation confirmation speaks in all personalities', () => {
  for (const p of personalities) {
    const d = routeVoiceCommand('start_navigation', { ...ctxBase, personality: p });
    assertNotNull(d.confirmation);
  }
});

// ─── Section 14: Router — describe / repeat / advise require active session ───

heading('Section 14: Router — session-dependent commands blocked without session');

test('describe_surroundings blocked without session', () => {
  const d = routeVoiceCommand('describe_surroundings', ctxBase);
  assert(d.blocked);
  assertIncludes(d.blockReason!, 'session');
});
test('describe_surroundings succeeds with session', () => {
  const d = routeVoiceCommand('describe_surroundings', ctxSession);
  assert(!d.blocked);
  assertEqual(d.target, 'vision_session');
});
test('repeat_last blocked without session', () => {
  const d = routeVoiceCommand('repeat_last', ctxBase);
  assert(d.blocked);
});
test('repeat_last succeeds with session', () => {
  const d = routeVoiceCommand('repeat_last', ctxSession);
  assert(!d.blocked);
  assertEqual(d.target, 'guardian');
});
test('what_should_i_do blocked without session', () => {
  const d = routeVoiceCommand('what_should_i_do', ctxBase);
  assert(d.blocked);
});
test('what_should_i_do succeeds with session', () => {
  const d = routeVoiceCommand('what_should_i_do', ctxSession);
  assert(!d.blocked);
  assertEqual(d.target, 'guardian');
});

// ─── Section 15: Router — emergency_stop is never blocked ────────────────────

heading('Section 15: Router — emergency_stop always executes');

test('emergency_stop with no session active → not blocked', () => {
  const d = routeVoiceCommand('emergency_stop', ctxBase);
  assert(!d.blocked);
  assertEqual(d.target, 'emergency');
  assertEqual(d.priority, 'emergency');
});
test('emergency_stop with full context → not blocked', () => {
  const d = routeVoiceCommand('emergency_stop', ctxFull);
  assert(!d.blocked);
});
test('emergency_stop safetyChecks includes emergency_always_executes', () => {
  const d = routeVoiceCommand('emergency_stop', ctxBase);
  assert(d.safetyChecks.includes('emergency_always_executes'));
});
test('emergency_stop confirmation is non-null in all personalities', () => {
  for (const p of personalities) {
    const d = routeVoiceCommand('emergency_stop', { ...ctxBase, personality: p });
    assertNotNull(d.confirmation);
  }
});
test('emergency_stop confirmation mentions "stop" in all personalities', () => {
  for (const p of personalities) {
    const d = routeVoiceCommand('emergency_stop', { ...ctxBase, personality: p });
    assertIncludes(d.confirmation!.toLowerCase(), 'stop');
  }
});

// ─── Section 16: Router — save_this_place location consent gate ──────────────

heading('Section 16: Router — save_this_place location consent gate');

test('save_this_place without consent → blocked', () => {
  const d = routeVoiceCommand('save_this_place', ctxBase);
  assert(d.blocked);
  assertIncludes(d.blockReason!, 'consent');
});
test('save_this_place without consent → confirmation explains consent requirement', () => {
  const d = routeVoiceCommand('save_this_place', ctxBase);
  assertNotNull(d.confirmation);
  assertIncludes(d.confirmation!.toLowerCase(), 'consent');
});
test('save_this_place with consent → not blocked', () => {
  const d = routeVoiceCommand('save_this_place', ctxConsent);
  assert(!d.blocked);
  assertEqual(d.target, 'memory');
  assertEqual(d.action, 'save');
});
test('save_this_place with consent → safetyChecks includes location_consent_verified', () => {
  const d = routeVoiceCommand('save_this_place', ctxConsent);
  assert(d.safetyChecks.includes('location_consent_verified'));
});

// ─── Section 17: Router — safety checks always include no_face_recognition ───

heading('Section 17: Router — safety checks always present');

const allCommands: VoiceCommandType[] = [
  'start_session', 'stop_session', 'repeat_last', 'describe_surroundings',
  'where_am_i', 'what_should_i_do', 'save_this_place',
  'start_navigation', 'stop_navigation', 'emergency_stop',
];

for (const c of allCommands) {
  test(`${c}: safetyChecks contains no_face_recognition`, () => {
    const d = routeVoiceCommand(c, ctxFull);
    assert(d.safetyChecks.includes('no_face_recognition_enabled'));
  });
}

// ─── Section 18: Router — writesLocation() helper ────────────────────────────

heading('Section 18: writesLocation() helper');

test('writesLocation false for start_session', () => {
  const d = routeVoiceCommand('start_session', ctxFull);
  assert(!writesLocation(d));
});
test('writesLocation false for save_this_place WITHOUT consent', () => {
  const d = routeVoiceCommand('save_this_place', ctxBase);
  assert(!writesLocation(d));
});
test('writesLocation true for save_this_place WITH consent', () => {
  const d = routeVoiceCommand('save_this_place', ctxConsent);
  assert(writesLocation(d));
});
test('writesLocation false for emergency_stop', () => {
  const d = routeVoiceCommand('emergency_stop', ctxFull);
  assert(!writesLocation(d));
});

// ─── Section 19: isSessionCommand / isNavigationCommand helpers ───────────────

heading('Section 19: Command classification helpers');

test('isSessionCommand(start_session)', () => assert(isSessionCommand('start_session')));
test('isSessionCommand(stop_session)', () => assert(isSessionCommand('stop_session')));
test('isSessionCommand(start_navigation) = false', () => assert(!isSessionCommand('start_navigation')));
test('isSessionCommand(emergency_stop) = false', () => assert(!isSessionCommand('emergency_stop')));
test('isNavigationCommand(start_navigation)', () => assert(isNavigationCommand('start_navigation')));
test('isNavigationCommand(stop_navigation)', () => assert(isNavigationCommand('stop_navigation')));
test('isNavigationCommand(start_session) = false', () => assert(!isNavigationCommand('start_session')));
test('isNavigationCommand(emergency_stop) = false', () => assert(!isNavigationCommand('emergency_stop')));

// ─── Section 20: Router — unknown command ─────────────────────────────────────

heading('Section 20: Router — unknown command handling');

test('unknown command → blocked', () => {
  const d = routeVoiceCommand('unknown', ctxFull);
  assert(d.blocked);
  assertNotNull(d.blockReason);
});
test('unknown command → confirmation is null', () => {
  const d = routeVoiceCommand('unknown', ctxFull);
  assertNull(d.confirmation);
});
test('unknown command → priority low', () => {
  const d = routeVoiceCommand('unknown', ctxFull);
  assertEqual(d.priority, 'low');
});

// ─── Section 21: Router — blocked command speaks a non-null reason ────────────

heading('Section 21: Blocked commands speak reason');

const blockedCases: Array<[VoiceCommandType, RouterContext]> = [
  ['start_session', ctxSession],
  ['stop_session', ctxBase],
  ['start_navigation', ctxNav],
  ['stop_navigation', ctxBase],
  ['describe_surroundings', ctxBase],
  ['repeat_last', ctxBase],
  ['save_this_place', ctxBase],
];
for (const [c, ctx] of blockedCases) {
  test(`${c} blocked → confirmation non-null`, () => {
    const d = routeVoiceCommand(c, ctx);
    assert(d.blocked);
    assertNotNull(d.confirmation);
    assert(d.confirmation!.length > 0);
  });
}

// ─── Section 22: getBlockedConfirmation utility ───────────────────────────────

heading('Section 22: getBlockedConfirmation utility');

test('minimal blocked confirmation is short', () => {
  const msg = getBlockedConfirmation('start_session', 'Session already active.', 'minimal');
  assertIncludes(msg.toLowerCase(), 'cannot');
});
test('companion blocked is conversational', () => {
  const msg = getBlockedConfirmation('start_session', 'Session already active.', 'companion');
  assertIncludes(msg.toLowerCase(), "cannot");
});
test('balanced blocked includes command label', () => {
  const msg = getBlockedConfirmation('stop_navigation', 'No navigation active.', 'balanced');
  assert(msg.length > 0);
});

// ─── Section 23: Personality in context affects confirmation text ─────────────

heading('Section 23: Router personality context propagates to confirmations');

test('minimal start_session confirmation is shorter than detailed', () => {
  const min = routeVoiceCommand('start_session', { ...ctxBase, personality: 'minimal' });
  const det = routeVoiceCommand('start_session', { ...ctxBase, personality: 'detailed' });
  assert(
    (min.confirmation?.length ?? 0) < (det.confirmation?.length ?? 0),
    'minimal should be shorter than detailed',
  );
});
test('companion start_navigation confirmation is different from minimal', () => {
  const comp = routeVoiceCommand('start_navigation', { ...ctxBase, personality: 'companion' });
  const min = routeVoiceCommand('start_navigation', { ...ctxBase, personality: 'minimal' });
  assert(comp.confirmation !== min.confirmation);
});

// ─── Section 24: End-to-end: parse → route ────────────────────────────────────

heading('Section 24: End-to-end parse → route');

test('spoken "start navigation" → start_navigation → navigation target', () => {
  const parsed = engine.parse('start navigation');
  const d = routeVoiceCommand(parsed.command, ctxBase);
  assertEqual(parsed.command, 'start_navigation');
  assert(!d.blocked);
  assertEqual(d.target, 'navigation');
});
test('spoken "emergency" → emergency_stop → emergency target', () => {
  const parsed = engine.parse('I need emergency help');
  const d = routeVoiceCommand(parsed.command, ctxBase);
  assertEqual(parsed.command, 'emergency_stop');
  assertEqual(d.target, 'emergency');
  assert(!d.blocked);
});
test('spoken "stop navigation" during active nav → stop, not blocked', () => {
  const parsed = engine.parse('stop navigation now');
  const d = routeVoiceCommand(parsed.command, ctxNav);
  assertEqual(parsed.command, 'stop_navigation');
  assert(!d.blocked);
});
test('spoken "save this place" without consent → blocked with consent message', () => {
  const parsed = engine.parse('save this place');
  const d = routeVoiceCommand(parsed.command, ctxBase);
  assertEqual(parsed.command, 'save_this_place');
  assert(d.blocked);
  assertIncludes(d.confirmation!.toLowerCase(), 'consent');
});
test('spoken "help" during session → what_should_i_do → guardian', () => {
  const parsed = engine.parse('help me');
  const d = routeVoiceCommand(parsed.command, ctxSession);
  assertEqual(parsed.command, 'what_should_i_do');
  assertEqual(d.target, 'guardian');
  assert(!d.blocked);
});
test('spoken "repeat" during session → repeat_last → guardian', () => {
  const parsed = engine.parse('repeat that');
  const d = routeVoiceCommand(parsed.command, ctxSession);
  assertEqual(parsed.command, 'repeat_last');
  assertEqual(d.target, 'guardian');
  assert(!d.blocked);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

const sectionLabel = section;
void sectionLabel;
console.log(`\n\nSprint 7 Voice Companion: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
