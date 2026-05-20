import {useCallback, useEffect, useMemo, useState} from 'react';
import { motion } from 'motion/react';
import { Activity, CloudSun, Droplets, Gauge, MapPin, RefreshCw, Thermometer, Wind } from 'lucide-react';
import {fetchLocalWeather, type LocalWeatherSnapshot} from '../../services/localWeather';

const DEMO_SENSORS = {
  temp: 26.8,
  hum: 62,
  aqi: 42,
};

function formatTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function aqiLabel(aqi: number | null) {
  if (aqi == null) return 'AQI --';
  if (aqi <= 50) return `AQI ${aqi}`;
  if (aqi <= 100) return `AQI ${aqi}`;
  return `AQI ${aqi}`;
}

function ventilationLabel(weather: LocalWeatherSnapshot | null) {
  if (!weather) return '良好';
  if (weather.aqi != null && weather.aqi > 100) return '關窗';
  if (weather.windSpeed >= 18 || weather.precipitation > 0) return '留意';
  return '良好';
}

export function EnvMonitorCard() {
  const [weather, setWeather] = useState<LocalWeatherSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [errorText, setErrorText] = useState('');

  const loadWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('fallback');
      setErrorText('定位不可用');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setErrorText('');
    navigator.geolocation.getCurrentPosition(
      position => {
        void fetchLocalWeather(position.coords.latitude, position.coords.longitude, controller.signal)
          .then(snapshot => {
            setWeather(snapshot);
            setStatus('ready');
          })
          .catch(() => {
            setStatus('fallback');
            setErrorText('氣象更新失敗');
          });
      },
      () => {
        setStatus('fallback');
        setErrorText('定位未授權');
      },
      {enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 9000},
    );

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanup = loadWeather();
    return cleanup;
  }, [loadWeather]);

  const items = useMemo(() => {
    const temp = weather?.temperature ?? DEMO_SENSORS.temp;
    const hum = weather?.humidity ?? DEMO_SENSORS.hum;
    const aqi = weather?.aqi ?? DEMO_SENSORS.aqi;
    return [
      { icon: Thermometer, val: `${temp}°C`,  label: '溫度', warn: temp > 35 },
      { icon: Droplets,    val: `${hum}%`,    label: '濕度', warn: hum > 85 },
      { icon: Gauge,       val: aqiLabel(weather?.aqi ?? DEMO_SENSORS.aqi), label: '空氣', warn: aqi > 100 },
      { icon: Wind,        val: weather ? `${weather.windSpeed} km/h` : ventilationLabel(null), label: weather ? '風速' : '通風', warn: Boolean(weather && weather.windSpeed >= 25) },
    ];
  }, [weather]);

  const lastUpdated = weather?.fetchedAt ? formatTime(weather.fetchedAt) : formatTime(new Date());
  const sourceLabel = status === 'ready' && weather ? '現在地真實氣候' : status === 'loading' ? '定位中' : (errorText || '示範感測');

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex min-h-10 min-w-0 items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-on-surface ring-1 ring-outline-variant/20">
          <CloudSun size={16} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-black leading-tight">{weather?.conditionLabel ?? sourceLabel}</p>
            <p className="flex items-center gap-1 truncate text-[10px] font-bold text-on-surface-variant">
              <MapPin size={10} className="shrink-0" />
              {weather?.label ?? '現在地'}
            </p>
          </div>
        </div>

        {items.map(s => (
          <motion.button
            key={s.label}
            whileTap={{ scale: 0.94 }}
            onClick={() => {}}
            className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-all ${s.warn ? 'bg-error/10 border-error/30 text-error' : 'bg-surface-container-lowest border-outline-variant/25 text-on-surface hover:border-primary/40'}`}
            title={s.label}
          >
            <s.icon size={14} className="shrink-0" />
            <span>{s.val}</span>
          </motion.button>
        ))}

        <motion.button
          whileTap={{scale: 0.94}}
          onClick={loadWeather}
          className="ml-auto flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2 text-[10px] font-black text-on-surface-variant transition-all hover:border-primary/40 hover:text-primary"
        >
          <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : ''} />
          更新 {lastUpdated}
        </motion.button>
      </div>

      {weather && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-on-surface-variant">
          <span className="rounded-lg bg-surface-container-lowest px-2 py-1">體感 {weather.apparentTemperature}°C</span>
          <span className="rounded-lg bg-surface-container-lowest px-2 py-1">降雨 {weather.precipitation} mm</span>
          <span className="rounded-lg bg-surface-container-lowest px-2 py-1">PM2.5 {weather.pm25 ?? '--'}</span>
          <span className="rounded-lg bg-surface-container-lowest px-2 py-1">通風 {ventilationLabel(weather)}</span>
        </div>
      )}

      {!weather && status === 'fallback' && (
        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-on-surface-variant">
          <Activity size={12} />
          <span>{sourceLabel} · 更新 {lastUpdated}</span>
        </div>
      )}
    </div>
  );
}
