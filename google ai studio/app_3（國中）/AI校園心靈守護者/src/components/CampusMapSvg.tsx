interface ZoneData {
  id: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface CampusMapSvgProps {
  zones?: ZoneData[];
}

function getZoneFill(zones: ZoneData[], id: string, defaultFill: string): {fill: string; stroke: string} {
  const zone = zones.find((z) => z.id === id);
  if (!zone) return {fill: defaultFill, stroke: '#9ca3af'};
  const colors = {
    low: {fill: '#dcfce7', stroke: '#86efac'},
    medium: {fill: '#fef9c3', stroke: '#fde047'},
    high: {fill: '#fee2e2', stroke: '#fca5a5'},
  };
  return colors[zone.riskLevel];
}

export function CampusMapSvg({zones = []}: CampusMapSvgProps) {
  const library = getZoneFill(zones, 'zone-library', '#dbeafe');
  const hall = getZoneFill(zones, 'zone-hall', '#d1fae5');
  const field = getZoneFill(zones, 'zone-field', '#fef9c3');
  const classroom = getZoneFill(zones, 'zone-classroom', '#ede9fe');
  const gym = getZoneFill(zones, 'zone-gym', '#fed7aa');

  return (
    <svg
      viewBox="0 0 400 320"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="校園平面示意圖"
    >
      <title>校園安全監控地圖</title>

      <style>{`
        @keyframes pulse-ring {
          0% { r: 12; opacity: 0.8; }
          100% { r: 22; opacity: 0; }
        }
        .risk-pulse { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>

      {/* background */}
      <rect x="0" y="0" width="400" height="320" fill="#f8fafc" />
      {/* subtle grid */}
      <defs>
        <pattern id="campusGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(15,23,42,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="400" height="320" fill="url(#campusGrid)" />

      {/* 圖書館 */}
      <g aria-label="圖書館">
        <rect x="10" y="10" width="100" height="70" rx="8" fill={library.fill} stroke={library.stroke} strokeWidth="1.5" />
        <text x="60" y="43" textAnchor="middle" fontSize="12" fill="#1e40af" fontWeight="700">圖書館</text>
        {/* bookshelf lines */}
        <line x1="22" y1="55" x2="78" y2="55" stroke={library.stroke} strokeWidth="1" />
        <line x1="22" y1="63" x2="78" y2="63" stroke={library.stroke} strokeWidth="1" />
        <line x1="22" y1="71" x2="78" y2="71" stroke={library.stroke} strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-library')?.riskLevel === 'high' && (
          <circle cx="60" cy="45" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 穿堂 */}
      <g aria-label="穿堂">
        <rect x="120" y="10" width="80" height="70" rx="8" fill={hall.fill} stroke={hall.stroke} strokeWidth="1.5" />
        <text x="160" y="49" textAnchor="middle" fontSize="12" fill="#065f46" fontWeight="700">穿堂</text>
        {zones.find((z) => z.id === 'zone-hall')?.riskLevel === 'high' && (
          <circle cx="160" cy="45" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 操場 */}
      <g aria-label="操場">
        <rect x="300" y="10" width="90" height="200" rx="8" fill={field.fill} stroke={field.stroke} strokeWidth="1.5" />
        <text x="345" y="30" textAnchor="middle" fontSize="12" fill="#713f12" fontWeight="700">操場</text>
        {/* running track oval */}
        <ellipse cx="345" cy="118" rx="34" ry="72" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
        <ellipse cx="345" cy="118" rx="20" ry="52" fill="none" stroke="#fde68a" strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-field')?.riskLevel === 'high' && (
          <circle cx="345" cy="118" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 水平走廊 — 連接左側建築與中間 */}
      <g aria-label="走廊">
        <rect x="10" y="88" width="280" height="22" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <text x="145" y="103" textAnchor="middle" fontSize="10" fill="#64748b">走廊</text>
      </g>

      {/* 九年級教室 */}
      <g aria-label="九年級教室">
        <rect x="10" y="118" width="150" height="80" rx="8" fill={classroom.fill} stroke={classroom.stroke} strokeWidth="1.5" />
        <text x="85" y="154" textAnchor="middle" fontSize="12" fill="#4c1d95" fontWeight="700">九年級教室</text>
        {/* desk grid */}
        <rect x="20" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="128" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="20" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="145" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="20" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="42" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="64" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        <rect x="86" y="162" width="16" height="11" rx="2" fill="#c4b5fd" opacity="0.7" />
        {zones.find((z) => z.id === 'zone-classroom')?.riskLevel === 'high' && (
          <circle cx="85" cy="158" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 體育館 */}
      <g aria-label="體育館">
        <rect x="170" y="118" width="120" height="80" rx="8" fill={gym.fill} stroke={gym.stroke} strokeWidth="1.5" />
        <text x="230" y="154" textAnchor="middle" fontSize="12" fill="#7c2d12" fontWeight="700">體育館</text>
        {/* basketball court lines */}
        <rect x="180" y="130" width="100" height="55" rx="2" fill="none" stroke="#f97316" strokeWidth="1.5" />
        <circle cx="230" cy="157" r="14" fill="none" stroke="#f97316" strokeWidth="1.5" />
        <line x1="230" y1="130" x2="230" y2="185" stroke="#f97316" strokeWidth="1" />
        {zones.find((z) => z.id === 'zone-gym')?.riskLevel === 'high' && (
          <circle cx="230" cy="157" r="12" fill="#ef4444" className="risk-pulse" />
        )}
      </g>

      {/* 垂直走廊 — 右側連接 */}
      <g aria-label="右側走廊">
        <rect x="295" y="10" width="5" height="200" rx="2" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />
      </g>

      {/* 下方水平走廊 */}
      <g aria-label="下方走廊">
        <rect x="10" y="206" width="280" height="18" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
        <text x="145" y="219" textAnchor="middle" fontSize="10" fill="#64748b">走廊</text>
      </g>

      {/* 餐廳 / 其他空間 */}
      <g aria-label="餐廳">
        <rect x="10" y="232" width="280" height="60" rx="8" fill="#fce7f3" stroke="#f9a8d4" strokeWidth="1.5" />
        <text x="145" y="266" textAnchor="middle" fontSize="12" fill="#831843" fontWeight="700">餐廳</text>
        {/* table dots */}
        <circle cx="60" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="100" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="140" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="180" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
        <circle cx="220" cy="255" r="10" fill="none" stroke="#f9a8d4" strokeWidth="1.5" />
      </g>

      {/* 操場下方延伸 */}
      <g aria-label="操場延伸">
        <rect x="300" y="218" width="90" height="74" rx="8" fill="#fef9c3" stroke="#fde047" strokeWidth="1.5" />
        <text x="345" y="259" textAnchor="middle" fontSize="10" fill="#92400e">入口</text>
      </g>

      {/* compass rose */}
      <g transform="translate(22,298)">
        <text textAnchor="middle" fontSize="9" fill="#94a3b8" y="-8">北</text>
        <line x1="0" y1="-6" x2="0" y2="6" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="-6" y1="0" x2="6" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
        <polygon points="0,-6 -2,-1 2,-1" fill="#94a3b8" />
      </g>

      {/* scale label */}
      <text x="50" y="314" textAnchor="start" fontSize="8" fill="#94a3b8">示意圖，非按比例</text>
    </svg>
  );
}
