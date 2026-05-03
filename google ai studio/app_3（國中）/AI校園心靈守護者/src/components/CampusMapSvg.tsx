import type React from 'react';
import type {ZoneSensorReading} from '../types';

interface ZoneData {
  id: string;
  riskLevel: 'low' | 'medium' | 'high';
  sensor?: ZoneSensorReading;
}

interface CampusMapSvgProps {
  zones?: ZoneData[];
  selectedZoneId?: string | null;
  onZoneClick?: (zoneId: string) => void;
}

type RiskLevel = ZoneData['riskLevel'];

interface ZoneLayout {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

const ZONE_LAYOUTS: ZoneLayout[] = [
  {id: 'zone-library', label: '圖書館', x: 20, y: 20, w: 160, h: 140, rx: 12},
  {id: 'zone-hall', label: '穿堂', x: 210, y: 20, w: 120, h: 140, rx: 12},
  {id: 'zone-field', label: '操場', x: 355, y: 20, w: 105, h: 300, rx: 14},
];

type ZoneStyle = {fill: string; stroke: string};
const ZONE_STYLES: Record<string, Record<RiskLevel, ZoneStyle>> = {
  'zone-library': {
    low:    {fill: '#eff6ff', stroke: '#93c5fd'},
    medium: {fill: '#eff6ff', stroke: '#f59e0b'},
    high:   {fill: '#fff1f2', stroke: '#f87171'},
  },
  'zone-hall': {
    low:    {fill: '#f0fdf4', stroke: '#6ee7b7'},
    medium: {fill: '#f0fdf4', stroke: '#f59e0b'},
    high:   {fill: '#fff1f2', stroke: '#f87171'},
  },
  'zone-field': {
    low:    {fill: '#fff7ed', stroke: '#fb923c'},
    medium: {fill: '#ffedd5', stroke: '#f97316'},
    high:   {fill: '#fee2e2', stroke: '#ef4444'},
  },
};
const RISK_STYLES: Record<RiskLevel, ZoneStyle> = {
  low:    {fill: '#f0fdfa', stroke: '#2dd4bf'},
  medium: {fill: '#fffbeb', stroke: '#fbbf24'},
  high:   {fill: '#fff1f2', stroke: '#f87171'},
};

function getZoneData(zones: ZoneData[], zoneId: string) {
  return zones.find((zone) => zone.id === zoneId);
}

function formatTemperature(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '--.-';
}

function formatHumidity(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toString() : '--';
}

function SensorBadge({sensor, x, y}: {sensor?: ZoneSensorReading; x: number; y: number}) {
  if (!sensor?.connected) return null;

  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width="104" height="28" rx="14" fill="#1e293b" opacity="0.85" />
      <circle cx={x + 14} cy={y + 14} r="4" fill="#34d399">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={x + 25} y={y + 18} fontSize="11" fontWeight="700" fill="#ffffff">
        {`T: ${formatTemperature(sensor.temp)}° H: ${formatHumidity(sensor.hum)}%`}
      </text>
    </g>
  );
}

function SelectionRing({zone}: {zone: ZoneLayout}) {
  return (
    <rect
      x={zone.x - 6}
      y={zone.y - 6}
      width={zone.w + 12}
      height={zone.h + 12}
      rx={zone.rx + 6}
      stroke="#0d9488"
      strokeWidth="2"
      fill="none"
      strokeDasharray="6 3"
    >
      <animate attributeName="strokeDashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
    </rect>
  );
}

function ZoneDecoration({zone}: {zone: ZoneLayout}) {
  if (zone.id === 'zone-library') {
    return (
      <g pointerEvents="none" aria-hidden="true">
        {[56, 86, 116, 146].map((x) => (
          <line
            key={x}
            x1={x}
            y1={zone.y + 24}
            x2={x}
            y2={zone.y + zone.h - 24}
            stroke="#64748b"
            strokeWidth="1"
            opacity="0.15"
          />
        ))}
      </g>
    );
  }

  if (zone.id === 'zone-hall') {
    return (
      <path
        pointerEvents="none"
        aria-hidden="true"
        d="M 232 118 Q 270 78 308 118"
        stroke="#64748b"
        strokeWidth="1"
        fill="none"
        opacity="0.12"
      />
    );
  }

  return (
    <ellipse
      pointerEvents="none"
      aria-hidden="true"
      cx={zone.x + zone.w / 2}
      cy={zone.y + zone.h / 2}
      rx="35"
      ry="115"
      stroke="#64748b"
      strokeWidth="1"
      fill="none"
      opacity="0.18"
    />
  );
}

