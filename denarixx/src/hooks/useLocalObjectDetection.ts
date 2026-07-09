'use client';

import { useState, useRef, useCallback } from 'react';
import type { Detection } from '@/types';

export type LocalDetectionStatus = 'idle' | 'loading' | 'ready' | 'detecting' | 'error';

const MIN_CONFIDENCE = 0.4;

interface CocoDetection {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

interface CocoModel {
  detect(
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<CocoDetection[]>;
}

export function useLocalObjectDetection() {
  const [status, setStatus] = useState<LocalDetectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef<CocoModel | null>(null);
  const loadingRef = useRef(false);

  const loadModel = useCallback(async (): Promise<boolean> => {
    if (modelRef.current) return true;
    if (loadingRef.current) return false;
    loadingRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      await import('@tensorflow/tfjs');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      modelRef.current = (await cocoSsd.load({ base: 'lite_mobilenet_v2' })) as CocoModel;
      setStatus('ready');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load COCO-SSD model';
      setError(msg);
      setStatus('error');
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const detect = useCallback(async (
    source: HTMLVideoElement | HTMLCanvasElement
  ): Promise<Detection[]> => {
    const model = modelRef.current;
    if (!model) return [];

    const isVideo = source instanceof HTMLVideoElement;
    if (isVideo && (source.readyState < 2 || source.videoWidth === 0)) return [];

    setStatus('detecting');
    try {
      const predictions = await model.detect(source);
      setStatus('ready');

      const w = isVideo ? source.videoWidth : source.width;
      const h = isVideo ? source.videoHeight : source.height;
      const safeW = w > 0 ? w : 1;
      const safeH = h > 0 ? h : 1;

      return predictions
        .filter((p) => p.score >= MIN_CONFIDENCE)
        .map((p) => ({
          label: p.class,
          confidence: p.score,
          boundingBox: {
            x: p.bbox[0] / safeW,
            y: p.bbox[1] / safeH,
            width: p.bbox[2] / safeW,
            height: p.bbox[3] / safeH,
          },
        } satisfies Detection));
    } catch {
      setStatus('ready');
      return [];
    }
  }, []);

  return {
    status,
    error,
    loadModel,
    detect,
    isReady: status === 'ready' || status === 'detecting',
    isLoading: status === 'loading',
  };
}
