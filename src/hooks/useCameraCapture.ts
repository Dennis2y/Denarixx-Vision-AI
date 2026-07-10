'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// CameraStatus drives the UI state machine:
//   inactive    → camera not started; session will use simulation
//   requesting  → permission prompt shown to user
//   active      → stream live, frames are being captured
//   denied      → browser denied permission; session falls back to simulation
export type CameraStatus = 'inactive' | 'requesting' | 'active' | 'denied';

export function useCameraCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('inactive');

  const requestCamera = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setStatus('denied');
      return false;
    }
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;

      await new Promise<void>((resolve) => {
        const video = videoRef.current;
        if (!video) { resolve(); return; }
        const timer = setTimeout(resolve, 5000);
        const onReady = () => {
          clearTimeout(timer);
          video.play().catch(() => {});
          resolve();
        };
        if (video.readyState >= 1) {
          onReady();
        } else {
          video.srcObject = stream;
          video.addEventListener('loadedmetadata', onReady, { once: true });
        }
      });

      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus('active');
      return true;
    } catch {
      setStatus('denied');
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('inactive');
  }, []);

  // Returns a JPEG base64 data URL, or null if camera is not ready
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }, []);

  // Stop camera tracks on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return { videoRef, canvasRef, status, requestCamera, stopCamera, captureFrame };
}
