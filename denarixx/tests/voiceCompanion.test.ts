/**
 * Voice Companion tests (V5)
 *
 * Tests VoiceCommandEngine (command parsing) and GuidancePersonalityEngine
 * (message shaping, shouldSpeak, reassurance) with no browser dependencies.
 *
 * Run: npx tsx tests/voiceCompanion.test.ts
 */

import { VoiceCommandEngine } from '../src/engines/voiceCommandEngine';
import type { VoiceCommandType } from '../src/engines/voiceCommandEngine';
import { GuidancePersonalityEngine } from '../src/engines/guidancePersonalityEngine';
import type { GuidancePersonality, PersonalityRiskLevel } from '../src/engines/guidancePersonalityEngine';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect<T>(actual: T) {
  return {
    toBe(expected: T, label: string) {
      if (actual === expected) {
        console.log(`  ✓ ${label}`);
        passed++;
      } else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected: ${JSON.stringify(expected)}`);
        console.error(`    received: ${JSON.stringify(actual)}`);
        failed++;
      }
    },
    toContain(substring: string, label: string) {
      const str = String(actual);
      if (str.includes(substring)) {
        console.log(`  ✓ ${label}`);
        passed++;
      } else {
        console.error(`  ✗ ${label}`);
        console.error(`    expected to contain: ${substring}`);
        console.error(`    received: ${str}`);
        failed++;
      }
    },
    toBeTrue(label: string) {
      this.toBe(true as unknown as T, label);
    },
    toBeFalse(label: string) {
      this.toBe(false as unknown as T, label);
    },
  };
}

function describe(label: string, fn: () => void) {
  console.log(`\n${label}`);
  fn();
}

// ─── VoiceCommandEngine tests ─────────────────────────────────────────────────

describe('VoiceCommandEngine — start/stop commands', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.parse('start session').command).toBe<VoiceCommandType>('start_session', 'parses "start session"');
  expect(engine.parse('begin session').command).toBe<VoiceCommandType>('start_session', 'parses "begin session"');
  expect(engine.parse('start vision').command).toBe<VoiceCommandType>('start_session', 'parses "start vision"');
  expect(engine.parse('start').command).toBe<VoiceCommandType>('start_session', 'parses bare "start"');
  expect(engine.parse('stop session').command).toBe<VoiceCommandType>('stop_session', 'parses "stop session"');
  expect(engine.parse('end session').command).toBe<VoiceCommandType>('stop_session', 'parses "end session"');
  expect(engine.parse('finish session').command).toBe<VoiceCommandType>('stop_session', 'parses "finish session"');
});

describe('VoiceCommandEngine — navigation commands', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.parse('describe surroundings').command).toBe<VoiceCommandType>('describe_surroundings', 'parses "describe surroundings"');
  expect(engine.parse('what is around me').command).toBe<VoiceCommandType>('describe_surroundings', 'parses "what is around me"');
  expect(engine.parse('look around').command).toBe<VoiceCommandType>('describe_surroundings', 'parses "look around"');
  expect(engine.parse('where am i').command).toBe<VoiceCommandType>('where_am_i', 'parses "where am i"');
  expect(engine.parse('where are we').command).toBe<VoiceCommandType>('where_am_i', 'parses "where are we"');
  expect(engine.parse('what is this place').command).toBe<VoiceCommandType>('where_am_i', 'parses "what is this place"');
  expect(engine.parse('what should i do').command).toBe<VoiceCommandType>('what_should_i_do', 'parses "what should i do"');
  expect(engine.parse('help').command).toBe<VoiceCommandType>('what_should_i_do', 'parses "help"');
  expect(engine.parse('guide me').command).toBe<VoiceCommandType>('what_should_i_do', 'parses "guide me"');
});

describe('VoiceCommandEngine — repeat + save + emergency', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.parse('repeat').command).toBe<VoiceCommandType>('repeat_last', 'parses "repeat"');
  expect(engine.parse('repeat that').command).toBe<VoiceCommandType>('repeat_last', 'parses "repeat that"');
  expect(engine.parse('say that again').command).toBe<VoiceCommandType>('repeat_last', 'parses "say that again"');
  expect(engine.parse('what did you say').command).toBe<VoiceCommandType>('repeat_last', 'parses "what did you say"');
  expect(engine.parse('save this place').command).toBe<VoiceCommandType>('save_this_place', 'parses "save this place"');
  expect(engine.parse('remember this').command).toBe<VoiceCommandType>('save_this_place', 'parses "remember this"');
  expect(engine.parse('bookmark this').command).toBe<VoiceCommandType>('save_this_place', 'parses "bookmark this"');
  expect(engine.parse('emergency').command).toBe<VoiceCommandType>('emergency_stop', 'parses "emergency"');
  expect(engine.parse('danger').command).toBe<VoiceCommandType>('emergency_stop', 'parses "danger"');
  expect(engine.parse('abort').command).toBe<VoiceCommandType>('emergency_stop', 'parses "abort"');
});

describe('VoiceCommandEngine — unknown + confidence', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.parse('hello world').command).toBe<VoiceCommandType>('unknown', 'unrecognized → unknown');
  expect(engine.parse('').command).toBe<VoiceCommandType>('unknown', 'empty string → unknown');
  expect(engine.parse('   ').command).toBe<VoiceCommandType>('unknown', 'whitespace only → unknown');
  expect(engine.parse('start session').confidence > 0).toBeTrue('start_session has confidence > 0');
  expect(engine.parse('emergency').confidence > 0.9).toBeTrue('emergency has confidence > 0.9');
  expect(engine.parse('unknown xyz').confidence).toBe(0, 'unknown has confidence 0');
});

describe('VoiceCommandEngine — case + punctuation insensitive', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.parse('START SESSION').command).toBe<VoiceCommandType>('start_session', 'uppercase "START SESSION"');
  expect(engine.parse('Stop Session!').command).toBe<VoiceCommandType>('stop_session', 'mixed-case "Stop Session!"');
  expect(engine.parse('Where am I?').command).toBe<VoiceCommandType>('where_am_i', '"Where am I?" with punctuation');
  expect(engine.parse('  repeat  ').command).toBe<VoiceCommandType>('repeat_last', 'leading/trailing spaces');
});

describe('VoiceCommandEngine — label()', () => {
  const engine = new VoiceCommandEngine();

  expect(engine.label('start_session')).toBe('Start Session', 'label for start_session');
  expect(engine.label('emergency_stop')).toBe('Emergency Stop', 'label for emergency_stop');
  expect(engine.label('unknown')).toBe('Unknown', 'label for unknown');
});

// ─── GuidancePersonalityEngine — shouldSpeak ─────────────────────────────────

describe('GuidancePersonalityEngine — minimal: only critical/high', () => {
  const engine = new GuidancePersonalityEngine();
  const p: GuidancePersonality = 'minimal';

  expect(engine.shouldSpeak('critical', p)).toBeTrue('minimal speaks critical');
  expect(engine.shouldSpeak('high', p)).toBeTrue('minimal speaks high');
  expect(engine.shouldSpeak('medium', p)).toBeFalse('minimal silences medium');
  expect(engine.shouldSpeak('low', p)).toBeFalse('minimal silences low');
  expect(engine.shouldSpeak('none', p)).toBeFalse('minimal silences none');
});

describe('GuidancePersonalityEngine — balanced: medium and above', () => {
  const engine = new GuidancePersonalityEngine();
  const p: GuidancePersonality = 'balanced';

  expect(engine.shouldSpeak('critical', p)).toBeTrue('balanced speaks critical');
  expect(engine.shouldSpeak('high', p)).toBeTrue('balanced speaks high');
  expect(engine.shouldSpeak('medium', p)).toBeTrue('balanced speaks medium');
  expect(engine.shouldSpeak('low', p)).toBeFalse('balanced silences low');
  expect(engine.shouldSpeak('none', p)).toBeFalse('balanced silences none');
});

describe('GuidancePersonalityEngine — detailed: all non-none', () => {
  const engine = new GuidancePersonalityEngine();
  const p: GuidancePersonality = 'detailed';

  expect(engine.shouldSpeak('critical', p)).toBeTrue('detailed speaks critical');
  expect(engine.shouldSpeak('medium', p)).toBeTrue('detailed speaks medium');
  expect(engine.shouldSpeak('low', p)).toBeTrue('detailed speaks low');
  expect(engine.shouldSpeak('none', p)).toBeFalse('detailed silences none');
});

describe('GuidancePersonalityEngine — companion: all non-none', () => {
  const engine = new GuidancePersonalityEngine();
  const p: GuidancePersonality = 'companion';

  expect(engine.shouldSpeak('critical', p)).toBeTrue('companion speaks critical');
  expect(engine.shouldSpeak('low', p)).toBeTrue('companion speaks low');
  expect(engine.shouldSpeak('none', p)).toBeFalse('companion silences none');
});

// ─── GuidancePersonalityEngine — formatMessage ───────────────────────────────

describe('GuidancePersonalityEngine — formatMessage minimal', () => {
  const engine = new GuidancePersonalityEngine();
  const p: GuidancePersonality = 'minimal';
  const msg = 'Stop immediately. A vehicle is approaching at speed.';

  const result = engine.formatMessage(msg, p, 'critical');
  expect(result).toContain('Stop immediately', 'minimal keeps first sentence');
  // Should not contain the second sentence
  const hasBothSentences = result.includes('A vehicle is approaching');
  expect(!hasBothSentences).toBeTrue('minimal strips second sentence');
});

describe('GuidancePersonalityEngine — formatMessage balanced', () => {
  const engine = new GuidancePersonalityEngine();
  const msg = 'Stop immediately. A vehicle is approaching.';
  const result = engine.formatMessage(msg, 'balanced', 'high');
  expect(result).toBe(msg, 'balanced returns message unchanged');
});

describe('GuidancePersonalityEngine — formatMessage companion medium', () => {
  const engine = new GuidancePersonalityEngine();
  const msg = 'Obstacle ahead. Proceed carefully.';
  const result = engine.formatMessage(msg, 'companion', 'medium');
  expect(result).toContain('I can see something', 'companion medium adds warm prefix');
});

describe('GuidancePersonalityEngine — formatMessage companion critical', () => {
  const engine = new GuidancePersonalityEngine();
  const msg = 'Stop immediately!';
  const result = engine.formatMessage(msg, 'companion', 'critical');
  expect(result).toBe(msg, 'companion keeps critical unchanged (no softening)');
});

// ─── GuidancePersonalityEngine — reassurance ─────────────────────────────────

describe('GuidancePersonalityEngine — getReassurance', () => {
  const engine = new GuidancePersonalityEngine();

  const r1 = engine.getReassurance('companion');
  expect(r1.length > 0).toBeTrue('companion returns non-empty reassurance');

  const r2 = engine.getReassurance('companion');
  // Rotation — second call may differ
  expect(typeof r2).toBe('string', 'second call also returns string');

  const rMin = engine.getReassurance('minimal');
  expect(rMin.length > 0).toBeTrue('minimal returns non-empty short message');
});

describe('GuidancePersonalityEngine — shouldReassure', () => {
  const engine = new GuidancePersonalityEngine();

  expect(engine.shouldReassure('companion', 35)).toBeTrue('companion reassures after 35s');
  expect(engine.shouldReassure('companion', 10)).toBeFalse('companion does not reassure after 10s');
  expect(engine.shouldReassure('balanced', 60)).toBeFalse('balanced never reassures');
  expect(engine.shouldReassure('minimal', 60)).toBeFalse('minimal never reassures');
  expect(engine.shouldReassure('detailed', 60)).toBeFalse('detailed never reassures');
});

describe('GuidancePersonalityEngine — reset clears reassurance rotation', () => {
  const engine = new GuidancePersonalityEngine();
  engine.getReassurance('companion'); // advance
  engine.getReassurance('companion'); // advance
  engine.reset();
  const r1 = engine.getReassurance('companion');
  const r2 = engine.getReassurance('companion');
  // r1 should be the first reassurance again; r2 the second
  expect(r1 !== r2).toBeTrue('rotation advances after reset');
});

// ─── GuidancePersonalityEngine — getSilenceReason ────────────────────────────

describe('GuidancePersonalityEngine — getSilenceReason', () => {
  const engine = new GuidancePersonalityEngine();

  const r1 = engine.getSilenceReason('medium' as PersonalityRiskLevel, 'minimal');
  expect(r1.length > 0).toBeTrue('getSilenceReason returns non-empty string for minimal+medium');

  const r2 = engine.getSilenceReason('low' as PersonalityRiskLevel, 'balanced');
  expect(r2.length > 0).toBeTrue('getSilenceReason returns non-empty string for balanced+low');
});

// ─── Results ─────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
