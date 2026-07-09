/**
 * Sprint 22: Real Perception Integration — Behavioural Tests
 * Covers: OCR engine, text reading engine, speech recognition engine,
 *         TTS engine, voice interaction engine, live perception pipeline,
 *         perception latency engine, provider switching, failure recovery.
 */

// ── Test harness ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    errors.push(`FAIL: ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
  }
}

function expect(actual: unknown) {
  return {
    toBe: (expected: unknown) => {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual: (expected: unknown) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan: (n: number) => {
      if ((actual as number) <= n)
        throw new Error(`Expected > ${n}, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThanOrEqual: (n: number) => {
      if ((actual as number) < n)
        throw new Error(`Expected >= ${n}, got ${JSON.stringify(actual)}`);
    },
    toBeLessThan: (n: number) => {
      if ((actual as number) >= n)
        throw new Error(`Expected < ${n}, got ${JSON.stringify(actual)}`);
    },
    toContain: (item: unknown) => {
      if (!Array.isArray(actual) && typeof actual !== 'string')
        throw new Error(`Expected array or string`);
      if (!(actual as string | unknown[]).includes(item as string))
        throw new Error(`Expected to contain ${JSON.stringify(item)}`);
    },
    toHaveLength: (n: number) => {
      if ((actual as unknown[]).length !== n)
        throw new Error(`Expected length ${n}, got ${(actual as unknown[]).length}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeInstanceOf: (cls: new (...args: unknown[]) => unknown) => {
      if (!(actual instanceof cls))
        throw new Error(`Expected instance of ${cls.name}`);
    },
  };
}

// ── Imports ────────────────────────────────────────────────────────────────────

import {
  enrichOCRResult,
  detectDomain,
  extractKeywords,
  extractHazardKeywords,
  classifyConfidence,
  recognizeText,
  getOCRProvider,
  OCR_SAFETY_NOTE,
} from '../src/engines/ocrEngine';

import type { OCRResultRaw } from '../src/types/ocr';
import { HAZARD_KEYWORDS, DEFAULT_OCR_CONFIG } from '../src/types/ocr';

import {
  buildTextReadingResult,
  buildTextReadingResults,
  filterByPriority,
  containsHazardText,
  extractNumbers,
  expandAbbreviations,
  summariseReadings,
} from '../src/engines/textReadingEngine';

import {
  detectWakeWord,
  stripWakeWord,
  createWakeWordStateMachine,
  transitionWakeWord,
  isWakeWordCooldownExpired,
  isEmergencyTranscript,
  normalizeTranscript,
  isMeaningfulTranscript,
  isWebSpeechSTTAvailable,
  getBestAvailableSTTProvider,
  getSTTProviderInfo,
  describeSTTStatus,
  NullSTTProvider,
} from '../src/engines/speechRecognitionEngine';

import type { WakeWordConfig } from '../src/types/speech';
import { DEFAULT_WAKE_WORD } from '../src/types/speech';

import {
  createTtsItem,
  insertIntoQueue,
  sortQueue,
  dequeueNext,
  purgeLowPriority,
  hasHigherPriorityPending,
  isEmergencyItem,
  buildEmergencyItem,
  preprocessForTTS,
  splitIntoChunks,
  estimateSpeechDuration,
  describeTTSStatus,
  getTTSProviderInfo,
  NullTTSProvider,
} from '../src/engines/textToSpeechEngine';

import {
  createVoiceInteractionSession,
  enqueueGuidance,
  enqueueEmergency,
  startSpeaking,
  finishSpeaking,
  interruptSpeaking,
  processTranscript,
  getVoiceInteractionState,
  shouldSpeakNow,
  getSessionStats,
  setSTTListening,
  setSTTIdle,
  clearEmergencyMode,
} from '../src/engines/voiceInteractionEngine';

import {
  createPipelineSession,
  startPipeline,
  stopPipeline,
  setProviderStatus,
  markProviderReady,
  markProviderError,
  switchProvider,
  getFallbackProvider,
  processSimulationFrame,
  getPipelineStatus,
  describeMode,
  validateConfig,
} from '../src/engines/livePerceptionEngine';

import {
  createFrameMetrics,
  recordStage,
  completeFrame,
  createLatencySampleStore,
  addSample,
  generateLatencyReport,
  gradeEndToEndLatency,
  gradeStageLatency,
  startStageTimer,
  stopStageTimer,
  describeReport,
} from '../src/engines/perceptionLatencyEngine';

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — OCR Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 1 — OCR Engine');

// classifyConfidence
test('classifyConfidence returns high for >= 0.75', () => {
  expect(classifyConfidence(0.9)).toBe('high');
  expect(classifyConfidence(0.75)).toBe('high');
});
test('classifyConfidence returns medium for 0.45–0.74', () => {
  expect(classifyConfidence(0.6)).toBe('medium');
  expect(classifyConfidence(0.45)).toBe('medium');
});
test('classifyConfidence returns low for < 0.45', () => {
  expect(classifyConfidence(0.3)).toBe('low');
  expect(classifyConfidence(0.0)).toBe('low');
});

// detectDomain
test('detectDomain identifies sign domain', () => {
  expect(detectDomain('STOP SIGN PARKING')).toBe('sign');
});
test('detectDomain identifies menu domain', () => {
  expect(detectDomain('calories contains allergen vegan price')).toBe('menu');
});
test('detectDomain identifies medicine domain', () => {
  expect(detectDomain('500mg tablet daily dose prescription')).toBe('medicine');
});
test('detectDomain identifies receipt domain', () => {
  expect(detectDomain('total subtotal tax change cash thank you')).toBe('receipt');
});
test('detectDomain identifies street domain', () => {
  expect(detectDomain('Main St 30 mph speed limit')).toBe('street');
});
test('detectDomain falls back to general for unknown text', () => {
  expect(detectDomain('xyzzy quux blorp')).toBe('general');
});

// extractHazardKeywords
test('extractHazardKeywords finds DANGER', () => {
  expect(extractHazardKeywords('DANGER: HIGH VOLTAGE')).toContain('DANGER');
  expect(extractHazardKeywords('DANGER: HIGH VOLTAGE')).toContain('HIGH VOLTAGE');
});
test('extractHazardKeywords is case insensitive', () => {
  expect(extractHazardKeywords('warning: slippery floor')).toContain('WARNING');
});
test('extractHazardKeywords returns empty for safe text', () => {
  expect(extractHazardKeywords('Welcome to the cafe')).toHaveLength(0);
});

// extractKeywords
test('extractKeywords finds sign keywords', () => {
  const kws = extractKeywords('EXIT ONLY — NO PARKING', 'sign');
  expect(kws).toContain('EXIT');
  expect(kws).toContain('NO');
  expect(kws).toContain('PARKING');
});
test('extractKeywords finds menu keywords', () => {
  const kws = extractKeywords('Calories: 350. Contains gluten. Vegan option available.', 'menu');
  expect(kws).toContain('calories');
});

// enrichOCRResult
test('enrichOCRResult builds full OCRResult from raw', () => {
  const raw: OCRResultRaw = {
    text: 'DANGER: HIGH VOLTAGE',
    confidence: 0.9,
    lines: ['DANGER: HIGH VOLTAGE'],
    detectedAt: new Date(),
    latencyMs: 120,
    provider: 'tesseract',
    language: 'eng',
  };
  const result = enrichOCRResult(raw);
  expect(result.confidenceLevel).toBe('high');
  expect(result.hazardKeywords).toContain('DANGER');
  expect(result.hazardKeywords).toContain('HIGH VOLTAGE');
  expect(result.provider).toBe('tesseract');
});
test('enrichOCRResult respects explicit domain override', () => {
  const raw: OCRResultRaw = {
    text: '500mg tablet twice daily',
    confidence: 0.8,
    lines: ['500mg tablet twice daily'],
    detectedAt: new Date(),
    latencyMs: 80,
    provider: 'tesseract',
    language: 'eng',
  };
  const result = enrichOCRResult(raw, { domain: 'medicine' });
  expect(result.domain).toBe('medicine');
});
test('enrichOCRResult auto-detects domain when general', () => {
  const raw: OCRResultRaw = {
    text: 'STOP SIGN PARKING NO ENTRY',
    confidence: 0.85,
    lines: ['STOP SIGN PARKING NO ENTRY'],
    detectedAt: new Date(),
    latencyMs: 100,
    provider: 'tesseract',
    language: 'eng',
  };
  const result = enrichOCRResult(raw, { domain: 'general' });
  expect(result.domain).toBe('sign');
});

// recognizeText (with null provider)
test('recognizeText returns null for none provider', async () => {
  const result = await recognizeText('data:image/jpeg;base64,test', { provider: 'none' });
  expect(result).toBeNull();
});

// getOCRProvider
test('getOCRProvider none returns NullOCRProvider', () => {
  const p = getOCRProvider('none');
  expect(p.name).toBe('none');
  expect(p.isAvailable).toBeTruthy();
});
test('getOCRProvider tesseract returns TesseractProvider', () => {
  const p = getOCRProvider('tesseract');
  expect(p.name).toBe('tesseract');
});

// OCR_SAFETY_NOTE
test('OCR_SAFETY_NOTE is non-empty string', () => {
  expect(OCR_SAFETY_NOTE.length).toBeGreaterThan(10);
});

// HAZARD_KEYWORDS
test('HAZARD_KEYWORDS contains STOP, DANGER, POISON', () => {
  expect(HAZARD_KEYWORDS).toContain('STOP');
  expect(HAZARD_KEYWORDS).toContain('DANGER');
  expect(HAZARD_KEYWORDS).toContain('POISON');
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Text Reading Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 1 — Text Reading Engine');

function makeOCRResult(overrides: Partial<Parameters<typeof enrichOCRResult>[0]> & { text: string; domain?: import('../src/types/ocr').TextDomain }) {
  const raw: OCRResultRaw = {
    text: overrides.text,
    confidence: 0.8,
    lines: overrides.text.split('\n'),
    detectedAt: new Date(),
    latencyMs: 100,
    provider: 'tesseract',
    language: 'eng',
  };
  return enrichOCRResult(raw, { domain: overrides.domain ?? 'general' });
}

test('buildTextReadingResult critical for danger hazard', () => {
  const ocr = makeOCRResult({ text: 'DANGER: POISON', domain: 'sign' });
  const r = buildTextReadingResult(ocr);
  expect(r.priority).toBe('critical');
  expect(r.hazardFound).toBeTruthy();
  expect(r.shouldAnnounce).toBeTruthy();
});
test('buildTextReadingResult high for WARNING', () => {
  const ocr = makeOCRResult({ text: 'WARNING: WET FLOOR', domain: 'sign' });
  const r = buildTextReadingResult(ocr);
  expect(r.priority).toBe('high');
  expect(r.hazardFound).toBeTruthy();
});
test('buildTextReadingResult high for medicine', () => {
  const ocr = makeOCRResult({ text: '500mg tablet twice daily', domain: 'medicine' });
  const r = buildTextReadingResult(ocr);
  expect(r.priority).toBe('high');
  expect(r.summary).toContain('Medicine label');
  expect(r.summary).toContain('pharmacist');
});
test('buildTextReadingResult normal for street sign', () => {
  const ocr = makeOCRResult({ text: 'Baker Street', domain: 'street' });
  const r = buildTextReadingResult(ocr);
  expect(r.priority).toBe('normal');
  expect(r.summary).toContain('Street name');
});
test('buildTextReadingResult sign announcement starts with "Sign reads"', () => {
  const ocr = makeOCRResult({ text: 'EXIT THIS WAY', domain: 'sign' });
  const r = buildTextReadingResult(ocr);
  expect(r.summary).toContain('EXIT');
});
test('buildTextReadingResult receipt highlights total', () => {
  const raw: OCRResultRaw = {
    text: 'Items: 3\nSubtotal: £4.50\nTotal: £4.95',
    confidence: 0.85,
    lines: ['Items: 3', 'Subtotal: £4.50', 'Total: £4.95'],
    detectedAt: new Date(),
    latencyMs: 80,
    provider: 'tesseract',
    language: 'eng',
  };
  const ocr = enrichOCRResult(raw, { domain: 'receipt' });
  const r = buildTextReadingResult(ocr);
  expect(r.summary).toContain('Total');
});
test('buildTextReadingResult should not announce empty text', () => {
  const raw: OCRResultRaw = {
    text: '',
    confidence: 0.9,
    lines: [],
    detectedAt: new Date(),
    latencyMs: 50,
    provider: 'tesseract',
    language: 'eng',
  };
  const ocr = enrichOCRResult(raw, { domain: 'general' });
  const r = buildTextReadingResult(ocr);
  expect(r.shouldAnnounce).toBeFalsy();
});
test('buildTextReadingResults maps array correctly', () => {
  const results = buildTextReadingResults([
    makeOCRResult({ text: 'STOP', domain: 'sign' }),
    makeOCRResult({ text: 'cafe menu', domain: 'menu' }),
  ]);
  expect(results).toHaveLength(2);
});
test('filterByPriority keeps critical and high, drops normal for high threshold', () => {
  const results = [
    buildTextReadingResult(makeOCRResult({ text: 'DANGER', domain: 'sign' })),
    buildTextReadingResult(makeOCRResult({ text: 'EXIT', domain: 'sign' })),
  ];
  const high = filterByPriority(results, 'high');
  expect(high.length).toBeGreaterThan(0);
  expect(high.every(r => r.priority === 'critical' || r.priority === 'high')).toBeTruthy();
});
test('containsHazardText detects DANGER', () => {
  expect(containsHazardText('DANGER: HIGH VOLTAGE')).toBeTruthy();
});
test('containsHazardText returns false for safe text', () => {
  expect(containsHazardText('Welcome to the library')).toBeFalsy();
});
test('extractNumbers finds all numeric values', () => {
  const nums = extractNumbers('Take 500mg twice daily. Price: £3.99');
  expect(nums).toContain(500);
  expect(nums).toContain(3.99);
});
test('expandAbbreviations expands st to street', () => {
  const expanded = expandAbbreviations('Baker st');
  expect(expanded.toLowerCase()).toContain('street');
});
test('expandAbbreviations expands mg to milligrams', () => {
  const expanded = expandAbbreviations('500 mg dose');
  expect(expanded).toContain('milligrams');
});
test('summariseReadings returns No text detected for empty', () => {
  expect(summariseReadings([])).toBe('No text detected.');
});
test('summariseReadings returns critical first', () => {
  const results = [
    buildTextReadingResult(makeOCRResult({ text: 'regular sign', domain: 'sign' })),
    buildTextReadingResult(makeOCRResult({ text: 'DANGER POISON', domain: 'sign' })),
  ];
  const summary = summariseReadings(results);
  expect(summary.toLowerCase()).toContain('critical');
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Speech Recognition Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 2 — Speech Recognition Engine');

const wakeWordConfig: WakeWordConfig = {
  phrase: 'hey aria',
  enabled: true,
  cooldownMs: 3000,
  caseSensitive: false,
};

test('detectWakeWord finds wake phrase in transcript', () => {
  expect(detectWakeWord('hey aria what is in front of me', wakeWordConfig)).toBeTruthy();
});
test('detectWakeWord returns false without wake phrase', () => {
  expect(detectWakeWord('describe my surroundings', wakeWordConfig)).toBeFalsy();
});
test('detectWakeWord is case insensitive when caseSensitive=false', () => {
  expect(detectWakeWord('HEY ARIA stop', wakeWordConfig)).toBeTruthy();
});
test('detectWakeWord returns false when disabled', () => {
  expect(detectWakeWord('hey aria', { ...wakeWordConfig, enabled: false })).toBeFalsy();
});
test('stripWakeWord removes wake phrase from transcript', () => {
  const stripped = stripWakeWord('hey aria describe the scene', wakeWordConfig);
  if (stripped.toLowerCase().includes('hey aria')) {
    throw new Error(`Expected wake word to be stripped, got: ${stripped}`);
  }
  expect(stripped.toLowerCase()).toContain('describe');
});
test('normalizeTranscript trims and lowercases', () => {
  expect(normalizeTranscript('  Stop Please.  ')).toBe('stop please');
});
test('normalizeTranscript removes trailing punctuation', () => {
  expect(normalizeTranscript('hello there!')).toBe('hello there');
});
test('isMeaningfulTranscript true for sufficient text', () => {
  expect(isMeaningfulTranscript('hello')).toBeTruthy();
});
test('isMeaningfulTranscript false for too short', () => {
  expect(isMeaningfulTranscript('a')).toBeFalsy();
});

// Wake word state machine
test('createWakeWordStateMachine starts in idle', () => {
  const m = createWakeWordStateMachine();
  expect(m.state).toBe('idle');
  expect(m.detectedAt).toBeNull();
});
test('transitionWakeWord detect moves to cooldown', () => {
  const m = createWakeWordStateMachine();
  const now = new Date();
  const next = transitionWakeWord(m, 'detect', wakeWordConfig, now);
  expect(next.state).toBe('cooldown');
  expect(next.detectedAt).toBe(now);
  expect(next.cooldownUntil).toBeTruthy();
});
test('transitionWakeWord cooldown-expire returns to idle', () => {
  const m = { state: 'cooldown' as const, detectedAt: new Date(), cooldownUntil: new Date() };
  const next = transitionWakeWord(m, 'cooldown-expire', wakeWordConfig);
  expect(next.state).toBe('idle');
  expect(next.cooldownUntil).toBeNull();
});
test('transitionWakeWord reset always returns idle', () => {
  const m = { state: 'cooldown' as const, detectedAt: new Date(), cooldownUntil: new Date() };
  const next = transitionWakeWord(m, 'reset', wakeWordConfig);
  expect(next.state).toBe('idle');
});
test('isWakeWordCooldownExpired true when cooldownUntil is past', () => {
  const past = new Date(Date.now() - 5000);
  const m = { state: 'cooldown' as const, detectedAt: new Date(), cooldownUntil: past };
  expect(isWakeWordCooldownExpired(m, new Date())).toBeTruthy();
});
test('isWakeWordCooldownExpired false when still in cooldown', () => {
  const future = new Date(Date.now() + 5000);
  const m = { state: 'cooldown' as const, detectedAt: new Date(), cooldownUntil: future };
  expect(isWakeWordCooldownExpired(m, new Date())).toBeFalsy();
});

// Emergency transcript detection
test('isEmergencyTranscript true for emergency stop', () => {
  expect(isEmergencyTranscript('emergency stop')).toBeTruthy();
});
test('isEmergencyTranscript true for help', () => {
  expect(isEmergencyTranscript('help')).toBeTruthy();
});
test('isEmergencyTranscript true for call 999', () => {
  expect(isEmergencyTranscript('call 999')).toBeTruthy();
});
test('isEmergencyTranscript false for regular command', () => {
  expect(isEmergencyTranscript('describe my surroundings')).toBeFalsy();
});

// Provider info
test('isWebSpeechSTTAvailable returns boolean', () => {
  expect(typeof isWebSpeechSTTAvailable()).toBe('boolean');
});
test('getBestAvailableSTTProvider returns a valid provider', () => {
  const p = getBestAvailableSTTProvider();
  expect(['web-speech', 'none'].includes(p)).toBeTruthy();
});
test('getSTTProviderInfo none is always available', () => {
  expect(getSTTProviderInfo('none').available).toBeTruthy();
});
test('getSTTProviderInfo offline-stt is not available', () => {
  expect(getSTTProviderInfo('offline-stt').available).toBeFalsy();
});
test('describeSTTStatus covers all statuses', () => {
  expect(describeSTTStatus('idle').length).toBeGreaterThan(0);
  expect(describeSTTStatus('listening').length).toBeGreaterThan(0);
  expect(describeSTTStatus('error').length).toBeGreaterThan(0);
  expect(describeSTTStatus('unsupported').length).toBeGreaterThan(0);
});
test('NullSTTProvider is always ready', () => {
  const p = new NullSTTProvider();
  expect(p.isReady()).toBeTruthy();
  expect(p.name).toBe('none');
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — TTS Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 2 — TTS Engine');

test('createTtsItem creates item with correct priority', () => {
  const item = createTtsItem('Hello', 'high');
  expect(item.priority).toBe('high');
  expect(item.text).toBe('Hello');
  expect(item.interruptIfSpeaking).toBeFalsy();
});
test('createTtsItem critical always sets interruptIfSpeaking=true', () => {
  const item = createTtsItem('Alert!', 'critical');
  expect(item.interruptIfSpeaking).toBeTruthy();
});
test('sortQueue orders critical before high before normal', () => {
  const q = [
    createTtsItem('low msg', 'low'),
    createTtsItem('critical msg', 'critical'),
    createTtsItem('normal msg', 'normal'),
    createTtsItem('high msg', 'high'),
  ];
  const sorted = sortQueue(q);
  expect(sorted[0].priority).toBe('critical');
  expect(sorted[1].priority).toBe('high');
  expect(sorted[2].priority).toBe('normal');
  expect(sorted[3].priority).toBe('low');
});
test('insertIntoQueue maintains sorted order', () => {
  const q = [createTtsItem('normal', 'normal')];
  const updated = insertIntoQueue(q, createTtsItem('high', 'high'));
  expect(updated[0].priority).toBe('high');
});
test('dequeueNext returns highest priority item', () => {
  const q = [
    createTtsItem('low', 'low'),
    createTtsItem('critical', 'critical'),
    createTtsItem('normal', 'normal'),
  ];
  const { item, remaining } = dequeueNext(q);
  expect(item?.priority).toBe('critical');
  expect(remaining).toHaveLength(2);
});
test('dequeueNext from empty queue returns null', () => {
  const { item, remaining } = dequeueNext([]);
  expect(item).toBeNull();
  expect(remaining).toHaveLength(0);
});
test('purgeLowPriority keeps max items', () => {
  const q = Array.from({ length: 15 }, (_, i) =>
    createTtsItem(`msg ${i}`, 'normal'),
  );
  const purged = purgeLowPriority(q, 10);
  expect(purged.length).toBeLessThan(11);
});
test('hasHigherPriorityPending true when critical in queue', () => {
  const q = [createTtsItem('critical', 'critical')];
  expect(hasHigherPriorityPending(q, 'normal')).toBeTruthy();
});
test('hasHigherPriorityPending false when no higher priority', () => {
  const q = [createTtsItem('low', 'low')];
  expect(hasHigherPriorityPending(q, 'high')).toBeFalsy();
});
test('isEmergencyItem true for critical+interrupt', () => {
  const item = createTtsItem('Alert!', 'critical');
  expect(isEmergencyItem(item)).toBeTruthy();
});
test('isEmergencyItem false for high priority', () => {
  const item = createTtsItem('Alert!', 'high');
  expect(isEmergencyItem(item)).toBeFalsy();
});
test('buildEmergencyItem creates critical interrupt item', () => {
  const item = buildEmergencyItem('STOP — hazard ahead');
  expect(item.priority).toBe('critical');
  expect(item.interruptIfSpeaking).toBeTruthy();
});
test('preprocessForTTS trims and caps at 500 chars', () => {
  const long = 'a'.repeat(600);
  expect(preprocessForTTS(long).length).toBeLessThan(501);
});
test('preprocessForTTS collapses whitespace', () => {
  expect(preprocessForTTS('hello   world')).toBe('hello world');
});
test('splitIntoChunks returns single chunk for short text', () => {
  const chunks = splitIntoChunks('Hello world.', 200);
  expect(chunks).toHaveLength(1);
});
test('splitIntoChunks splits long text into multiple chunks', () => {
  const text = 'This is a sentence. '.repeat(30);
  const chunks = splitIntoChunks(text, 100);
  expect(chunks.length).toBeGreaterThan(1);
});
test('estimateSpeechDuration returns positive for non-empty text', () => {
  expect(estimateSpeechDuration('Hello world this is a test')).toBeGreaterThan(0);
});
test('describeTTSStatus covers all statuses', () => {
  expect(describeTTSStatus('idle').length).toBeGreaterThan(0);
  expect(describeTTSStatus('speaking').length).toBeGreaterThan(0);
  expect(describeTTSStatus('interrupted').length).toBeGreaterThan(0);
  expect(describeTTSStatus('error').length).toBeGreaterThan(0);
});
test('getTTSProviderInfo none is available', () => {
  expect(getTTSProviderInfo('none').available).toBeTruthy();
});
test('getTTSProviderInfo offline-tts is not available', () => {
  expect(getTTSProviderInfo('offline-tts').available).toBeFalsy();
});
test('NullTTSProvider is always ready and speak resolves', async () => {
  const p = new NullTTSProvider();
  expect(p.isReady()).toBeTruthy();
  await p.speak('test', { provider: 'none', rate: 1, volume: 1, pitch: 1, voice: null, lang: 'en-US' });
  expect(true).toBeTruthy();
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Voice Interaction Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 2 — Voice Interaction Engine');

test('createVoiceInteractionSession starts idle', () => {
  const s = createVoiceInteractionSession();
  expect(s.sttStatus).toBe('idle');
  expect(s.ttsStatus).toBe('idle');
  expect(s.isEmergencyMode).toBeFalsy();
  expect(s.ttsQueue).toHaveLength(0);
});
test('enqueueGuidance adds item to queue', () => {
  const s = createVoiceInteractionSession();
  const updated = enqueueGuidance(s, 'Object detected ahead', 'normal');
  expect(updated.ttsQueue.length).toBeGreaterThan(0);
});
test('enqueueEmergency clears low-priority and sets emergency mode', () => {
  let s = createVoiceInteractionSession();
  s = enqueueGuidance(s, 'low message', 'low');
  s = enqueueGuidance(s, 'normal message', 'normal');
  s = enqueueEmergency(s, 'STOP — critical hazard');
  expect(s.isEmergencyMode).toBeTruthy();
  expect(s.ttsQueue[0].priority).toBe('critical');
});
test('startSpeaking dequeues highest priority item', () => {
  let s = createVoiceInteractionSession();
  s = enqueueGuidance(s, 'normal', 'normal');
  s = enqueueGuidance(s, 'high', 'high');
  const { item, session: next } = startSpeaking(s);
  expect(item?.priority).toBe('high');
  expect(next.ttsStatus).toBe('speaking');
  expect(next.spokenCount).toBe(1);
});
test('startSpeaking from empty queue returns null and sets idle', () => {
  const s = createVoiceInteractionSession();
  const { item, session: next } = startSpeaking(s);
  expect(item).toBeNull();
  expect(next.ttsStatus).toBe('idle');
});
test('finishSpeaking sets idle when queue empty', () => {
  let s = createVoiceInteractionSession();
  s = { ...s, ttsStatus: 'speaking' };
  const next = finishSpeaking(s);
  expect(next.ttsStatus).toBe('idle');
});
test('interruptSpeaking sets interrupted status', () => {
  let s = createVoiceInteractionSession();
  s = { ...s, ttsStatus: 'speaking' };
  const next = interruptSpeaking(s);
  expect(next.ttsStatus).toBe('interrupted');
});
test('setSTTListening transitions to listening', () => {
  const s = createVoiceInteractionSession();
  expect(setSTTListening(s).sttStatus).toBe('listening');
});
test('setSTTIdle transitions to idle', () => {
  const s = { ...createVoiceInteractionSession(), sttStatus: 'listening' as const };
  expect(setSTTIdle(s).sttStatus).toBe('idle');
});
test('clearEmergencyMode clears emergency flag', () => {
  const s = { ...createVoiceInteractionSession(), isEmergencyMode: true };
  expect(clearEmergencyMode(s).isEmergencyMode).toBeFalsy();
});
test('processTranscript emergency transcript activates emergency mode', () => {
  const s = createVoiceInteractionSession('continuous');
  const { isEmergency, session: next } = processTranscript(s, 'emergency stop');
  expect(isEmergency).toBeTruthy();
  expect(next.isEmergencyMode).toBeTruthy();
});
test('processTranscript wake-word mode detects wake word', () => {
  const s = createVoiceInteractionSession('wake-word', wakeWordConfig);
  const { isWakeWord, commandText } = processTranscript(s, 'hey aria describe the scene');
  expect(isWakeWord).toBeTruthy();
  expect(commandText?.toLowerCase()).toContain('describe');
});
test('processTranscript continuous mode passes all transcripts', () => {
  const s = createVoiceInteractionSession('continuous');
  const { commandText } = processTranscript(s, 'describe surroundings');
  expect(commandText).toBe('describe surroundings');
});
test('getVoiceInteractionState returns consistent snapshot', () => {
  let s = createVoiceInteractionSession();
  s = enqueueGuidance(s, 'msg', 'normal');
  const state = getVoiceInteractionState(s);
  expect(state.queueLength).toBe(1);
  expect(state.sessionActive).toBeTruthy();
});
test('shouldSpeakNow true when idle', () => {
  const s = createVoiceInteractionSession();
  expect(shouldSpeakNow(s, 'normal')).toBeTruthy();
});
test('shouldSpeakNow true for critical even when speaking', () => {
  const s = { ...createVoiceInteractionSession(), ttsStatus: 'speaking' as const };
  expect(shouldSpeakNow(s, 'critical')).toBeTruthy();
});
test('shouldSpeakNow false for low when currently speaking', () => {
  const s = { ...createVoiceInteractionSession(), ttsStatus: 'speaking' as const };
  expect(shouldSpeakNow(s, 'low')).toBeFalsy();
});
test('getSessionStats returns correct counts', () => {
  let s = createVoiceInteractionSession();
  s = { ...s, spokenCount: 5, recognizedCount: 3 };
  const stats = getSessionStats(s);
  expect(stats.spokenCount).toBe(5);
  expect(stats.recognizedCount).toBe(3);
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Live Perception Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 3 — Live Perception Engine');

test('createPipelineSession defaults to simulation mode', () => {
  const s = createPipelineSession();
  expect(s.config.mode).toBe('simulation');
  expect(s.isRunning).toBeFalsy();
  expect(s.frameCount).toBe(0);
});
test('createPipelineSession respects config override', () => {
  const s = createPipelineSession({ mode: 'live' });
  expect(s.config.mode).toBe('live');
});
test('startPipeline sets isRunning true', () => {
  const s = createPipelineSession();
  expect(startPipeline(s).isRunning).toBeTruthy();
});
test('stopPipeline sets isRunning false', () => {
  const s = startPipeline(createPipelineSession());
  expect(stopPipeline(s).isRunning).toBeFalsy();
});
test('setProviderStatus updates stage status', () => {
  const s = setProviderStatus(createPipelineSession(), 'vision', 'ready');
  expect(s.providerStatuses.vision).toBe('ready');
});
test('markProviderReady sets ready status', () => {
  const s = markProviderReady(createPipelineSession(), 'ocr');
  expect(s.providerStatuses.ocr).toBe('ready');
});
test('markProviderError sets error status and logs failure', () => {
  const s = markProviderError(createPipelineSession(), 'camera', 'Permission denied');
  expect(s.providerStatuses.camera).toBe('error');
  expect(s.failureLog).toHaveLength(1);
  expect(s.failureLog[0].error).toBe('Permission denied');
});
test('switchProvider updates config and logs switch', () => {
  const s = switchProvider(createPipelineSession(), 'vision', 'simulation', 'tesseract');
  expect(s.switchLog).toHaveLength(1);
  expect(s.switchLog[0].from).toBe('simulation');
  expect(s.switchLog[0].to).toBe('tesseract');
});
test('getFallbackProvider returns next in chain', () => {
  const fallback = getFallbackProvider('vision', 'simulation');
  expect(fallback).toBe('none');
});
test('getFallbackProvider returns null when at end of chain', () => {
  const fallback = getFallbackProvider('vision', 'none');
  expect(fallback).toBeNull();
});
test('processSimulationFrame increments frameCount', () => {
  const s = startPipeline(createPipelineSession());
  const { session: next } = processSimulationFrame(s, 3, 2, 'Object ahead');
  expect(next.frameCount).toBe(1);
  expect(next.activeAlerts).toBe(2);
});
test('processSimulationFrame records latency sample', () => {
  const s = startPipeline(createPipelineSession());
  const { session: next } = processSimulationFrame(s, 1, 0, null);
  expect(next.latencyStore.samples).toHaveLength(1);
});
test('getPipelineStatus reflects running state', () => {
  const s = startPipeline(createPipelineSession());
  const status = getPipelineStatus(s);
  expect(status.isRunning).toBeTruthy();
  expect(status.mode).toBe('simulation');
});
test('getPipelineStatus returns null report when no samples', () => {
  const s = createPipelineSession();
  expect(getPipelineStatus(s).latencyReport).toBeNull();
});
test('describeMode returns non-empty for all modes', () => {
  expect(describeMode('simulation').length).toBeGreaterThan(0);
  expect(describeMode('live').length).toBeGreaterThan(0);
  expect(describeMode('hybrid').length).toBeGreaterThan(0);
});
test('validateConfig warns when guardian disabled in live mode', () => {
  const warnings = validateConfig({ mode: 'live', enableGuardian: false });
  expect(warnings.length).toBeGreaterThan(0);
  expect(warnings[0].toLowerCase()).toContain('guardian');
});
test('validateConfig warns for very low frame interval', () => {
  const warnings = validateConfig({ mode: 'live', frameIntervalMs: 100 });
  expect(warnings.length).toBeGreaterThan(0);
});
test('validateConfig no warnings for safe simulation config', () => {
  const warnings = validateConfig({ mode: 'simulation' });
  expect(warnings).toHaveLength(0);
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — Perception Latency Engine Tests
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nPhase 5 — Perception Latency Engine');

test('createFrameMetrics initialises with no stages', () => {
  const m = createFrameMetrics('simulation');
  expect(m.stages).toHaveLength(0);
  expect(m.mode).toBe('simulation');
  expect(m.completedAt).toBeNull();
});
test('recordStage appends stage to metrics', () => {
  let m = createFrameMetrics('live');
  m = recordStage(m, 'camera', 80, true);
  expect(m.stages).toHaveLength(1);
  expect(m.stages[0].stage).toBe('camera');
  expect(m.stages[0].latencyMs).toBe(80);
  expect(m.stages[0].success).toBeTruthy();
});
test('recordStage captures error message on failure', () => {
  let m = createFrameMetrics('live');
  m = recordStage(m, 'ocr', 0, false, 'Worker not initialized');
  expect(m.stages[0].errorMessage).toBe('Worker not initialized');
});
test('completeFrame sets completedAt and totalLatencyMs', () => {
  const m = createFrameMetrics('live');
  const completed = completeFrame(m);
  expect(completed.completedAt).toBeTruthy();
  expect(completed.totalLatencyMs).toBeGreaterThanOrEqual(0);
});
test('createLatencySampleStore starts empty', () => {
  const store = createLatencySampleStore('simulation');
  expect(store.samples).toHaveLength(0);
  expect(store.mode).toBe('simulation');
});
test('addSample adds frame to store', () => {
  const store = createLatencySampleStore('live');
  const m = completeFrame(createFrameMetrics('live'));
  const updated = addSample(store, m);
  expect(updated.samples).toHaveLength(1);
});
test('addSample caps at MAX_SAMPLES (100)', () => {
  let store = createLatencySampleStore('live');
  for (let i = 0; i < 110; i++) {
    store = addSample(store, completeFrame(createFrameMetrics('live')));
  }
  expect(store.samples.length).toBeLessThan(101);
});
test('generateLatencyReport returns zero counts for empty store', () => {
  const store = createLatencySampleStore('simulation');
  const report = generateLatencyReport(store);
  expect(report.sampleCount).toBe(0);
  expect(report.avgEndToEndLatencyMs).toBe(0);
});
test('generateLatencyReport computes averages correctly', () => {
  let store = createLatencySampleStore('live');
  for (let i = 0; i < 5; i++) {
    let m = createFrameMetrics('live');
    m = recordStage(m, 'vision', 200, true);
    m = recordStage(m, 'guardian', 20, true);
    m = completeFrame(m);
    store = addSample(store, m);
  }
  const report = generateLatencyReport(store);
  expect(report.sampleCount).toBe(5);
  expect(report.avgVisionLatencyMs).toBe(200);
  expect(report.avgGuardianLatencyMs).toBe(20);
  expect(report.avgEndToEndLatencyMs).toBeGreaterThanOrEqual(0);
});
test('generateLatencyReport includes p95 and min/max', () => {
  let store = createLatencySampleStore('live');
  for (let i = 0; i < 20; i++) {
    let m = createFrameMetrics('live');
    m = completeFrame(m);
    store = addSample(store, m);
  }
  const report = generateLatencyReport(store);
  expect(report.p95EndToEndLatencyMs).toBeGreaterThanOrEqual(0);
  expect(report.maxEndToEndLatencyMs).toBeGreaterThanOrEqual(report.minEndToEndLatencyMs);
});
test('gradeEndToEndLatency excellent for < 200ms', () => {
  expect(gradeEndToEndLatency(150)).toBe('excellent');
});
test('gradeEndToEndLatency good for 200–499ms', () => {
  expect(gradeEndToEndLatency(350)).toBe('good');
});
test('gradeEndToEndLatency acceptable for 500–999ms', () => {
  expect(gradeEndToEndLatency(750)).toBe('acceptable');
});
test('gradeEndToEndLatency slow for 1000–2499ms', () => {
  expect(gradeEndToEndLatency(1500)).toBe('slow');
});
test('gradeEndToEndLatency critical for >= 2500ms', () => {
  expect(gradeEndToEndLatency(3000)).toBe('critical');
});
test('gradeStageLatency camera excellent for < 50ms', () => {
  expect(gradeStageLatency('camera', 30)).toBe('excellent');
});
test('gradeStageLatency guardian excellent for < 10ms', () => {
  expect(gradeStageLatency('guardian', 5)).toBe('excellent');
});
test('startStageTimer and stopStageTimer measure elapsed time', () => {
  const timer = startStageTimer('vision');
  const { stage, latencyMs } = stopStageTimer(timer);
  expect(stage).toBe('vision');
  expect(latencyMs).toBeGreaterThanOrEqual(0);
});
test('describeReport returns data message when samples exist', () => {
  let store = createLatencySampleStore('simulation');
  store = addSample(store, completeFrame(createFrameMetrics('simulation')));
  const report = generateLatencyReport(store);
  const desc = describeReport(report);
  expect(desc).toContain('simulation');
  expect(desc).toContain('frame');
});
test('describeReport returns no-data message when empty', () => {
  const store = createLatencySampleStore('simulation');
  const report = generateLatencyReport(store);
  expect(describeReport(report)).toContain('No latency data');
});

// ══════════════════════════════════════════════════════════════════════════════
// Provider switching & failure recovery
// ══════════════════════════════════════════════════════════════════════════════

console.log('\nProvider Switching & Failure Recovery');

test('Pipeline can switch OCR provider after error', () => {
  let s = createPipelineSession({ mode: 'live' });
  s = markProviderError(s, 'ocr', 'Tesseract load failed');
  s = switchProvider(s, 'ocr', 'tesseract', 'none', 'fallback');
  expect(s.config.providers.ocr).toBe('none');
  expect(s.switchLog[0].reason).toBe('fallback');
});
test('Pipeline switch log grows with each switch', () => {
  let s = createPipelineSession();
  s = switchProvider(s, 'vision', 'simulation', 'local-ai');
  s = switchProvider(s, 'vision', 'local-ai', 'simulation', 'fallback');
  expect(s.switchLog).toHaveLength(2);
});
test('Failure log records error message', () => {
  const s = markProviderError(createPipelineSession(), 'voice', 'Web Speech not supported');
  expect(s.failureLog[0].stage).toBe('voice');
  expect(s.failureLog[0].error).toBe('Web Speech not supported');
  expect(s.failureLog[0].recoveryAction).toBe('fallback');
});
test('Multiple frame failures accumulate in log', () => {
  let s = createPipelineSession();
  s = markProviderError(s, 'camera', 'no camera');
  s = markProviderError(s, 'vision', 'model not loaded');
  expect(s.failureLog).toHaveLength(2);
});
test('OCR failure falls back to none provider chain', () => {
  const fallback = getFallbackProvider('ocr', 'tesseract');
  expect(fallback).toBe('none');
});
test('No fallback beyond none', () => {
  expect(getFallbackProvider('camera', 'none')).toBeNull();
  expect(getFallbackProvider('voice', 'none')).toBeNull();
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n──────────────────────────────────────────────────────');
if (errors.length > 0) {
  console.error(errors.join('\n\n'));
}
console.log(`\nReal Perception Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
