'use client';

/**
 * SpatialMapPanel (V6)
 *
 * SVG-based bird's-eye live spatial map showing:
 *   - User (yellow triangle at bottom-centre, pointing up = forward)
 *   - Detected objects as coloured dots with labels
 *   - Safe walking corridor (green band)
 *   - Risk zones (red/orange)
 *   - Predicted movement vectors
 *   - Path recommendation action
 */

import type { WorldModelSnapshot, SpatialObject } from '@/types/spatial';

interface SpatialMapPanelProps {
  snapshot: WorldModelSnapshot | null;
  isActive: boolean;
}

// ─── Map layout constants (SVG viewport 320×260) ──────────────────────────────

const W = 320;
const H = 260;
const USER_X = W / 2;
const USER_Y = H - 28;
const METRES_TO_PX = 14; // 1 metre = 14 pixels
const MAX_DISTANCE_SHOWN = 16; // metres

// Convert world coordinates → SVG pixels
function worldToSvg(
  distanceMetres: number,
  lateralOffset: number
): { x: number; y: number } {
  const clampedDist = Math.min(distanceMetres, MAX_DISTANCE_SHOWN);
  const y = USER_Y - clampedDist * METRES_TO_PX;
  const x = USER_X + lateralOffset * (W / 2 - 20);
  return { x: Math.max(10, Math.min(W - 10, x)), y: Math.max(10, Math.min(H - 10, y)) };
}

// ─── Colour palette by type ───────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  person: '#f59e0b',      // amber
  vehicle: '#ef4444',     // red
  bicycle: '#fb923c',     // orange
  animal: '#a78bfa',      // violet
  furniture: '#94a3b8',   // gray
  landmark: '#34d399',    // green
  obstacle: '#f87171',    // red-light
  other: '#64748b',       // slate
};

function objectColor(obj: SpatialObject): string {
  return TYPE_COLOR[obj.type] ?? '#94a3b8';
}

