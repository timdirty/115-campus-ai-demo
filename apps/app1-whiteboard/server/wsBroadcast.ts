// Decoupled WebSocket broadcast module.
// serialBridge.ts calls setBroadcast() once on startup;
// other server modules call broadcast() any time.

export type WsEvent =
  | {type: 'arduino_status'; connected: boolean; port: string; simulated: boolean}
  | {type: 'command_ack'; command: string; ok: boolean; response?: string}
  | {type: 'sensor_snapshot'; temp: number | null; hum: number | null; light: number | null}
  | {type: 'robot_reset'; message: string; at: number};

let _broadcast: (event: WsEvent) => void = () => {};

export function setBroadcast(fn: (event: WsEvent) => void): void {
  _broadcast = fn;
}

export function broadcast(event: WsEvent): void {
  _broadcast(event);
}
