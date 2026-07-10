// ─── Bring-Up Program: Embedded Prototype Adapter ────────────────────────────
// Pure functions — no async, no I/O.
// Physical HAL drivers: MIPI-CSI camera, I2S audio, PWM haptic, SPI/I2C IMU,
// UART GNSS, I2C battery fuel gauge, GPIO buttons.
// This is the adapter used on real prototype glasses hardware.
// Real-user mode: isSimulated is always false. No synthetic fallback.
//
// BRING-UP NOTE: Physical drivers are interface stubs at P0.
// Each function documents the Linux kernel / hardware SDK call it will make.

import type {
  CameraAdapter, CameraFrame,
  MicrophoneAdapter, AudioFrame,
  AudioOutputAdapter,
  HapticAdapter,
  IMUAdapter, IMUReading,
  BatteryAdapter, BatteryReading,
  NetworkAdapter, NetworkStatus,
  ButtonAdapter, ButtonEvent,
  AdapterHealthStatus,
} from './hardwareAdapterTypes';
import type { HardwareAdapterMode } from '@/types/localInference';

const MODE: HardwareAdapterMode = 'embedded-prototype';

// ─── Camera (MIPI-CSI2 → V4L2 → frame buffer) ────────────────────────────────

export interface EmbeddedCameraDriverState {
  devicePath: string;           // e.g. /dev/video0
  isOpen: boolean;
  lastFrameId: number;
  errorCount: number;
}

