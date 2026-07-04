'use client';

import { useWearableDevice } from '@/hooks/useWearableDevice';
import { DeviceCapabilityEngine } from '@/engines/deviceCapabilityEngine';
import { HardwareBridgeEngine } from '@/engines/hardwareBridgeEngine';
import { HARDWARE_DEFAULTS } from '@/types/hardware';
import type { CameraSource, AudioOutput, HapticOutput, ConnectedDevice } from '@/types/hardware';
import { MultiCameraPanel } from '@/components/devices/MultiCameraPanel';

const capEngine = new DeviceCapabilityEngine();
const bridgeEngine = new HardwareBridgeEngine(HARDWARE_DEFAULTS);

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectedDevice['status'] }) {
  const styles: Record<ConnectedDevice['status'], string> = {
    undiscovered: 'bg-gray-800 text-gray-500',
    discovered:   'bg-gray-700 text-gray-300',
    connecting:   'bg-yellow-900/60 text-yellow-300',
    connected:    'bg-blue-900/60 text-blue-300',
    active:       'bg-green-900/60 text-green-300',
    disconnecting:'bg-orange-900/60 text-orange-300',
    disconnected: 'bg-gray-800 text-gray-500',
    error:        'bg-red-900/60 text-red-300',
  };
  const labels: Record<ConnectedDevice['status'], string> = {
    undiscovered: 'Undiscovered',
    discovered:   'Discovered',
    connecting:   'Connecting…',
    connected:    'Connected',
    active:       'Active',
    disconnecting:'Disconnecting…',
    disconnected: 'Disconnected',
    error:        'Error',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Signal bar ───────────────────────────────────────────────────────────────

function SignalBar({ strength }: { strength: number | null }) {
  if (strength === null) return <span className="text-gray-600 text-xs">—</span>;
  const pct = Math.round(strength * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 text-xs">{pct}%</span>
    </div>
  );
}

// ─── Battery bar ──────────────────────────────────────────────────────────────

function BatteryBar({ level }: { level: number | null }) {
  if (level === null) return <span className="text-gray-600 text-xs">—</span>;
  const pct = Math.round(level * 100);
  const color = pct >= 50 ? 'bg-green-500' : pct >= 20 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-400 text-xs">{pct}%</span>
    </div>
  );
}

// ─── Device card ──────────────────────────────────────────────────────────────

function DeviceCard({
  device,
  onConnect,
  onDisconnect,
  isConnecting,
  browserCaps,
}: {
  device: ConnectedDevice;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  isConnecting: boolean;
  browserCaps: ReturnType<DeviceCapabilityEngine['detectBrowserCapabilities']>;
}) {
  const isActive = device.status === 'active' || device.status === 'connected';
  const isConnectingThis = device.status === 'connecting' || isConnecting;
  const canConnect = capEngine.canConnect(device.kind, browserCaps) || device.isSimulated;
  const blockReason = !canConnect ? capEngine.connectionBlockedReason(device.kind, browserCaps) : null;

  const capBadges = [
    device.capabilities.hasCamera && '📷 Camera',
    device.capabilities.hasAudio && (device.capabilities.audioType === 'bone_conduction' ? '🦴 Bone-Cond.' : '🔊 Audio'),
    device.capabilities.hasHaptic && '📳 Haptic',
    device.capabilities.hasIMU && '🧭 IMU',
    device.capabilities.hasBattery && '🔋 Battery',
    device.capabilities.hasGPS && '📍 GPS',
  ].filter(Boolean) as string[];

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
        isActive
          ? 'border-green-700/50 bg-green-950/20'
          : 'border-gray-700 bg-gray-900/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={device.kind}>{device.icon}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">{device.name}</h3>
              {device.isSimulated && (
                <span className="text-xs bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded">SIM</span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{device.description}</p>
          </div>
        </div>
        <StatusBadge status={device.status} />
      </div>

      {/* Capability tags */}
      <div className="flex flex-wrap gap-1.5">
        {capBadges.map((b) => (
          <span key={b} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
            {b}
          </span>
        ))}
      </div>

      {/* Signal / battery */}
      {isActive && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-500 block mb-1">Signal</span>
            <SignalBar strength={device.signalStrength} />
          </div>
          <div>
            <span className="text-gray-500 block mb-1">Battery</span>
            <BatteryBar level={device.batteryLevel} />
          </div>
        </div>
      )}

      {/* Health badge */}
      {isActive && (
        <div className="text-xs">
          <span className="text-gray-500">Health: </span>
          <span className={
            device.health === 'excellent' || device.health === 'good'
              ? 'text-green-400'
              : device.health === 'weak'
                ? 'text-yellow-400'
                : 'text-red-400'
          }>
            {device.health}
          </span>
        </div>
      )}

      {/* Block reason */}
      {blockReason && !device.isSimulated && (
        <p className="text-xs text-yellow-600 bg-yellow-950/30 rounded px-2 py-1">{blockReason}</p>
      )}

      {/* Connect / disconnect */}
      <div className="flex gap-2 mt-1">
        {isActive ? (
          <button
            onClick={() => onDisconnect(device.id)}
            className="text-sm px-4 py-1.5 rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => onConnect(device.id)}
            disabled={isConnectingThis || (!canConnect && !device.isSimulated)}
            className="text-sm px-4 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isConnectingThis ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <button
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors"
          onClick={() => alert(capEngine.setupInstructions(device.kind))}
        >
          Setup
        </button>
      </div>
    </div>
  );
}

// ─── Source selector ──────────────────────────────────────────────────────────

function SourceSelector<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DevicesPage() {
  const {
    devices,
    ioConfig,
    browserCaps,
    lastDisconnectEvent,
    connectDevice,
    disconnectDevice,
    setCameraSource,
    setAudioOutput,
    setHapticOutput,
    connectingId,
    clearDisconnectEvent,
  } = useWearableDevice(false);

  const cameraOptions: { value: CameraSource; label: string }[] = [
    { value: 'phone',             label: '📱 Phone Camera' },
    { value: 'denarixx_glasses',  label: '🥽 Denarixx Vision Glasses' },
    { value: 'bluetooth',         label: '📷 Bluetooth Camera' },
    { value: 'wifi_glasses',      label: '👓 Wi-Fi Glasses' },
    { value: 'usb',               label: '🔌 USB Camera' },
    { value: 'simulation',        label: '🤖 Simulation (no camera)' },
  ];
  const audioOptions: { value: AudioOutput; label: string }[] = [
    { value: 'phone_speaker',   label: '📣 Phone Speaker' },
    { value: 'bone_conduction', label: '🦴 Bone-Conduction Headset' },
    { value: 'bluetooth_audio', label: '🎧 Bluetooth Audio' },
    { value: 'earpiece',        label: '📞 Phone Earpiece' },
  ];
  const hapticOptions: { value: HapticOutput; label: string }[] = [
    { value: 'phone_vibration', label: '📳 Phone Vibration' },
    { value: 'wrist_haptic',    label: '⌚ Haptic Wristband' },
    { value: 'smart_cane',      label: '🦯 Smart Cane' },
    { value: 'none',            label: '🚫 Haptic Disabled' },
  ];

  const activeCount = devices.filter((d) => d.status === 'active' || d.status === 'connected').length;
  const caps = capEngine.describeBrowserCapabilities(browserCaps);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-4xl">🔌</span>
          <div>
            <h1 className="text-3xl font-black text-white">Connected Devices</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              V8 Smart Glasses Integration Layer · {activeCount} of {devices.length} devices active
            </p>
          </div>
        </div>
        <p className="text-gray-500 text-sm mt-3 max-w-2xl">
          Manage camera, audio, and haptic devices. Connect Denarixx Vision Glasses, bone-conduction
          headsets, haptic wristbands, and smart canes. All connections are simulated in Phase 8.
        </p>
      </div>

      {/* Disconnect warning */}
      {lastDisconnectEvent && (
        <div className="mb-6 rounded-xl border border-red-700/50 bg-red-950/30 p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-red-300 font-semibold text-sm">⚠ Device Disconnected</p>
            <p className="text-red-400 text-sm mt-1">{lastDisconnectEvent.safetyMessage}</p>
            {lastDisconnectEvent.fallbackCamera && (
              <p className="text-gray-400 text-xs mt-1">
                Switched to: {bridgeEngine.describeCameraSource(lastDisconnectEvent.fallbackCamera)}
              </p>
            )}
          </div>
          <button
            onClick={clearDisconnectEvent}
            className="text-gray-500 hover:text-white text-xs shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Device cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white">Devices</h2>
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onConnect={connectDevice}
              onDisconnect={disconnectDevice}
              isConnecting={connectingId === device.id}
              browserCaps={browserCaps}
            />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Active I/O sources */}
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5">
            <h2 className="text-lg font-bold text-white mb-4">Active Sources</h2>
            <div className="space-y-4">
              <SourceSelector
                label="Camera Input"
                value={ioConfig.cameraSource}
                options={cameraOptions}
                onChange={setCameraSource}
              />
              <SourceSelector
                label="Audio Output"
                value={ioConfig.audioOutput}
                options={audioOptions}
                onChange={setAudioOutput}
              />
              <SourceSelector
                label="Haptic Output"
                value={ioConfig.hapticOutput}
                options={hapticOptions}
                onChange={setHapticOutput}
              />
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Camera</span>
                <span className="text-yellow-400">{bridgeEngine.describeCameraSource(ioConfig.cameraSource)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Audio</span>
                <span className="text-yellow-400">{bridgeEngine.describeAudioOutput(ioConfig.audioOutput)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Haptic</span>
                <span className="text-yellow-400">{bridgeEngine.describeHapticOutput(ioConfig.hapticOutput)}</span>
              </div>
            </div>
          </div>

          {/* Browser capabilities */}
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5">
            <h2 className="text-sm font-bold text-white mb-3">Browser Capabilities</h2>
            {caps.length === 0 ? (
              <p className="text-gray-600 text-xs">No advanced device APIs detected. Using simulation.</p>
            ) : (
              <ul className="space-y-1">
                {caps.map((c) => (
                  <li key={c} className="text-xs text-green-400 flex items-center gap-1.5">
                    <span className="text-green-600">✓</span> {c}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-600">
                Missing APIs are shown as blocked on device cards. Simulation always works regardless.
              </p>
            </div>
          </div>

          {/* Safety rules */}
          <div className="rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-5">
            <h2 className="text-sm font-bold text-yellow-400 mb-3">⚠ Safety Rules</h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-yellow-500 mt-0.5">✓</span>
                <span>No video storage — frames are never saved to disk or memory</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-yellow-500 mt-0.5">✓</span>
                <span>No face recognition — not enabled on any camera feed</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-yellow-500 mt-0.5">✓</span>
                <span>Disconnect warning — user is warned immediately if a vision device disconnects during a session</span>
              </li>
              <li className="flex items-start gap-2 text-gray-300">
                <span className="text-yellow-500 mt-0.5">✓</span>
                <span>Phone fallback — phone camera is always available as backup</span>
              </li>
            </ul>
          </div>

          {/* Phase indicator */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/20 p-4 text-xs text-gray-600">
            <p className="font-semibold text-gray-500 mb-1">Phase 8 — Simulation Mode</p>
            <p>
              All device connections are simulated. Real Bluetooth, WebUSB, and WebRTC
              integration will activate when hardware becomes available.
            </p>
          </div>

          {/* V14 Multi-Camera System */}
          <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-5">
            <MultiCameraPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
