'use client';

import { useState, useRef, useCallback } from 'react';

export type OCRStatus = 'idle' | 'loading' | 'ready' | 'recognizing' | 'error';

export interface OCRResult {
  text: string;
  confidence: number;
  detectedAt: Date;
}

export function useOCR() {
  const [status, setStatus] = useState<OCRStatus>('idle');
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<{ recognize: (img: string) => Promise<{ data: { text: string; confidence: number } }> ; terminate: () => Promise<void> } | null>(null);
  const loadingRef = useRef(false);

  const loadWorker = useCallback(async (): Promise<boolean> => {
    if (workerRef.current) return true;
    if (loadingRef.current) return false;
    loadingRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, {
        logger: () => {},
      });
      workerRef.current = w as unknown as typeof workerRef.current;
      setStatus('ready');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load OCR engine';
      setError(msg);
      setStatus('error');
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const recognize = useCallback(async (imageDataUrl: string): Promise<OCRResult | null> => {
    const worker = workerRef.current;
    if (!worker || !imageDataUrl) return null;
    setStatus('recognizing');
    try {
      const { data } = await worker.recognize(imageDataUrl);
      const text = data.text.trim();
      if (!text) {
        setStatus('ready');
        return null;
      }
      const ocr: OCRResult = {
        text,
        confidence: data.confidence / 100,
        detectedAt: new Date(),
      };
      setResult(ocr);
      setStatus('ready');
      return ocr;
    } catch {
      setStatus('ready');
      return null;
    }
  }, []);

  const clearResult = useCallback(() => setResult(null), []);

  return {
    status,
    result,
    error,
    loadWorker,
    recognize,
    clearResult,
    isReady: status === 'ready' || status === 'recognizing',
    isLoading: status === 'loading',
  };
}
