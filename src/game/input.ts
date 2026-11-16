import type { Action } from './types'

const SWIPE_PX = 26

/** Swipe + keyboard input. Swipes fire as soon as the threshold is crossed, so controls feel instant. */
export class Input {
  private sx = 0
  private sy = 0
  private active = false
  private pid = -1

  constructor(
    private el: HTMLElement,
    private onAction: (a: Action) => void,
  ) {
    el.addEventListener('pointerdown', this.down)
    el.addEventListener('pointermove', this.move)
    el.addEventListener('pointerup', this.up)
    el.addEventListener('pointercancel', this.up)
    window.addEventListener('keydown', this.key)
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.down)
    this.el.removeEventListener('pointermove', this.move)
    this.el.removeEventListener('pointerup', this.up)
    this.el.removeEventListener('pointercancel', this.up)
    window.removeEventListener('keydown', this.key)
  }

  private down = (e: PointerEvent) => {
    this.active = true
    this.pid = e.pointerId
    this.sx = e.clientX
    this.sy = e.clientY
  }

  private move = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.pid) return
    const dx = e.clientX - this.sx
    const dy = e.clientY - this.sy
    if (Math.abs(dx) < SWIPE_PX && Math.abs(dy) < SWIPE_PX) return
    if (Math.abs(dx) > Math.abs(dy)) this.onAction(dx > 0 ? 'right' : 'left')
    else this.onAction(dy < 0 ? 'jump' : 'slide')
    // re-anchor so chained swipes work without lifting the finger
    this.sx = e.clientX
    this.sy = e.clientY
  }

  private up = (e: PointerEvent) => {
    if (e.pointerId === this.pid) this.active = false
  }

  private key = (e: KeyboardEvent) => {
    if (e.repeat) return
    const k = e.key
    let a: Action | null = null
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') a = 'left'
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') a = 'right'
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') a = 'jump'
    else if (k === 'ArrowDown' || k === 's' || k === 'S') a = 'slide'
    else if (k === 'p' || k === 'P' || k === 'Escape') a = 'pause'
    if (a) {
      e.preventDefault()
      this.onAction(a)
    }
  }
}
