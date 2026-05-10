import { motion } from 'motion/react';
import { Activity, Droplets, Thermometer, Wind } from 'lucide-react';

const DEMO_SENSORS = {
  temp: 26.8,
  hum: 62,
  aqi: 42,
};

export function EnvMonitorCard() {
  const lastUpdated = new Date();

  return (
    <div className="flex items-center gap-2 flex-wrap px-1">
      {[
        { icon: Thermometer, val: `${DEMO_SENSORS.temp}°C`,  label: '溫度', warn: DEMO_SENSORS.temp > 35 },
        { icon: Droplets,    val: `${DEMO_SENSORS.hum}%`,    label: '濕度', warn: DEMO_SENSORS.hum  > 85 },
        { icon: Wind,        val: `AQI ${DEMO_SENSORS.aqi}`, label: '空氣', warn: DEMO_SENSORS.aqi  > 100 },
        { icon: Activity,    val: '良好', label: '通風', warn: false },
      ].map(s => (
        <motion.button
          key={s.label}
          whileTap={{ scale: 0.94 }}
          onClick={() => {}}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-sm font-bold transition-all ${s.warn ? 'bg-error/10 border-error/30 text-error' : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-primary/40'}`}
        >
          <s.icon size={14} className="shrink-0" />
          <span>{s.val}</span>
        </motion.button>
      ))}
      <span className="ml-auto text-[10px] text-on-surface-variant/40 font-mono font-bold">
        更新 {lastUpdated.getHours().toString().padStart(2, '0')}:{lastUpdated.getMinutes().toString().padStart(2, '0')}
      </span>
    </div>
  );
}
