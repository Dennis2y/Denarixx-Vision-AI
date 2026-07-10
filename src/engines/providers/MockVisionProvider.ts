import type { VisionProvider, ProviderCapabilities } from '../types';
import type { VisionFrame, Detection } from '@/types';

const MOCK_DETECTIONS: Detection[][] = [
  [
    { label: 'person', confidence: 0.91, boundingBox: { x: 0.4, y: 0.2, width: 0.2, height: 0.5 } },
    { label: 'pavement', confidence: 0.95, boundingBox: { x: 0, y: 0.7, width: 1, height: 0.3 } },
  ],
  [
    { label: 'obstacle', confidence: 0.88, boundingBox: { x: 0.3, y: 0.4, width: 0.4, height: 0.4 } },
    { label: 'bicycle', confidence: 0.72, boundingBox: { x: 0.6, y: 0.3, width: 0.3, height: 0.4 } },
  ],
  [
    { label: 'step', confidence: 0.65, boundingBox: { x: 0.1, y: 0.6, width: 0.8, height: 0.1 } },
    { label: 'pavement', confidence: 0.93 },
  ],
  [
    { label: 'vehicle', confidence: 0.94, boundingBox: { x: 0.0, y: 0.3, width: 0.5, height: 0.4 } },
    { label: 'road', confidence: 0.97 },
  ],
  [
    { label: 'door', confidence: 0.89 },
    { label: 'text', confidence: 0.78 },
    { label: 'stairs', confidence: 0.55 },
  ],
  [
    { label: 'table', confidence: 0.92 },
    { label: 'chair', confidence: 0.88 },
    { label: 'person', confidence: 0.71 },
  ],
];

let frameCounter = 0;

export class MockVisionProvider implements VisionProvider {
  readonly name = 'MockVisionProvider';
  readonly capabilities: ProviderCapabilities = {
    hazardDetection: true,
    sceneDescription: true,
    objectRecognition: true,
    faceRecognition: false,
    confidence: true,
  };

  async analyzeFrame(_frame: VisionFrame): Promise<Detection[]> {
    // Simulate processing delay
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

    const detections = MOCK_DETECTIONS[frameCounter % MOCK_DETECTIONS.length];
    frameCounter++;

    // Add a small random confidence jitter to make it feel real
    return detections.map((d) => ({
      ...d,
      confidence: Math.min(1, Math.max(0, d.confidence + (Math.random() - 0.5) * 0.08)),
    }));
  }
}
