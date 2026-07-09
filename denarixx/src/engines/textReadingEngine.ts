/**
 * Text Reading Engine — Sprint 22: Real Perception Integration
 * Domain-aware text reading: signs, menus, medicine, documents, receipts, street names.
 * Builds TTS-ready announcements from OCR results.
 * Reuses Guardian priority logic — critical hazard keywords bypass throttle.
 */

import type { OCRResult, TextReadingResult, TextDomain } from '@/types/ocr';
import { HAZARD_KEYWORDS } from '@/types/ocr';

// ── Domain-specific announcement builders ─────────────────────────────────────

function buildSignAnnouncement(result: OCRResult): string {
  const text = result.text.trim();
  if (result.hazardKeywords.length > 0) {
    return `Warning sign: ${result.hazardKeywords.join(', ')}. ${text}`;
  }
  return `Sign reads: ${text}`;
}

function buildMenuAnnouncement(result: OCRResult): string {
  const lines = result.lines.slice(0, 5);
  if (lines.length === 0) return `Menu text: ${result.text.slice(0, 120)}`;
  return `Menu: ${lines.join('. ')}`;
}

function buildMedicineAnnouncement(result: OCRResult): string {
  const text = result.text.slice(0, 200);
  return `Medicine label: ${text}. Please verify with a pharmacist before use.`;
}

function buildStreetAnnouncement(result: OCRResult): string {
  return `Street name: ${result.text.trim()}`;
}

function buildReceiptAnnouncement(result: OCRResult): string {
  const lines = result.lines;
  // Prefer exact "total" word (not "subtotal") — match word boundary
  const totalLine = lines.find(l => /\btotal\b/i.test(l) && !/subtotal/i.test(l))
    ?? lines.find(l => /total/i.test(l));
  if (totalLine) return `Receipt. ${totalLine}`;
  return `Receipt: ${result.text.slice(0, 100)}`;
}

function buildDocumentAnnouncement(result: OCRResult): string {
  return `Document text: ${result.text.slice(0, 200)}`;
}

function buildGeneralAnnouncement(result: OCRResult): string {
  return `I can read: ${result.text.slice(0, 150)}`;
}

const DOMAIN_BUILDERS: Record<TextDomain, (r: OCRResult) => string> = {
  sign:     buildSignAnnouncement,
  menu:     buildMenuAnnouncement,
  medicine: buildMedicineAnnouncement,
  street:   buildStreetAnnouncement,
  receipt:  buildReceiptAnnouncement,
  document: buildDocumentAnnouncement,
  general:  buildGeneralAnnouncement,
};

// ── Priority determination ─────────────────────────────────────────────────────

function determinePriority(result: OCRResult): 'critical' | 'high' | 'normal' | 'low' {
  if (result.hazardKeywords.length > 0) {
    const criticals = ['DANGER', 'POISON', 'TOXIC', 'HIGH VOLTAGE', 'BIOHAZARD'];
    if (result.hazardKeywords.some(k => criticals.includes(k))) return 'critical';
    return 'high';
  }
  if (result.domain === 'medicine') return 'high';
  if (result.domain === 'sign' || result.domain === 'street') return 'normal';
  return 'low';
}

// ── Should announce decision ───────────────────────────────────────────────────

function shouldAnnounce(result: OCRResult): boolean {
  if (result.text.trim().length < 2) return false;
  if (result.confidence < 0.3) return false;
  if (result.hazardKeywords.length > 0) return true;
  if (result.domain === 'medicine') return true;
  if (result.domain === 'sign' || result.domain === 'street') return true;
  if (result.text.trim().length > 10) return true;
  return false;
}

// ── Main reading function ──────────────────────────────────────────────────────

export function buildTextReadingResult(ocr: OCRResult): TextReadingResult {
  const builder = DOMAIN_BUILDERS[ocr.domain] ?? buildGeneralAnnouncement;
  const summary = builder(ocr);
  const priority = determinePriority(ocr);
  const hazardFound = ocr.hazardKeywords.length > 0;

  return {
    raw: ocr,
    summary,
    priority,
    shouldAnnounce: shouldAnnounce(ocr),
    domain: ocr.domain,
    hazardFound,
  };
}

// ── Batch reading for multiple OCR results ────────────────────────────────────

export function buildTextReadingResults(results: OCRResult[]): TextReadingResult[] {
  return results.map(buildTextReadingResult);
}

// ── Filter by priority ────────────────────────────────────────────────────────

export function filterByPriority(
  results: TextReadingResult[],
  minPriority: 'critical' | 'high' | 'normal' | 'low',
): TextReadingResult[] {
  const weights = { critical: 4, high: 3, normal: 2, low: 1 };
  const min = weights[minPriority];
  return results.filter(r => weights[r.priority] >= min && r.shouldAnnounce);
}

// ── Hazard check shortcut ─────────────────────────────────────────────────────

export function containsHazardText(text: string): boolean {
  const upper = text.toUpperCase();
  return HAZARD_KEYWORDS.some(kw => upper.includes(kw));
}

// ── Extract numbers (useful for medicine doses, receipts) ─────────────────────

export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:\.\d+)?/g);
  return matches ? matches.map(Number) : [];
}

// ── Abbreviation expansion (street names, medicine) ───────────────────────────

const ABBREVIATIONS: Record<string, string> = {
  st:   'street',
  ave:  'avenue',
  rd:   'road',
  blvd: 'boulevard',
  ln:   'lane',
  dr:   'drive',
  ct:   'court',
  pl:   'place',
  mg:   'milligrams',
  ml:   'millilitres',
  tab:  'tablet',
  cap:  'capsule',
};

export function expandAbbreviations(text: string): string {
  return text.replace(/\b([a-zA-Z]{2,4})\b/g, (match) => {
    const lower = match.toLowerCase();
    return ABBREVIATIONS[lower] ?? match;
  });
}

// ── Summarise multiple readings (for long sessions) ───────────────────────────

export function summariseReadings(results: TextReadingResult[]): string {
  if (results.length === 0) return 'No text detected.';
  const critical = results.filter(r => r.priority === 'critical');
  const high = results.filter(r => r.priority === 'high');
  if (critical.length > 0) return `Critical: ${critical.map(r => r.summary).join('. ')}`;
  if (high.length > 0) return high.map(r => r.summary).join('. ');
  return results[0].summary;
}