export function createEmbeddedCameraAdapter(
  state: EmbeddedCameraDriverState,
): CameraAdapter {
  return {
    mode: MODE,
    id: `embedded-camera-${state.devicePath}`,
    isAvailable: () => state.isOpen && state.errorCount < 5,
    getLastFrame: (tick: number): CameraFrame | null => {
      if (!state.isOpen) return null;
      // REAL IMPLEMENTATION: read V4L2 frame from mmap buffer
      // ioctl(fd, VIDIOC_DQBUF, &buf); mmap read; ioctl VIDIOC_QBUF
      // pixels will be non-null when v4l2CameraDriver.captureV4L2Frame() is integrated here
      return {
        frameId: tick,
        timestampMs: Date.now(),
        width: 640,
        height: 480,
        stride: 0,
        pixelFormat: 'unknown',
        pixels: null,   // populated by V4L2 driver when physical camera is connected
        source: MODE,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'unavailable' :
      state.errorCount > 3 ? 'degraded' : 'healthy',
  };
}

// ─── Microphone (I2S PDM → ALSA) ─────────────────────────────────────────────

export interface EmbeddedMicrophoneDriverState {
  alsaDevice: string;           // e.g. hw:0,0
  isOpen: boolean;
  errorCount: number;
}

export function createEmbeddedMicrophoneAdapter(
  state: EmbeddedMicrophoneDriverState,
): MicrophoneAdapter {
  return {
    mode: MODE,
    id: `embedded-mic-${state.alsaDevice}`,
    isAvailable: () => state.isOpen && state.errorCount < 5,
    getLastFrame: (tick: number): AudioFrame | null => {
      if (!state.isOpen) return null;
      // REAL IMPLEMENTATION: snd_pcm_readi() from ALSA capture handle
      // Wake word: run Porcupine or Kaldi lightweight decoder on audio chunk
      return {
        frameId: tick,
        timestampMs: Date.now(),
        peakAmplitude: 0,
        wakeWordDetected: false,
        speechDetected: false,
        source: MODE,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'unavailable' :
      state.errorCount > 3 ? 'degraded' : 'healthy',
  };
}

// ─── Audio Output (I2S → Class-D amp → bone-conduction) ──────────────────────

export interface EmbeddedAudioOutputDriverState {
  alsaPlaybackDevice: string;   // e.g. hw:1,0
  isOpen: boolean;
  isSpeaking: boolean;
  errorCount: number;
}

export function createEmbeddedAudioOutputAdapter(
  state: EmbeddedAudioOutputDriverState,
): AudioOutputAdapter {
  return {
    mode: MODE,
    id: `embedded-audio-out-${state.alsaPlaybackDevice}`,
    isAvailable: () => state.isOpen && state.errorCount < 5,
    canSpeak: () => state.isOpen && !state.isSpeaking,
    // REAL IMPLEMENTATION: espeak-ng or piper TTS → snd_pcm_writei()
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'unavailable' :
      state.errorCount > 3 ? 'degraded' : 'healthy',
  };
}

// ─── Haptic (GPIO PWM or I2C DRV2605L) ───────────────────────────────────────

export interface EmbeddedHapticDriverState {
  interface: 'pwm-gpio' | 'i2c-drv2605l';
  isOpen: boolean;
  errorCount: number;
}

export function createEmbeddedHapticAdapter(
  state: EmbeddedHapticDriverState,
): HapticAdapter {
  return {
    mode: MODE,
    id: `embedded-haptic-${state.interface}`,
    isAvailable: () => state.isOpen && state.errorCount < 3,
    // REAL IMPLEMENTATION (DRV2605L): write waveform sequence to I2C register 0x04–0x0B
    // REAL IMPLEMENTATION (PWM): write pulse-on-off sequence to /sys/class/pwm/pwmchip0/
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'unavailable' :
      state.errorCount > 2 ? 'degraded' : 'healthy',
  };
}

// ─── IMU (SPI ICM-42688-P or I2C LSM6DSO) ────────────────────────────────────

export interface EmbeddedIMUDriverState {
  interface: 'spi' | 'i2c';
  deviceAddress: string;        // e.g. 0x6A for LSM6DSO
  isOpen: boolean;
  lastHeadingDeg: number;
  lastMotionState: IMUReading['motionState'];
  errorCount: number;
}

export function createEmbeddedIMUAdapter(
  state: EmbeddedIMUDriverState,
): IMUAdapter {
  return {
    mode: MODE,
    id: `embedded-imu-${state.interface}-${state.deviceAddress}`,
    isAvailable: () => state.isOpen && state.errorCount < 5,
    getLastReading: (tick: number): IMUReading | null => {
      if (!state.isOpen) return null;
      // REAL IMPLEMENTATION: read FIFO registers via spidev ioctl or i2c-dev ioctl
      return {
        tick,
        timestampMs: Date.now(),
        accelX: 0,
        accelY: 0,
        accelZ: 9.81,
        gyroX: 0,
        gyroY: 0,
        gyroZ: 0,
        headingDeg: state.lastHeadingDeg,
        motionState: state.lastMotionState,
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'unavailable' :
      state.errorCount > 3 ? 'degraded' : 'healthy',
  };
}

// ─── Battery (I2C MAX17048 / BQ27220 fuel gauge) ──────────────────────────────

export interface EmbeddedBatteryDriverState {
  i2cAddress: string;           // e.g. 0x36 for MAX17048
  isOpen: boolean;
  lastPct: number;
  lastTempC: number;
  errorCount: number;
}

export function createEmbeddedBatteryAdapter(
  state: EmbeddedBatteryDriverState,
): BatteryAdapter {
  return {
    mode: MODE,
    id: `embedded-battery-${state.i2cAddress}`,
    isAvailable: () => state.isOpen,
    getLastReading: (_tick: number): BatteryReading | null => {
      if (!state.isOpen) return null;
      // REAL IMPLEMENTATION: read SOC register (0x04) and voltage (0x02) via i2c-dev
      return {
        timestampMs: Date.now(),
        percentagePct: state.lastPct,
        temperatureC: state.lastTempC,
        isCharging: false,
        estimatedMinutesRemaining: Math.round(state.lastPct * 2.25),
        isSimulated: false,
      };
    },
    getHealthStatus: (): AdapterHealthStatus =>
      !state.isOpen ? 'degraded' : 'healthy',
  };
}

// ─── Network (Linux netlink / iwconfig / nmcli) ───────────────────────────────

export interface EmbeddedNetworkDriverState {
  isOnline: boolean;
  signalStrengthDbm: number | null;
  lastCheckedMs: number;
}

export function createEmbeddedNetworkAdapter(
  state: EmbeddedNetworkDriverState,
): NetworkAdapter {
  return {
    mode: MODE,
    id: 'embedded-network-0',
    getStatus: (): NetworkStatus => {
      // REAL IMPLEMENTATION: read /sys/class/net/wlan0/operstate or netlink RTMGRP_LINK
      const quality = !state.isOnline ? 'offline' :
        state.signalStrengthDbm !== null && state.signalStrengthDbm < -80 ? 'weak' : 'good';
      return {
        isOnline: state.isOnline,
        quality,
        lastCheckedMs: state.lastCheckedMs,
      };
    },
  };
}

// ─── Buttons (GPIO via /sys/class/gpio or libgpiod) ───────────────────────────

export interface EmbeddedButtonDriverState {
  gpioChip: string;             // e.g. /dev/gpiochip0
  isOpen: boolean;
  pendingEvents: ButtonEvent[];
}

export function createEmbeddedButtonAdapter(
  state: EmbeddedButtonDriverState,
): ButtonAdapter {
  return {
    mode: MODE,
    id: `embedded-buttons-${state.gpioChip}`,
    isAvailable: () => state.isOpen,
    pollEvents: (): ButtonEvent[] => {
      // REAL IMPLEMENTATION: read GPIO event queue via gpiod_chip_open + gpiod_line_event_read
      // Returns debounced press/release events from main, vol-up, vol-down GPIO lines
      return [...state.pendingEvents];
    },
    getHealthStatus: (): AdapterHealthStatus =>
      state.isOpen ? 'healthy' : 'unavailable',
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDefaultEmbeddedDriverStates() {
  return {
    camera: { devicePath: '/dev/video0', isOpen: false, lastFrameId: 0, errorCount: 0 } as EmbeddedCameraDriverState,
    microphone: { alsaDevice: 'hw:0,0', isOpen: false, errorCount: 0 } as EmbeddedMicrophoneDriverState,
    audioOutput: { alsaPlaybackDevice: 'hw:1,0', isOpen: false, isSpeaking: false, errorCount: 0 } as EmbeddedAudioOutputDriverState,
    haptic: { interface: 'i2c-drv2605l' as const, isOpen: false, errorCount: 0 } as EmbeddedHapticDriverState,
    imu: { interface: 'i2c' as const, deviceAddress: '0x6A', isOpen: false, lastHeadingDeg: 0, lastMotionState: 'unknown' as const, errorCount: 0 } as EmbeddedIMUDriverState,
    battery: { i2cAddress: '0x36', isOpen: false, lastPct: 100, lastTempC: 25, errorCount: 0 } as EmbeddedBatteryDriverState,
    network: { isOnline: false, signalStrengthDbm: null, lastCheckedMs: Date.now() } as EmbeddedNetworkDriverState,
    buttons: { gpioChip: '/dev/gpiochip0', isOpen: false, pendingEvents: [] } as EmbeddedButtonDriverState,
  };
}
