import {memo, useCallback} from 'react';
import type React from 'react';

interface ZoneData {
  id: string;
  riskLevel: 'low' | 'medium' | 'high';
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
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
}

const ZONE_LAYOUTS: ZoneLayout[] = [
  {id: 'zone-library',  label: '圖書館・閱讀角', sublabel: 'Library / Reading',   x: 18,  y: 16, w: 162, h: 148, rx: 14},
  {id: 'zone-hall',    label: '穿堂',   sublabel: 'Hall',      x: 202, y: 16, w: 128, h: 148, rx: 14},
  {id: 'zone-field',   label: '操場',   sublabel: 'Field',     x: 352, y: 16, w: 108, h: 308, rx: 14},
];

const ZONE_FILL: Record<string, Record<RiskLevel, {bg: string; border: string; glow: string}>> = {
  'zone-library': {
    low:    {bg: '#e8f4fd', border: '#93c5fd', glow: 'rgba(147,197,253,0)'},
    medium: {bg: '#fef9ec', border: '#fbbf24', glow: 'rgba(251,191,36,0.15)'},
    high:   {bg: '#fef2f2', border: '#f87171', glow: 'rgba(248,113,113,0.2)'},
  },
  'zone-hall': {
    low:    {bg: '#ecfdf5', border: '#6ee7b7', glow: 'rgba(110,231,183,0)'},
    medium: {bg: '#fef9ec', border: '#fbbf24', glow: 'rgba(251,191,36,0.15)'},
    high:   {bg: '#fef2f2', border: '#f87171', glow: 'rgba(248,113,113,0.2)'},
  },
  'zone-field': {
    low:    {bg: '#ecfdf5', border: '#6ee7b7', glow: 'rgba(110,231,183,0)'},
    medium: {bg: '#fef9ec', border: '#fbbf24', glow: 'rgba(251,191,36,0.15)'},
    high:   {bg: '#fef2f2', border: '#f87171', glow: 'rgba(248,113,113,0.2)'},
  },
};

function getZoneData(zones: ZoneData[], id: string) {
  return zones.find((z) => z.id === id);
}

function SelectionRing({zone}: {zone: ZoneLayout}) {
  return (
    <rect
      x={zone.x - 5} y={zone.y - 5}
      width={zone.w + 10} height={zone.h + 10}
      rx={zone.rx + 5}
      stroke="#0d9488" strokeWidth="2" fill="none" strokeDasharray="6 3"
    >
      <animate attributeName="strokeDashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
    </rect>
  );
}

/* ── Zone-specific architectural decoration ── */
function LibraryDecoration({zone}: {zone: ZoneLayout}) {
  const {x, y, w, h} = zone;
  return (
    <g pointerEvents="none" aria-hidden="true" opacity="0.55">
      {/* roof ridge line */}
      <line x1={x + 10} y1={y + 28} x2={x + w - 10} y2={y + 28} stroke="#94a3b8" strokeWidth="1" />
      {/* bookshelf verticals */}
      {[32, 58, 84, 110, 136].map((dx) => (
        <line key={dx} x1={x + dx} y1={y + 36} x2={x + dx} y2={y + h - 32} stroke="#cbd5e1" strokeWidth="0.8" />
      ))}
      {/* shelf horizontals */}
      {[55, 82, 109].map((dy) => (
        <line key={dy} x1={x + 18} y1={y + dy} x2={x + w - 18} y2={y + dy} stroke="#cbd5e1" strokeWidth="0.8" />
      ))}
      {/* entrance door arch */}
      <path d={`M ${x + w/2 - 12} ${y + h - 18} L ${x + w/2 - 12} ${y + h - 30} Q ${x + w/2} ${y + h - 38} ${x + w/2 + 12} ${y + h - 30} L ${x + w/2 + 12} ${y + h - 18}`} stroke="#64748b" strokeWidth="1" fill="none" />
    </g>
  );
}

function HallDecoration({zone}: {zone: ZoneLayout}) {
  const {x, y, w, h} = zone;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g pointerEvents="none" aria-hidden="true" opacity="0.5">
      {/* arched ceiling */}
      <path d={`M ${x + 14} ${y + 22} Q ${cx} ${y + 8} ${x + w - 14} ${y + 22}`} stroke="#94a3b8" strokeWidth="1" fill="none" />
      {/* column lines */}
      {[x + 22, x + w - 22].map((lx) => (
        <line key={lx} x1={lx} y1={y + 26} x2={lx} y2={y + h - 22} stroke="#cbd5e1" strokeWidth="1.2" />
      ))}
      {/* walkway center */}
      <line x1={cx} y1={y + 14} x2={cx} y2={y + h - 14} stroke="#cbd5e1" strokeWidth="0.6" strokeDasharray="4 4" />
      {/* arch rings */}
      {[36, 72, 108].map((dy) => (
        <path key={dy} d={`M ${x + 30} ${y + dy} Q ${cx} ${y + dy - 10} ${x + w - 30} ${y + dy}`} stroke="#94a3b8" strokeWidth="0.6" fill="none" />
      ))}
    </g>
  );
}

