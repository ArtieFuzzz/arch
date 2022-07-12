import { request } from '@artiefuzzz/lynx'
import { GatewayCloseCodes, GatewayDispatchEvents, GatewayOpcodes, GatewayPresenceUpdateData, GatewayReceivePayload, GatewayVersion } from 'discord-api-types/gateway/v10'
import EventEmitter from 'node:events'
import * as os from 'node:os'
import WebSocket from 'ws'
import { HeartBeat } from './HeartBeat'

/**
 * @since 1.0.0
 * 
 * Client used to talk to the Discord Gateway
 * 
 * @params token Token used to identify to the Gateway
 */
export class Gateway extends EventEmitter {
  #token: string
  #sessionId?: string
  public seq = 0
  public connected = false
  private beat!: HeartBeat
  private socket!: WebSocket
  constructor(token: string) {
    super()

    this.#token = token
    void this.connect()
  }

  public setPresence(data: GatewayPresenceUpdateData): void {
    this.send({
      op: GatewayOpcodes.PresenceUpdate,
      d: data
    })
  }

  public send(data: unknown): void {
    if (this.connected) {
      return this.socket.send(JSON.stringify(data))
    }

    throw Error('Not Connected to the Discord Gateway')
  }

  public async connect(): Promise<void> {
    const url = await this.gateway()
    this.socket = new WebSocket(url)

    this.socket.onopen = (): void => this.onOpen()
    this.socket.onclose = ({ code }): void => this.onClose(code)
    this.socket.onmessage = ({ data }): void => this.onMessage(data as unknown as GatewayReceivePayload)
  }

  /* @internal */
  private onOpen(): void {
    setTimeout(() => {
      if (!this.connected) {
        // eslint-disable-next-line camelcase
        this.onMessage({ op: GatewayOpcodes.Hello, t: null, s: null, d: { heartbeat_interval: 10000 } })
      }
    }, 10000)
  }

  /* @internal */
  private onMessage(data: GatewayReceivePayload): void {
    if (data.s) {
      this.seq = data.s
    }

    /* eslint-disable  camelcase */
    // eslint-disable-next-line default-case
    switch (data.op) {
      case GatewayOpcodes.Hello: {
        this.connected = true

        this.beat = new HeartBeat(() => {
          this.send({
            op: GatewayOpcodes.Heartbeat,
            d: this.seq
          })
        }, data.d.heartbeat_interval)

        if (this.#sessionId) {
          this.send({
            seq: this.seq,
            op: GatewayOpcodes.Reconnect,
            d: {
              token: this.#token,
              seq: this.seq,
              session_id: this.#sessionId
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
                browser: 'arch',
                device: 'arch'
              }
            }
          })
        }

        return
      }
      case GatewayOpcodes.InvalidSession: {
        this.emit('warn', 'Gateway Session is Invalid... Reconnecting')
        void this.reconnect()

        return
      }
      case GatewayOpcodes.Reconnect: {
        void this.reconnect()

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

  /* @internal */
  private onClose(code: number): void {
    if (code >= 4000 && code <= 4999) {
      let reconnect = false

      switch (code) {
        case GatewayCloseCodes.UnknownError:
          this.emit('error', 'Discord Closed the WebSocket, We have no clue why!')
          reconnect = true
          break
        case GatewayCloseCodes.UnknownOpcode:
        case GatewayCloseCodes.DecodeError:
        case GatewayCloseCodes.NotAuthenticated:
        case GatewayCloseCodes.AlreadyAuthenticated: {
          reconnect = true
          break
        }
        case GatewayCloseCodes.InvalidAPIVersion:
        case GatewayCloseCodes.InvalidIntents:
        case GatewayCloseCodes.InvalidShard:
        case GatewayCloseCodes.AuthenticationFailed:
        case GatewayCloseCodes.ShardingRequired:
        case GatewayCloseCodes.DisallowedIntents: {
          break
        }
        case GatewayCloseCodes.SessionTimedOut: {
          this.emit('error', 'The WebSocket was closed by Discord, Reconnecting...')
          reconnect = true
          break
        }
        case GatewayCloseCodes.InvalidSeq: {
          this.#sessionId = undefined
          reconnect = true
          break
        }
        default: {
          break
        }
      }

      if (reconnect) {
        return void this.reconnect()
      }

      this.emit('error', `Error Code: ${code}`)
    }
  }

  /**
   * Reconnect to the gateway
   */
  public async reconnect(): Promise<void> {
    this.close()
    await this.connect()
  }

  /**
   * Stops the Socket and Heartbeater
   */
  public close(): void {
    this.socket.close()
    this.beat.close()
  }

  /**
   * Gateway URL
   */
  public async gateway(): Promise<string> {
    // * @todo Use ETF instead of JSON
    const req = await request<{ url: string }>(`https://discord.com/api/gateway?v=${GatewayVersion}&encoding=json`)
      .send()

    const { url } = req.json

    return url
  }
}
