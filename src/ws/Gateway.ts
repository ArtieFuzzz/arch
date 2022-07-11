import { GatewayCloseCodes, GatewayDispatchEvents, GatewayOpcodes, GatewayReceivePayload, GatewayVersion } from 'discord-api-types/gateway/v10'
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
  #sessionId?: string
  public seq = 0
  public gotHello = false
  private beat!: HeartBeat
  private socket!: WebSocket
  constructor(token: string) {
    super()

    this.#token = token
    this.connect()
  }

  public send(data: unknown): void {
    return this.socket.send(data)
  }

  public connect(): void {
    this.socket = new WebSocket(this.gateway)

    this.socket.onopen = (): void => this.onOpen()
    this.socket.onclose = ({ code }): void => this.onClose(code)
    this.socket.onmessage = ({ data }): void => this.onMessage(data as unknown as GatewayReceivePayload)
  }

  private onOpen(): void {
    setTimeout(() => {
      if (!this.gotHello) {
        // eslint-disable-next-line camelcase
        this.onMessage({ op: GatewayOpcodes.Hello, t: null, s: null, d: { heartbeat_interval: 10000 } })
      }
    })
  }

  private onMessage(data: GatewayReceivePayload): void {
    if (data.s) {
      this.seq = data.s
    }

    // eslint-disable-next-line default-case
    switch (data.op) {
      case GatewayOpcodes.Hello: {
        this.beat = new HeartBeat(() => this.send({ op: GatewayOpcodes.Heartbeat, d: this.seq }), data.d.heartbeat_interval)

        if (this.#sessionId) {
          this.send({
            seq: this.seq,
            op: GatewayOpcodes.Reconnect,
            d: {
              token: this.#token,
            }
          })
        } else {
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
        }

        return
      }
      case GatewayOpcodes.InvalidSession: {
        this.emit('warn', 'Gateway Session is Invalid... Reconnecting')
        this.reconnect()

        return
      }
      case GatewayOpcodes.Reconnect: {
        this.reconnect()

        return
      }
      case GatewayOpcodes.Dispatch: {
        if (data.t === GatewayDispatchEvents.Ready) {
          this.#sessionId = data.d.session_id
        }

        this.emit(data.t, data.d)

        return
      }
      case GatewayOpcodes.HeartbeatAck: {
        this.emit('ack', true)

        return
      }
      case GatewayOpcodes.Heartbeat: {
        return this.beat.ping()
      }
    }
  }

  private onClose(code: number): void {
    if (code >= 4000 && code <= 4999) {
      let reconnect = false
      switch (code) {
        case GatewayCloseCodes.UnknownError:
          console.error('WebSocket closed by Discord. We\'re not sure what went wrong.')
          reconnect = true
          break
        case GatewayCloseCodes.UnknownOpcode:
        case GatewayCloseCodes.DecodeError:
        case GatewayCloseCodes.NotAuthenticated:
        case GatewayCloseCodes.AlreadyAuthenticated:
          reconnect = true
          break
        case GatewayCloseCodes.InvalidAPIVersion:
        case GatewayCloseCodes.InvalidIntents:
        case GatewayCloseCodes.InvalidShard:
        case GatewayCloseCodes.AuthenticationFailed:
        case GatewayCloseCodes.ShardingRequired:
        case GatewayCloseCodes.DisallowedIntents:
          break
        case GatewayCloseCodes.SessionTimedOut:
          console.error('WebSocket closed by Discord. Attempting to reconnect...')
          reconnect = true
          break
        case GatewayCloseCodes.InvalidSeq:
          this.#sessionId = undefined
          reconnect = true
          break
        default:
          break
      }

      if (reconnect) {
        this.reconnect()
      }

      this.emit('error', `Error Code: ${code}`)
    }
  }

  public reconnect(): void {
    this.close()
    this.connect()
  }


  public close(): void {
    this.socket.close()
    this.beat.close()
  }

  public get gateway(): string {
    return `https://discord.com/api/gateway?v=${GatewayVersion}&encoding=json`
  }
}