function CompassRose() {
  return (
    <g transform="translate(28 330)" aria-hidden="true">
      <line x1="0" y1="-16" x2="0" y2="16" stroke="#64748b" strokeWidth="1.2" />
      <line x1="-16" y1="0" x2="16" y2="0" stroke="#64748b" strokeWidth="1.2" />
      <path d="M 0 -20 L -4 -10 L 0 -13 L 4 -10 Z" fill="#0d9488" />
      <text x="0" y="-24" textAnchor="middle" fontSize="9" fontWeight="800" fill="#475569">
        N
      </text>
      <text x="0" y="30" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">
        S
      </text>
      <text x="23" y="3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">
        E
      </text>
      <text x="-23" y="3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">
        W
      </text>
    </g>
  );
}

export function CampusMapSvg({zones = [], selectedZoneId, onZoneClick}: CampusMapSvgProps) {
  const handleClick = (zoneId: string) => () => onZoneClick?.(zoneId);
  const handleKeyDown = (zoneId: string) => (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onZoneClick?.(zoneId);
    }
  };

  return (
    <svg viewBox="0 0 480 360" className="absolute inset-0 h-full w-full" role="application" aria-label="校園安全監控地圖">
      <title>校園安全監控地圖</title>
      <defs>
        <pattern id="campus-map-dots" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.8" fill="#94a3b8" opacity="0.15" />
        </pattern>
        <filter id="zone-high-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <style>{`
        .zone-clickable { cursor: pointer; }
        .zone-bg { transition: opacity 0.12s ease; }
        .zone-clickable:hover .zone-bg { opacity: 0.86; }
        .zone-clickable:focus-visible { outline: none; }
      `}</style>

      <rect width="480" height="360" fill="#edf4fb" />
      <rect width="480" height="360" fill="url(#campus-map-dots)" />

      {ZONE_LAYOUTS.map((zone) => {
        const zoneData = getZoneData(zones, zone.id);
        const riskLevel = zoneData?.riskLevel ?? 'low';
        const riskStyle = (ZONE_STYLES[zone.id] ?? RISK_STYLES)[riskLevel];
        const isSelected = zone.id === selectedZoneId;
        const badgeX = Math.min(zone.x + zone.w - 112, Math.max(zone.x + 10, zone.x + zone.w / 2 - 52));
        const badgeY = zone.id === 'zone-field' ? zone.y + zone.h - 46 : zone.y + zone.h - 42;

        return (
          <g
            key={zone.id}
            role="button"
            tabIndex={0}
            aria-label={zone.label}
            className="zone-clickable"
            onClick={handleClick(zone.id)}
            onKeyDown={handleKeyDown(zone.id)}
          >
            {riskLevel === 'high' && (
              <rect
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.h}
                rx={zone.rx}
                fill="#f87171"
                opacity="0.15"
                filter="url(#zone-high-glow)"
                aria-hidden="true"
              />
            )}
            {isSelected && <SelectionRing zone={zone} />}
            <rect
              className="zone-bg"
              x={zone.x}
              y={zone.y}
              width={zone.w}
              height={zone.h}
              rx={zone.rx}
              fill={riskStyle.fill}
              stroke={riskStyle.stroke}
              strokeWidth="2"
            />
            <ZoneDecoration zone={zone} />
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 + 5}
              textAnchor="middle"
              fontWeight="800"
              fontSize="14"
              fill="#1e293b"
            >
              {zone.label}
            </text>
            <SensorBadge sensor={zoneData?.sensor} x={badgeX} y={badgeY} />
          </g>
        );
      })}

      <CompassRose />
      <text x="470" y="354" textAnchor="end" fontSize="9" fontStyle="italic" fill="#94a3b8">
        示意圖，非按比例
      </text>
    </svg>
  );
}
