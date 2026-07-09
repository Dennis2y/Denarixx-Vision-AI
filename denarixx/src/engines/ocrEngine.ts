/**
 * OCR Engine — Sprint 22: Real Perception Integration
 * Provider abstraction for OCR. Supports Tesseract (on-device) and None (fallback).
 * Uses the same provider pattern as visionProviderFactory.ts.
 * Do NOT instantiate browser APIs here — engines must be testable in Node.js.
 */

import type {
  OCRConfig,
  OCRResult,
  OCRResultRaw,
  OCRProvider,
  OCRProviderInterface,
  OCRConfidenceLevel,
  TextDomain,
} from '@/types/ocr';
import {
  HAZARD_KEYWORDS,
  DOMAIN_KEYWORDS,
  DEFAULT_OCR_CONFIG,
  OCR_SAFETY_NOTE,
} from '@/types/ocr';

// ── Null OCR Provider (always available, returns empty result) ────────────────

class NullOCRProvider implements OCRProviderInterface {
  readonly name: OCRProvider = 'none';
  readonly isAvailable = true;

  isReady(): boolean { return true; }
  async initialize(): Promise<void> {}
  async terminate(): Promise<void> {}

  async recognize(_imageSource: string): Promise<OCRResultRaw> {
    return {
      text: '',
      confidence: 0,
      lines: [],
      detectedAt: new Date(),
      latencyMs: 0,
      provider: 'none',
      language: 'eng',
    };
  }
}

// ── Tesseract Provider stub (real execution in useOCR hook) ───────────────────
// The engine provides the interface contract; the hook injects a recognize fn.

class TesseractOCRProvider implements OCRProviderInterface {
  readonly name: OCRProvider = 'tesseract';
  isAvailable = false; // set true when recognize fn is injected
  private _recognizeFn: ((src: string) => Promise<{ text: string; confidence: number }>) | null = null;
  private _ready = false;

  injectRecognizeFn(fn: (src: string) => Promise<{ text: string; confidence: number }>): void {
    this._recognizeFn = fn;
    this.isAvailable = true;
    this._ready = true;
  }

  isReady(): boolean { return this._ready; }
  async initialize(): Promise<void> {}
  async terminate(): Promise<void> { this._ready = false; this._recognizeFn = null; }

  async recognize(imageSource: string): Promise<OCRResultRaw> {
    if (!this._recognizeFn) {
      return new NullOCRProvider().recognize(imageSource);
    }
    const start = Date.now();
    try {
      const { text, confidence } = await this._recognizeFn(imageSource);
      return {
        text: text.trim(),
        confidence,
        lines: text.split('\n').map(l => l.trim()).filter(Boolean),
        detectedAt: new Date(),
        latencyMs: Date.now() - start,
        provider: 'tesseract',
        language: 'eng',
      };
    } catch {
      return {
        text: '',
        confidence: 0,
        lines: [],
        detectedAt: new Date(),
        latencyMs: Date.now() - start,
        provider: 'tesseract',
        language: 'eng',
      };
    }
  }
}

// ── Provider registry ──────────────────────────────────────────────────────────

const _tesseractProvider = new TesseractOCRProvider();
const _nullProvider = new NullOCRProvider();

export function getTesseractProvider(): TesseractOCRProvider {
  return _tesseractProvider;
}

export function getOCRProvider(name: OCRProvider): OCRProviderInterface {
  switch (name) {
    case 'tesseract': return _tesseractProvider;
    case 'none':      return _nullProvider;
    default:          return _nullProvider;
  }
}

// ── Confidence level classification ───────────────────────────────────────────

export function classifyConfidence(confidence: number): OCRConfidenceLevel {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

// ── Keyword extraction ─────────────────────────────────────────────────────────

export function extractKeywords(text: string, domain: TextDomain): string[] {
  const upper = text.toUpperCase();
  const domainWords = DOMAIN_KEYWORDS[domain] ?? [];
  const found: string[] = [];
  for (const kw of domainWords) {
    if (upper.includes(kw.toUpperCase())) found.push(kw);
  }
  return [...new Set(found)];
}

export function extractHazardKeywords(text: string): string[] {
  const upper = text.toUpperCase();
  return HAZARD_KEYWORDS.filter(kw => upper.includes(kw)).slice();
}

// ── Domain detection (heuristic) ──────────────────────────────────────────────

export function detectDomain(text: string): TextDomain {
  const upper = text.toUpperCase();
  const scores: Record<TextDomain, number> = {
    sign: 0, menu: 0, medicine: 0, street: 0, receipt: 0, document: 0, general: 0,
  };
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [TextDomain, readonly string[]][]) {
    for (const kw of keywords) {
      if (upper.includes(kw.toUpperCase())) scores[domain]++;
    }
  }
  const best = (Object.entries(scores) as [TextDomain, number][]).sort((a, b) => b[1] - a[1]);
  return best[0][1] > 0 ? best[0][0] : 'general';
}

// ── Main enrichment function ───────────────────────────────────────────────────

export function enrichOCRResult(raw: OCRResultRaw, config: Partial<OCRConfig> = {}): OCRResult {
  const cfg = { ...DEFAULT_OCR_CONFIG, ...config };
  const domain: TextDomain = cfg.domain === 'general' ? detectDomain(raw.text) : cfg.domain;
  return {
    text: raw.text,
    confidence: raw.confidence,
    confidenceLevel: classifyConfidence(raw.confidence),
    domain,
    provider: raw.provider,
    language: raw.language,
    lines: raw.lines,
    keywords: extractKeywords(raw.text, domain),
    hazardKeywords: extractHazardKeywords(raw.text),
    detectedAt: raw.detectedAt,
    latencyMs: raw.latencyMs,
  };
}

// ── Full recognize pipeline ────────────────────────────────────────────────────

export async function recognizeText(
  imageSource: string,
  config: Partial<OCRConfig> = {},
): Promise<OCRResult | null> {
  const cfg = { ...DEFAULT_OCR_CONFIG, ...config };
  if (cfg.provider === 'none') return null;

  const provider = getOCRProvider(cfg.provider);
  if (!provider.isReady()) return null;

  const raw = await provider.recognize(imageSource);
  if (!raw.text || raw.confidence < cfg.minConfidence) return null;

  return enrichOCRResult(raw, cfg);
}

export { OCR_SAFETY_NOTE };
