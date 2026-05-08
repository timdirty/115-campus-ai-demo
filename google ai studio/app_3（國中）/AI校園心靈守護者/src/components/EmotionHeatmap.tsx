// Static emotion heatmap: campus zones × time periods
// Color intensity represents emotional health score (higher = better)

const ZONES = ['圖書館', '穿堂', '操場', '教室', '廁所'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

// Demo data: score 0-100, higher = healthier emotional state
const DEMO_DATA: number[][] = [
  [85, 82, 79, 80, 88, 90, 86],  // 圖書館
  [70, 75, 65, 68, 72, 74, 71],  // 穿堂
  [90, 92, 88, 91, 86, 89, 93],  // 操場
  [78, 74, 70, 72, 75, 78, 76],  // 教室
  [60, 58, 62, 55, 64, 66, 61],  // 廁所
];

function scoreToColor(score: number): string {
  if (score >= 85) return '#d1fae5';  // emerald-100
  if (score >= 75) return '#d9f99d';  // lime-200
  if (score >= 65) return '#fef9c3';  // yellow-100
  if (score >= 55) return '#fed7aa';  // orange-200
  return '#fecaca';                   // red-200
}

function scoreToBorder(score: number): string {
  if (score >= 85) return '#6ee7b7';
  if (score >= 75) return '#a3e635';
  if (score >= 65) return '#fde047';
  if (score >= 55) return '#fb923c';
  return '#f87171';
}

export function EmotionHeatmap() {
  return (
    <div style={{overflowX: 'auto'}}>
      <table style={{borderCollapse: 'collapse', width: '100%', minWidth: 360, fontSize: 11}}>
        <thead>
          <tr>
            <th style={{padding: '4px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap'}}>區域 / 時段</th>
            {TIME_SLOTS.map((t) => (
              <th key={t} style={{padding: '4px 6px', color: '#6b7280', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap'}}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone, zi) => (
            <tr key={zone}>
              <td style={{padding: '4px 8px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap'}}>{zone}</td>
              {DEMO_DATA[zi].map((score, ti) => (
                <td
                  key={ti}
                  title={`${zone} ${TIME_SLOTS[ti]}: ${score}`}
                  style={{
                    padding: '6px',
                    textAlign: 'center',
                    backgroundColor: scoreToColor(score),
                    border: `1px solid ${scoreToBorder(score)}`,
                    borderRadius: 4,
                    fontWeight: 600,
                    color: '#374151',
                    minWidth: 36,
                  }}
                >
                  {score}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
        {[
          {label: '≥85 優良', color: '#d1fae5'},
          {label: '75-84 良好', color: '#d9f99d'},
          {label: '65-74 普通', color: '#fef9c3'},
          {label: '55-64 需關注', color: '#fed7aa'},
          {label: '<55 高風險', color: '#fecaca'},
        ].map(({label, color}) => (
          <div key={label} style={{display: 'flex', alignItems: 'center', gap: 4}}>
            <div style={{width: 12, height: 12, backgroundColor: color, borderRadius: 2}} />
            <span style={{fontSize: 10, color: '#6b7280', fontWeight: 600}}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
