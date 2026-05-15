// Emotion heatmap: campus zones × time periods
// Demo mode: randomly updates one cell every 12s to simulate live monitoring

import {useEffect, useRef, useState} from 'react';
import type React from 'react';

const ZONES = ['圖書館', '穿堂', '操場', '教室', '廁所'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

const BASE_DATA: number[][] = [
  [85, 82, 79, 80, 88, 90, 86],
  [70, 75, 65, 68, 72, 74, 71],
  [90, 92, 88, 91, 86, 89, 93],
  [78, 74, 70, 72, 75, 78, 76],
  [60, 58, 62, 55, 64, 66, 61],
];

const LEGEND_ITEMS = [
  {label: '≥85 優良', color: '#d1fae5'},
  {label: '75-84 良好', color: '#d9f99d'},
  {label: '65-74 普通', color: '#fef9c3'},
  {label: '55-64 需關注', color: '#fed7aa'},
  {label: '<55 高風險', color: '#fecaca'},
] as const;

const LIVE_DOT: React.CSSProperties = {width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite'};
const LIVE_LABEL: React.CSSProperties = {fontSize: 10, fontWeight: 700, color: '#6b7280'};
const TH_ZONE: React.CSSProperties = {width: 58, padding: '4px 3px', textAlign: 'left', color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap'};
const TH_TIME: React.CSSProperties = {padding: '4px 1px', color: '#6b7280', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap'};
const TD_ZONE: React.CSSProperties = {padding: '4px 3px', fontWeight: 700, color: '#374151', whiteSpace: 'nowrap'};
const LEGEND_ROW: React.CSSProperties = {marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap'};
const LEGEND_ITEM: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: 4};
const LEGEND_SWATCH: React.CSSProperties = {width: 12, height: 12, borderRadius: 2};
const LEGEND_TEXT: React.CSSProperties = {fontSize: 10, color: '#6b7280', fontWeight: 600};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function scoreToColor(score: number): string {
  if (score >= 85) return '#d1fae5';
  if (score >= 75) return '#d9f99d';
  if (score >= 65) return '#fef9c3';
  if (score >= 55) return '#fed7aa';
  return '#fecaca';
}

function scoreToBorder(score: number): string {
  if (score >= 85) return '#6ee7b7';
  if (score >= 75) return '#a3e635';
  if (score >= 65) return '#fde047';
  if (score >= 55) return '#fb923c';
  return '#f87171';
}

export function EmotionHeatmap() {
  const [data, setData] = useState(() => BASE_DATA.map((row) => [...row]));
  const [flashCell, setFlashCell] = useState<[number, number] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const zi = Math.floor(Math.random() * ZONES.length);
      const ti = Math.floor(Math.random() * TIME_SLOTS.length);
      const delta = Math.round((Math.random() - 0.5) * 10);
      setData((prev) => {
        const next = prev.map((row) => [...row]);
        next[zi][ti] = clamp(next[zi][ti] + delta, 40, 98);
        return next;
      });
      setFlashCell([zi, ti]);
      setTimeout(() => setFlashCell(null), 800);
      timerRef.current = setTimeout(tick, 12000 + Math.random() * 4000);
    }
    timerRef.current = setTimeout(tick, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div style={{overflowX: 'auto'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6}}>
        <span style={LIVE_DOT} />
        <span style={LIVE_LABEL}>即時監測中</span>
      </div>
      <table style={{borderCollapse: 'separate', borderSpacing: 2, width: '100%', tableLayout: 'fixed', fontSize: 10}}>
        <thead>
          <tr>
            <th style={TH_ZONE}>區域</th>
            {TIME_SLOTS.map((t) => (
              <th key={t} style={TH_TIME}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONES.map((zone, zi) => (
            <tr key={zone}>
              <td style={TD_ZONE}>{zone}</td>
              {data[zi].map((score, ti) => {
                const isFlashing = flashCell?.[0] === zi && flashCell?.[1] === ti;
                return (
                  <td
                    key={ti}
                    title={`${zone} ${TIME_SLOTS[ti]}: ${score}`}
                    style={{
                      padding: '5px 1px',
                      textAlign: 'center',
                      backgroundColor: isFlashing ? '#bfdbfe' : scoreToColor(score),
                      border: `1px solid ${isFlashing ? '#3b82f6' : scoreToBorder(score)}`,
                      borderRadius: 4,
                      fontWeight: 600,
                      color: '#374151',
                      minWidth: 0,
                      transition: 'background-color 0.5s ease, border-color 0.5s ease',
                    }}
                  >
                    {score}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={LEGEND_ROW}>
        {LEGEND_ITEMS.map(({label, color}) => (
          <div key={label} style={LEGEND_ITEM}>
            <div style={{...LEGEND_SWATCH, backgroundColor: color}} />
            <span style={LEGEND_TEXT}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
