import { GatewayOpcodes } from 'discord-api-types/v10'
import { clearInterval } from 'node:timers'
import type WebSocket from 'ws'

/**
 * @internal
 * Heart Beater.
 */
export class HeartBeat {
  private ws: WebSocket
  private timer: NodeJS.Timer
  constructor(ws: WebSocket) {
    this.ws = ws
    this.timer = setInterval(() => this.ping(), 10000)
  }
  
  public ping(): void {
    return this.ws.send({ op: GatewayOpcodes.Heartbeat, d: null })
  }

  public close(): void {
    clearInterval(this.timer)
  }
}