function FieldDecoration({zone}: {zone: ZoneLayout}) {
  const {x, y, w, h} = zone;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g pointerEvents="none" aria-hidden="true" opacity="0.45">
      {/* running track oval */}
      <ellipse cx={cx} cy={cy} rx={w / 2 - 10} ry={h / 2 - 18} stroke="#4ade80" strokeWidth="1.2" fill="none" />
      <ellipse cx={cx} cy={cy} rx={w / 2 - 22} ry={h / 2 - 36} stroke="#86efac" strokeWidth="0.7" fill="none" />
      {/* center circle */}
      <circle cx={cx} cy={cy} r="14" stroke="#4ade80" strokeWidth="0.8" fill="none" />
      {/* center spot */}
      <circle cx={cx} cy={cy} r="3" fill="#4ade80" opacity="0.5" />
      {/* halfway lines */}
      <line x1={x + 12} y1={cy} x2={x + w - 12} y2={cy} stroke="#4ade80" strokeWidth="0.6" />
    </g>
  );
}

/* ── Ambient trees ── */
function Tree({cx, cy, r = 7}: {cx: number; cy: number; r?: number}) {
  return (
    <g aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="#4ade80" opacity="0.35" />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="#22c55e" opacity="0.4" />
    </g>
  );
}

/* ── Path / corridor ── */
function Corridor() {
  return (
    <g aria-hidden="true">
      {/* horizontal connector between library and hall */}
      <rect x={180} y={68} width={22} height={32} rx="4" fill="#e2e8f0" opacity="0.7" />
      {/* horizontal connector between hall and field */}
      <rect x={330} y={68} width={22} height={32} rx="4" fill="#e2e8f0" opacity="0.7" />
      {/* bottom walkway */}
      <rect x={18} y={172} width={444} height={14} rx="4" fill="#e2e8f0" opacity="0.5" />
    </g>
  );
}

/* ── Alert glow ── */
function AlertGlow({zone}: {zone: ZoneLayout}) {
  return (
    <rect
      x={zone.x - 4} y={zone.y - 4}
      width={zone.w + 8} height={zone.h + 8}
      rx={zone.rx + 4}
      fill="#f87171" opacity="0.12"
    >
      <animate attributeName="opacity" values="0.08;0.22;0.08" dur="1.4s" repeatCount="indefinite" />
    </rect>
  );
}

/* ── Compass ── */
function CompassRose() {
  return (
    <g transform="translate(28 315)" aria-hidden="true">
      <circle cx={0} cy={0} r={18} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" opacity="0.85" />
      <line x1="0" y1="-13" x2="0" y2="13" stroke="#94a3b8" strokeWidth="1" />
      <line x1="-13" y1="0" x2="13" y2="0" stroke="#94a3b8" strokeWidth="1" />
      <path d="M 0 -18 L -4 -8 L 0 -11 L 4 -8 Z" fill="#0d9488" />
      <text x="0" y="-21" textAnchor="middle" fontSize="8" fontWeight="800" fill="#475569">N</text>
      <text x="0" y="29" textAnchor="middle" fontSize="7" fontWeight="700" fill="#94a3b8">S</text>
      <text x="20" y="3" textAnchor="middle" fontSize="7" fontWeight="700" fill="#94a3b8">E</text>
      <text x="-20" y="3" textAnchor="middle" fontSize="7" fontWeight="700" fill="#94a3b8">W</text>
    </g>
  );
}