function urgencyColor(urgency: string): string {
  if (urgency === 'immediate') return '#ef4444';
  if (urgency === 'soon') return '#f59e0b';
  return '#34d399';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserMarker() {
  return (
    <g aria-label="Your position">
      {/* Shadow */}
      <ellipse cx={USER_X} cy={USER_Y + 2} rx={8} ry={3} fill="rgba(0,0,0,0.4)" />
      {/* Triangle pointing up */}
      <polygon
        points={`${USER_X},${USER_Y - 12} ${USER_X - 8},${USER_Y + 4} ${USER_X + 8},${USER_Y + 4}`}
        fill="#facc15"
        stroke="#000"
        strokeWidth={1}
      />
      <text x={USER_X} y={USER_Y + 14} textAnchor="middle" fill="#facc15" fontSize={8} fontWeight="bold">
        YOU
      </text>
    </g>
  );
}

function SafeCorridor({ corridorWidthPx }: { corridorWidthPx: number }) {
  const half = corridorWidthPx / 2;
  return (
    <rect
      x={USER_X - half}
      y={10}
      width={corridorWidthPx}
      height={USER_Y - 10}
      fill="rgba(52,211,153,0.12)"
      stroke="rgba(52,211,153,0.35)"
      strokeWidth={1}
      strokeDasharray="4 3"
      rx={4}
    />
  );
}

function ObjectDot({ obj }: { obj: SpatialObject }) {
  const { x, y } = worldToSvg(obj.distanceMetres, obj.lateralOffset);
  const color = objectColor(obj);
  const r = obj.type === 'vehicle' ? 7 : 5;
  const shortLabel = obj.label.slice(0, 6);

  return (
    <g aria-label={`${obj.label} at ${obj.distanceMetres.toFixed(1)}m`}>
      {/* Pulse ring for moving objects */}
      {obj.isMoving && (
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth={1} opacity={0.4} />
      )}
      <circle cx={x} cy={y} r={r} fill={color} stroke="#000" strokeWidth={0.5} opacity={0.9} />
      {/* Movement arrow */}
      {obj.isMoving && obj.movementDir === 'toward' && (
        <line
          x1={x}
          y1={y - r}
          x2={x}
          y2={y - r - 8}
          stroke={color}
          strokeWidth={1.5}
          markerEnd="url(#arrow)"
        />
      )}
      {/* Label */}
      <text x={x} y={y + r + 8} textAnchor="middle" fill="white" fontSize={7.5}>
        {shortLabel}
      </text>
      {/* Distance label */}
      <text x={x} y={y + r + 16} textAnchor="middle" fill="#94a3b8" fontSize={6.5}>
        {obj.distanceMetres.toFixed(1)}m
      </text>
    </g>
  );
}

function ActionLabel({ action, urgency }: { action: string; urgency: string }) {
  const color = urgencyColor(urgency);
  const actionText = action.replace(/_/g, ' ').toUpperCase();
  return (
    <g>
      <rect x={8} y={8} width={120} height={18} rx={4} fill="rgba(0,0,0,0.5)" />
      <circle cx={18} cy={17} r={4} fill={color} />
      <text x={28} y={20} fill={color} fontSize={9} fontWeight="bold">
        {actionText}
      </text>
    </g>
  );
}

function DistanceGrid() {
  const lines = [4, 8, 12]; // metre intervals
  return (
    <g opacity={0.2}>
      {lines.map((d) => {
        const y = USER_Y - d * METRES_TO_PX;
        return (
          <g key={d}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="#64748b" strokeWidth={0.5} strokeDasharray="3 4" />
            <text x={4} y={y - 2} fill="#64748b" fontSize={7}>{d}m</text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SpatialMapPanel({ snapshot, isActive }: SpatialMapPanelProps) {
  const urgency = snapshot?.recommendation.urgency ?? 'advisory';
  const corridorPx = snapshot
    ? Math.max(20, Math.min(W - 60, snapshot.corridor.widthMetres * METRES_TO_PX * 3))
    : W * 0.4;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
        <h3 className="text-sm font-bold text-white">🗺 Spatial Map</h3>
        <div className="flex items-center gap-2">
          {snapshot && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                urgency === 'immediate'
                  ? 'bg-red-900/60 text-red-300 border border-red-700'
                  : urgency === 'soon'
                  ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700'
                  : 'bg-green-900/60 text-green-300 border border-green-700'
              }`}
            >
              {snapshot
                ? snapshot.corridor.clearanceMetres >= 10
                  ? 'Clear'
                  : `${Math.round(snapshot.corridor.clearanceMetres)}m ahead`
                : '—'}
            </span>
          )}
          {!isActive && (
            <span className="text-xs text-gray-600">Awaiting session</span>
          )}
        </div>
      </div>

      {/* SVG map */}
      <div className="relative bg-gray-950">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          aria-label="Bird's-eye spatial map of surroundings"
          role="img"
        >
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
            </marker>
          </defs>

          {/* Background */}
          <rect width={W} height={H} fill="#0a0f1a" />

          {/* Distance grid */}
          <DistanceGrid />

          {/* Forward direction line */}
          <line
            x1={USER_X}
            y1={USER_Y - 10}
            x2={USER_X}
            y2={20}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="6 4"
          />

          {/* Safe corridor */}
          <SafeCorridor corridorWidthPx={corridorPx} />

          {/* Objects */}
          {snapshot?.objects.map((obj) => (
            <ObjectDot key={obj.id} obj={obj} />
          ))}

          {/* User */}
          <UserMarker />

          {/* Action label */}
          {snapshot && (
            <ActionLabel
              action={snapshot.recommendation.action}
              urgency={snapshot.recommendation.urgency}
            />
          )}

          {/* Object count */}
          {snapshot && (
            <text x={W - 6} y={H - 6} textAnchor="end" fill="#374151" fontSize={7}>
              {snapshot.objects.length} object{snapshot.objects.length !== 1 ? 's' : ''}
            </text>
          )}

          {/* No-data placeholder */}
          {!snapshot && (
            <text x={W / 2} y={H / 2} textAnchor="middle" fill="#374151" fontSize={11}>
              {isActive ? 'Scanning…' : 'Start session to see map'}
            </text>
          )}
        </svg>
      </div>

      {/* Instruction strip */}
      {snapshot && (
        <div
          className="px-4 py-2 border-t border-gray-800 text-xs text-gray-300"
          aria-live="polite"
          aria-label={`Navigation: ${snapshot.recommendation.instruction}`}
        >
          <span className="text-gray-500 mr-1.5">Nav:</span>
          {snapshot.recommendation.instruction}
        </div>
      )}

      {/* Landmark strip */}
      {snapshot && snapshot.landmarks.length > 0 && (
        <div className="px-4 py-1.5 border-t border-gray-800 flex flex-wrap gap-2">
          {snapshot.landmarks.slice(0, 4).map((lm) => (
            <span
              key={lm.id}
              className="text-xs text-green-400 bg-green-950/40 border border-green-800/50 rounded-full px-2 py-0.5"
              title={`${lm.label} — ${lm.distanceMetres.toFixed(1)}m ${lm.direction}`}
            >
              {lm.label}
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap gap-3 text-xs text-gray-500">
        {[
          { color: '#facc15', label: 'You' },
          { color: '#f59e0b', label: 'Person' },
          { color: '#ef4444', label: 'Vehicle' },
          { color: '#34d399', label: 'Landmark' },
          { color: '#94a3b8', label: 'Obstacle' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
