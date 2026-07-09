/**
 * OCR Types — Sprint 22: Real Perception Integration
 * Provider-agnostic OCR types for the Denarixx Vision AI platform.
 * Never merge into index.ts — keep OCR types isolated.
 */

export type OCRProvider = 'tesseract' | 'cloud-vision' | 'none';

export type TextDomain =
  | 'document'
  | 'sign'
  | 'menu'
  | 'medicine'
  | 'street'
  | 'receipt'
  | 'general';

export type OCRConfidenceLevel = 'high' | 'medium' | 'low';

export interface OCRConfig {
  provider: OCRProvider;
  language: string;
  minConfidence: number;
  domain: TextDomain;
}

export interface OCRResultRaw {
  text: string;
  confidence: number;
  lines: string[];
  detectedAt: Date;
  latencyMs: number;
  provider: OCRProvider;
  language: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  confidenceLevel: OCRConfidenceLevel;
  domain: TextDomain;
  provider: OCRProvider;
  language: string;
  lines: string[];
  keywords: string[];
  hazardKeywords: string[];
  detectedAt: Date;
  latencyMs: number;
}

export interface TextReadingResult {
  raw: OCRResult;
  summary: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  shouldAnnounce: boolean;
  domain: TextDomain;
  hazardFound: boolean;
}

export interface OCRProviderInterface {
  readonly name: OCRProvider;
  readonly isAvailable: boolean;
  recognize(imageSource: string): Promise<OCRResultRaw>;
  isReady(): boolean;
  initialize(): Promise<void>;
  terminate(): Promise<void>;
}

export const HAZARD_KEYWORDS: readonly string[] = [
  'STOP',
  'DANGER',
  'WARNING',
  'CAUTION',
  'EXIT',
  'EMERGENCY',
  'POISON',
  'TOXIC',
  'HOT',
  'RESTRICTED',
  'NO ENTRY',
  'KEEP OUT',
  'HIGH VOLTAGE',
  'FLAMMABLE',
  'BIOHAZARD',
];

export const MEDICINE_KEYWORDS: readonly string[] = [
  'mg',
  'ml',
  'tablet',
  'capsule',
  'dose',
  'twice',
  'daily',
  'prescription',
  'warning',
  'side effects',
  'pharmacist',
  'physician',
];

export const DOMAIN_KEYWORDS: Record<TextDomain, readonly string[]> = {
  sign: ['STOP', 'EXIT', 'ENTER', 'OPEN', 'CLOSED', 'PUSH', 'PULL', 'NO', 'PARKING', 'SPEED'],
  menu: ['price', 'serves', 'contains', 'allergen', 'vegan', 'gluten', 'calories', 'order'],
  medicine: MEDICINE_KEYWORDS,
  receipt: ['total', 'subtotal', 'tax', 'change', 'cash', 'card', 'receipt', 'thank you'],
  street: ['st', 'ave', 'rd', 'blvd', 'way', 'lane', 'court', 'drive', 'place', 'mph', 'km'],
  document: ['dear', 'regards', 'sincerely', 'date', 'subject', 'reference', 'to:', 'from:'],
  general: [],
};

export const DEFAULT_OCR_CONFIG: OCRConfig = {
  provider: 'tesseract',
  language: 'eng',
  minConfidence: 0.3,
  domain: 'general',
};

export const OCR_SAFETY_NOTE =
  'OCR text recognition is assistive only. Always verify critical information independently.';
