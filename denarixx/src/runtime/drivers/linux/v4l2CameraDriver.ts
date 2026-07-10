// ─── V4L2 Camera Driver ───────────────────────────────────────────────────────
// Linux Video4Linux2 camera driver boundary for MIPI-CSI2 camera modules.
//
// Real implementation (physical device required):
//   - Open: open('/dev/videoN', O_RDWR | O_NONBLOCK)
//   - Query capabilities: ioctl(fd, VIDIOC_QUERYCAP)
//   - Set format: ioctl(fd, VIDIOC_S_FMT) → YUYV or MJPEG or RGB24
//   - Request buffers: ioctl(fd, VIDIOC_REQBUFS) → mmap()
//   - Stream on: ioctl(fd, VIDIOC_STREAMON)
//   - Dequeue frame: ioctl(fd, VIDIOC_DQBUF); read mmap buffer; ioctl(VIDIOC_QBUF)
//   - Stream off: ioctl(fd, VIDIOC_STREAMOFF); munmap(); close(fd)
//
// This file defines the driver interface and state machine.
// It does NOT perform ioctl calls yet — that requires a native Node.js binding
// (e.g. 'v4l2-camera' npm package or a custom N-API addon).
//
// Approach for early prototype bring-up:
//   Option A: npm install v4l2-camera (if native binding compiles on target board)
//   Option B: spawn `ffmpeg -f v4l2 -i /dev/video0 -vframes 1 -f rawvideo` as child process
//   Option C: injectable frame source (write raw RGB24 bytes to a named pipe; read here)
//
// Status reporting:
//   Never report 'healthy' unless a real frame with non-zero bytes was received.

import * as fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export type V4L2PixelFormat = 'rgb24' | 'bgr24' | 'yuyv' | 'mjpeg' | 'nv12' | 'unknown';
export type V4L2DriverStatus = 'not-initialized' | 'initializing' | 'streaming' | 'degraded' | 'failed' | 'closed';

export interface V4L2CameraConfig {
  devicePath: string;    // e.g. /dev/video0
  width: number;         // requested width in pixels
  height: number;        // requested height in pixels
  frameRateFps: number;  // requested frame rate
  pixelFormat: V4L2PixelFormat;
}

export interface V4L2DriverState {
  config: V4L2CameraConfig;
  status: V4L2DriverStatus;
  framesCapured: number;
  errorCount: number;
  lastErrorMessage: string | null;
  deviceAccessible: boolean;   // /dev/videoN exists and is readable
}

export interface V4L2CapturedFrame {
  pixels: Uint8Array;
  width: number;
  height: number;
  stride: number;
  pixelFormat: V4L2PixelFormat;
  frameId: number;
  timestampMs: number;
  isSimulated: false;
}

export interface V4L2InitResult {
  state: V4L2DriverState;
  error: string | null;
}

// ─── Driver State Factory ─────────────────────────────────────────────────────

export function createV4L2DriverState(config: V4L2CameraConfig): V4L2DriverState {
  const deviceAccessible = fs.existsSync(config.devicePath);
  return {
    config,
    status: 'not-initialized',
    framesCapured: 0,
    errorCount: 0,
    lastErrorMessage: null,
    deviceAccessible,
  };
}

// ─── Initialize ───────────────────────────────────────────────────────────────
// On a real device: open V4L2 fd, set format, allocate mmap buffers, STREAMON.
// On a development host without camera hardware: returns 'failed' with explanation.

export function initializeV4L2Driver(state: V4L2DriverState): V4L2InitResult {
  if (!state.deviceAccessible) {
    const error = `V4L2 camera device not found at ${state.config.devicePath}. ` +
      `Check MIPI-CSI2 cable connection and V4L2 driver (v4l2-ctl --list-devices). ` +
      `On Raspberry Pi CM4: ensure dtoverlay=ov9281 is in /boot/config.txt.`;
    return {
      state: { ...state, status: 'failed', lastErrorMessage: error },
      error,
    };
  }

  // TODO (physical bring-up): open V4L2 fd and ioctl VIDIOC_QUERYCAP, VIDIOC_S_FMT, VIDIOC_REQBUFS, VIDIOC_STREAMON
  // For now: device exists but native binding not yet implemented.
  const error = `V4L2 device ${state.config.devicePath} exists but native binding is not yet implemented. ` +
    `Install v4l2-camera npm package or implement N-API binding, then complete this function.`;
  return {
    state: { ...state, status: 'failed', lastErrorMessage: error },
    error,
  };
}

// ─── Capture Frame ────────────────────────────────────────────────────────────
// On a real device: ioctl VIDIOC_DQBUF; copy mmap buffer; ioctl VIDIOC_QBUF.
// Returns null and updates error state if camera is not streaming.

export function captureV4L2Frame(
  state: V4L2DriverState,
  frameId: number,
): { state: V4L2DriverState; frame: V4L2CapturedFrame | null; error: string | null } {
  if (state.status !== 'streaming') {
    const error = `Cannot capture frame: driver status is '${state.status}'. Camera must be streaming.`;
    return { state: { ...state, errorCount: state.errorCount + 1, lastErrorMessage: error }, frame: null, error };
  }

  // TODO (physical bring-up): ioctl(fd, VIDIOC_DQBUF) + mmap read + ioctl(fd, VIDIOC_QBUF)
  const error = `V4L2 frame capture not yet implemented (native binding required).`;
  return {
    state: { ...state, status: 'degraded', errorCount: state.errorCount + 1, lastErrorMessage: error },
    frame: null,
    error,
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────

export function getV4L2DriverHealth(state: V4L2DriverState): V4L2DriverStatus {
  return state.status;
}

// ─── Shutdown ─────────────────────────────────────────────────────────────────

export function shutdownV4L2Driver(state: V4L2DriverState): V4L2DriverState {
  // TODO (physical bring-up): ioctl VIDIOC_STREAMOFF; munmap(); close(fd)
  return { ...state, status: 'closed' };
}

// ─── Environment Check ────────────────────────────────────────────────────────

export interface V4L2EnvironmentCheck {
  deviceExists: boolean;
  devicePath: string;
  nativeBindingAvailable: boolean;
  recommendation: string;
}

export function checkV4L2Environment(devicePath: string): V4L2EnvironmentCheck {
  const deviceExists = fs.existsSync(devicePath);
  let nativeBindingAvailable = false;
  try {
    require.resolve('v4l2-camera');
    nativeBindingAvailable = true;
  } catch { /* not installed */ }

  let recommendation: string;
  if (!deviceExists) {
    recommendation = `${devicePath} not found. Connect MIPI-CSI2 camera and load V4L2 driver.`;
  } else if (!nativeBindingAvailable) {
    recommendation = `Device exists. Install v4l2-camera: npm install v4l2-camera (requires node-gyp on target board).`;
  } else {
    recommendation = `Device and binding available. Complete TODO in initializeV4L2Driver.`;
  }

  return { deviceExists, devicePath, nativeBindingAvailable, recommendation };
}