export const CampusMapSvg = memo(function CampusMapSvg({zones = [], selectedZoneId, onZoneClick}: CampusMapSvgProps) {
  const handleClick = useCallback((zoneId: string) => () => onZoneClick?.(zoneId), [onZoneClick]);
  const handleKeyDown = useCallback((zoneId: string) => (event: React.KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onZoneClick?.(zoneId); }
  }, [onZoneClick]);

  return (
    <svg viewBox="0 0 480 340" className="absolute inset-0 h-full w-full" role="application" aria-label="校園安全監控地圖">
      <title>校園安全監控地圖</title>
      <defs>
        {/* ground texture */}
        <pattern id="map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#cbd5e1" strokeWidth="0.3" opacity="0.4" />
        </pattern>
        <pattern id="grass-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="0.6" fill="#4ade80" opacity="0.25" />
        </pattern>
        {/* shadow filter */}
        <filter id="bld-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.10" />
        </filter>
        <filter id="high-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        {/* zone bg gradient  */}
        <linearGradient id="libGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#eff6ff" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="hallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="fieldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcfce7" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f0fdf4" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* sky-blue campus ground */}
      <rect width="480" height="340" fill="#f0f7ff" />
      <rect width="480" height="340" fill="url(#map-grid)" />

      {/* grass areas */}
      <rect x="0" y="192" width="480" height="148" fill="#f0fdf4" opacity="0.6" />
      <rect x="0" y="192" width="480" height="148" fill="url(#grass-dots)" />

      {/* school boundary wall */}
      <rect x="6" y="6" width="468" height="328" rx="18" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.4" />

      {/* building label: 校園全區 */}
      <text x="240" y="216" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8" opacity="0.55" letterSpacing="4">校園全區</text>

      {/* Corridors / paths */}
      <Corridor />

      {/* Trees outside zones */}
      <Tree cx={80}  cy={220} r={8} />
      <Tree cx={130} cy={240} r={6} />
      <Tree cx={200} cy={225} r={7} />
      <Tree cx={280} cy={235} r={9} />
      <Tree cx={340} cy={220} r={6} />
      <Tree cx={420} cy={240} r={8} />
      <Tree cx={50}  cy={280} r={6} />
      <Tree cx={440} cy={285} r={7} />
      <Tree cx={170} cy={270} r={5} />
      <Tree cx={370} cy={270} r={6} />

      {/* Zones */}
      {ZONE_LAYOUTS.map((zone) => {
        const zData   = getZoneData(zones, zone.id);
        const risk    = zData?.riskLevel ?? 'low';
        const style   = ZONE_FILL[zone.id]?.[risk] ?? {bg: '#f8fafc', border: '#cbd5e1', glow: 'rgba(0,0,0,0)'};
        const isSelected = zone.id === selectedZoneId;

        const gradId = zone.id === 'zone-library' ? 'libGrad' : zone.id === 'zone-hall' ? 'hallGrad' : 'fieldGrad';

        return (
          <g
            key={zone.id}
            role="button"
            tabIndex={0}
            aria-label={zone.label}
            className="zone-clickable cursor-pointer"
            onClick={handleClick(zone.id)}
            onKeyDown={handleKeyDown(zone.id)}
          >
            {/* alert glow */}
            {risk === 'high' && <AlertGlow zone={zone} />}

            {/* selection ring */}
            {isSelected && <SelectionRing zone={zone} />}

            {/* building base shadow */}
            <rect x={zone.x + 2} y={zone.y + 4} width={zone.w} height={zone.h} rx={zone.rx} fill="#0f172a" opacity="0.06" />

            {/* building body — gradient fill + risk border */}
            <rect
              x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx={zone.rx}
              fill={risk === 'low' ? `url(#${gradId})` : style.bg}
              stroke={style.border}
              strokeWidth={risk === 'high' ? 2.5 : isSelected ? 2 : 1.5}
              filter="url(#bld-shadow)"
              style={{transition: 'stroke 0.25s ease'}}
            />

            {/* inner light stripe at top (roof highlight) */}
            <rect x={zone.x + 6} y={zone.y + 6} width={zone.w - 12} height={16} rx={8} fill="#ffffff" opacity="0.45" />

            {/* zone-specific decoration */}
            {zone.id === 'zone-library' && <LibraryDecoration zone={zone} />}
            {zone.id === 'zone-hall'    && <HallDecoration zone={zone} />}
            {zone.id === 'zone-field'   && <FieldDecoration zone={zone} />}

            {/* zone name */}
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 - 4}
              textAnchor="middle"
              fontWeight="800"
              fontSize="15"
              fill="#1e293b"
              style={{userSelect: 'none'}}
            >
              {zone.label}
            </text>
            <text
              x={zone.x + zone.w / 2}
              y={zone.y + zone.h / 2 + 12}
              textAnchor="middle"
              fontWeight="600"
              fontSize="9"
              fill="#64748b"
              letterSpacing="1.5"
              style={{userSelect: 'none'}}
            >
              {zone.sublabel.toUpperCase()}
            </text>

            {/* risk badge */}
            {risk !== 'low' && (
              <g>
                <rect x={zone.x + zone.w / 2 - 20} y={zone.y + 8} width={40} height={14} rx={7} fill={risk === 'high' ? '#f87171' : '#fbbf24'} opacity="0.9" />
                <text x={zone.x + zone.w / 2} y={zone.y + 18} textAnchor="middle" fontSize="8" fontWeight="800" fill="#fff">
                  {risk === 'high' ? '警戒' : '注意'}
                </text>
              </g>
            )}

          </g>
        );
      })}

      {/* Compass */}
      <CompassRose />

      {/* map note */}
      <text x="470" y="336" textAnchor="end" fontSize="8" fontStyle="italic" fill="#94a3b8" opacity="0.6">
        示意圖
      </text>

      <style>{`
        .zone-clickable:hover rect:nth-child(4) { opacity: 0.85; }
        .zone-clickable:focus-visible { outline: none; }
      `}</style>
    </svg>
  );
});
