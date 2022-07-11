import { GatewayOpcodes, GatewayReceivePayload, GatewayVersion } from 'discord-api-types/gateway/v10'
import EventEmitter from 'node:events'
import * as os from 'node:os'
import WebSocket from 'ws'
import { HeartBeat } from './HeartBeat'

/**
 * @since 1.0.0
 * 
 * @params token Token used to identify to the Gateway
 */
export class Gateway extends EventEmitter {
  #token: string
  gotHello = false
  private beat!: HeartBeat
  private socket!: WebSocket
  constructor(token: string) {
    super()

    this.#token = token
    this.connect()
  }

  private send(data: unknown): void {
    return this.socket.send(data)
  }

  public connect(): void {
    this.socket = new WebSocket(this.gateway)

    this.socket.onopen = (): void => this.onOpen()
    this.socket.onclose = (): void => this.onClose()
    this.socket.onmessage = ({ data }): void => this.onMessage(data as unknown as GatewayReceivePayload)
  }

  private onOpen(): void {
    setTimeout(() => {
      if (!this.gotHello) {
        // eslint-disable-next-line camelcase
        this.onMessage({ op: GatewayOpcodes.Hello, t: null, s: null, d: { heartbeat_interval: 2505 } })
      }
    })
  }

  private onClose(): void {
    this.socket.close()
    this.beat.close()
  }

  private onMessage(data: GatewayReceivePayload): void {
    switch (data.op) {
      case GatewayOpcodes.Hello: {
        this.beat = new HeartBeat(this.socket)

        this.send({
          op: GatewayOpcodes.Identify,
          d: {
            token: this.#token,
            intents: 513,
            properties: {
              os: os.platform(),
              browser: 'Arch Wrapper',
              device: 'Arch Wrapper'
            }
          }
        })
        break
      }

      default: {
        break
      }
    }
  }

  private get gateway(): string {
    return `https://discord.com/api/gateway?v=${GatewayVersion}&encoding=json`
  }
}
