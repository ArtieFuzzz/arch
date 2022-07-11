import { clearInterval } from 'node:timers'

/**
 * @internal
 * Heart Beater.
 */
export class HeartBeat {
  private handler: (...args: unknown[]) => void
  private timer: NodeJS.Timer
  public interval: number
  constructor(handler: (...args: unknown[]) => void, interval: number) {
    this.interval = interval
    this.handler = handler
    this.timer = setTimeout(() => this.ping(), this.interval * Math.random())
  }
  
  public ping(): void {
    this.handler()
    clearInterval(this.timer)
    this.timer = setTimeout(() => this.ping(), this.interval * Math.random())
  }

  public close(): void {
    clearInterval(this.timer)
  }
}
