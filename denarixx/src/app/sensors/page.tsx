'use client';
import { useState, useEffect } from 'react';
import {
  initializeAllSensors,
  activateAllSensors,
  setErrorState,
  restartSensor,
  buildSensorFusionFrame,
  buildSensorStatusSummary,
  detectSensorAnomalies,
  updateSensorInList,
  ALL_SENSOR_TYPES,
} from '@/engines/glassesOSSensorEngine';
import type { GlassesOSSensor, SensorType } from '@/types/glassesOS';

const SENSOR_LABEL: Record<SensorType, string> = {
  'camera-front':      'Front Camera',
  'camera-side-left':  'Left Camera',
  'camera-side-right': 'Right Camera',
  'gps':               'GPS',
  'imu':               'IMU (Motion)',
  'compass':           'Compass',
  'microphone-left':   'Left Mic',
  'microphone-right':  'Right Mic',
  'temperature':       'Temp Sensor',
  'battery-sensor':    'Battery Sensor',
};

const SENSOR_GROUP: Record<string, SensorType[]> = {
  'Cameras':     ['camera-front', 'camera-side-left', 'camera-side-right'],
  'Location':    ['gps', 'compass'],
  'Motion':      ['imu'],
  'Audio':       ['microphone-left', 'microphone-right'],
  'Environment': ['temperature', 'battery-sensor'],
};

const STATUS_STYLE: Record<string, string> = {
  active:       'border-green-600/40 bg-green-900/10 text-green-300',
  initializing: 'border-blue-600/40 bg-blue-900/10 text-blue-300',
  degraded:     'border-yellow-600/40 bg-yellow-900/10 text-yellow-300',
  error:        'border-red-600/40 bg-red-900/10 text-red-300',
  inactive:     'border-gray-700/40 bg-gray-800/20 text-gray-500',
};

const QUALITY_STYLE: Record<string, string> = {
  high:     'text-green-400',
  medium:   'text-yellow-400',
  low:      'text-orange-400',
  degraded: 'text-red-400',
};

export default function SensorsPage() {
  const [tick, setTick] = useState(0);
  const [sensors, setSensors] = useState<GlassesOSSensor[]>(() =>
    activateAllSensors(initializeAllSensors(0), 1)
  );

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const frame = buildSensorFusionFrame(sensors, tick);
  const summary = buildSensorStatusSummary(sensors);
  const anomalies = detectSensorAnomalies(sensors);

  function triggerError(type: SensorType) {
    setSensors(prev => {
      const s = prev.find(x => x.type === type);
      if (!s) return prev;
      return updateSensorInList(prev, setErrorState(s, tick));
    });
  }

  function triggerRestart(type: SensorType) {
    setSensors(prev => {
      const s = prev.find(x => x.type === type);
      if (!s) return prev;
      return updateSensorInList(prev, restartSensor(s, tick));
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Glasses Sensor Array</h1>
          <p className="text-gray-400 text-sm">
            10 sensors on the Denarixx Vision Glasses hardware. All safety sensing is local —
            no phone or cloud required.
          </p>
        </div>

        {/* Fusion Frame */}
        <div className="mb-6 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Sensor Fusion Frame</h2>
            <span className={`text-sm font-bold capitalize ${QUALITY_STYLE[frame.fusionQuality]}`}>
              {frame.fusionQuality.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {[
              { label: 'Vision', active: frame.hasVisionInput },
              { label: 'Location', active: frame.hasLocationInput },
              { label: 'Motion', active: frame.hasMotionInput },
              { label: 'Audio', active: frame.hasAudioInput },
              { label: `${summary.active}/${summary.total} active`, active: summary.allCriticalActive },
            ].map(({ label, active }) => (
              <div key={label} className={`rounded-lg border px-3 py-2 text-center ${
                active ? 'border-green-600/40 bg-green-900/10 text-green-300' : 'border-red-600/40 bg-red-900/10 text-red-400'
              }`}>
                {active ? '✓' : '✗'} {label}
              </div>
            ))}
          </div>
          {anomalies.length > 0 && (
            <div className="mt-3 space-y-1">
              {anomalies.map((a, i) => (
                <div key={i} className="text-xs text-yellow-300 flex gap-1">
                  <span>⚠</span><span>{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sensor Groups */}
        {Object.entries(SENSOR_GROUP).map(([group, types]) => (
          <div key={group} className="mb-4 rounded-xl border border-gray-700/50 bg-gray-800/30 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">{group}</h2>
            <div className="space-y-2">
              {types.map(type => {
                const sensor = sensors.find(s => s.type === type);
                if (!sensor) return null;
                return (
                  <div key={type} className={`rounded-lg border p-3 ${STATUS_STYLE[sensor.status]}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{SENSOR_LABEL[type]}</span>
                          {sensor.isCritical && <span className="text-xs opacity-60">(critical)</span>}
                        </div>
                        <div className="text-xs opacity-60 mt-0.5">
                          conf: {(sensor.confidence * 100).toFixed(0)}% ·
                          errors: {sensor.errorCount} ·
                          restarts: {sensor.restartCount}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800/40 capitalize">
                          {sensor.status}
                        </span>
                        {sensor.status === 'active' ? (
                          <button
                            onClick={() => triggerError(type)}
                            className="text-xs px-2 py-0.5 rounded border border-red-600/40 text-red-300 hover:bg-red-900/20"
                          >
                            Fault
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerRestart(type)}
                            className="text-xs px-2 py-0.5 rounded border border-blue-600/40 text-blue-300 hover:bg-blue-900/20"
                          >
                            Restart
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
