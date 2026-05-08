import type {HardwareSocketStatus} from '../hooks/useHardwareSocket';

interface Props {
  status: HardwareSocketStatus;
}

export function HardwareStatusBanner({status}: Props) {
  const color = status.connected
    ? (status.simulated ? '#f59e0b' : '#22c55e')
    : '#ef4444';

  return (
    <div
      aria-hidden="true"
      style={{
        height: 4,
        backgroundColor: color,
        width: '100%',
        position: 'sticky',
        top: 0,
        zIndex: 60,
        transition: 'background-color 0.6s ease',
        flexShrink: 0,
      }}
    />
  );
}
