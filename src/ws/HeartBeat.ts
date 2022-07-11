import { clearInterval } from 'node:timers'

/**
 * @internal
 * Heart Beater.
 */
export class HeartBeat {
  private handler: (...args: unknown[]) => void
  private timer: NodeJS.Timer
  constructor(handler: (...args: unknown[]) => void) {
    this.handler = handler
    this.timer = setTimeout(() => this.ping(), 10000)
  }
  
  public ping(): void {
    this.handler()
    clearInterval(this.timer)
    this.timer = setTimeout(() => this.ping(), 10000)
  }

  public close(): void {
    clearInterval(this.timer)
  }
}
