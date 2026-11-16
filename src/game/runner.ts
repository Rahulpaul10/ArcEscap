import * as THREE from 'three'
import { bend, geo } from './materials'
import type { Skin } from './progress'

export type RunnerMode = 'idle' | 'run' | 'jump' | 'slide' | 'hit' | 'fall'

export interface PoseInput {
  mode: RunnerMode
  /** 0..1 */
  speedNorm: number
  vx: number
  vy: number
  collect: number
  shield: boolean
  boost: boolean
  invuln: boolean
  /** seconds since mode started (for hit/fall tween) */
  modeTime: number
}

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const m = new THREE.Mesh(geo.box, mat)
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  return m
}

/**
 * Original futuristic courier: swept crest fin, wide shoulder blades, glowing core pack and a flowing
 * energy scarf. The model faces -Z (the run direction).
 */
export class Runner {
  readonly root = new THREE.Group()
  private body = new THREE.Group()
  private head = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  private foreL = new THREE.Group()
  private foreR = new THREE.Group()
  private legL = new THREE.Group()
  private legR = new THREE.Group()
  private shinL = new THREE.Group()
  private shinR = new THREE.Group()
  private scarf: THREE.Group[] = []
  private core: THREE.Mesh
  private bubble: THREE.Mesh
  private suit = bend(new THREE.MeshLambertMaterial({ color: 0x1b2447 }))
  private trim = bend(new THREE.MeshLambertMaterial({ color: 0x0a0f24, emissive: 0x35f2ff }))
  private glow = bend(new THREE.MeshBasicMaterial({ color: 0x35f2ff }))
  private visor = bend(new THREE.MeshBasicMaterial({ color: 0xffffff }))
  private bubbleMat = bend(new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.22, depthWrite: false }))
  private flash = new THREE.Color(0xff3344)
  private base = new THREE.Color()
  private phase = 0

  constructor() {
    const { suit, trim, glow, visor } = this
    this.root.add(this.body)
    this.body.position.y = 0.95

    // torso, chest light, shoulder blades
    this.body.add(box(0.56, 0.68, 0.34, suit, 0, 0.36, 0))
    this.body.add(box(0.38, 0.12, 0.03, glow, 0, 0.5, -0.18))
    this.body.add(box(0.5, 0.1, 0.36, trim, 0, 0.04, 0))
    for (const s of [-1, 1]) {
      const blade = box(0.1, 0.1, 0.34, trim, s * 0.38, 0.72, 0.02)
      blade.rotation.z = -s * 0.5
      this.body.add(blade)
    }
    // core backpack
    this.body.add(box(0.34, 0.44, 0.18, suit, 0, 0.4, 0.26))
    this.core = new THREE.Mesh(geo.sphere, glow)
    this.core.scale.setScalar(0.12)
    this.core.position.set(0, 0.42, 0.37)
    this.body.add(this.core)

    // head
    this.head.position.set(0, 0.86, 0)
    this.body.add(this.head)
    const helmet = new THREE.Mesh(geo.sphere, suit)
    helmet.scale.set(0.23, 0.24, 0.25)
    helmet.position.y = 0.1
    this.head.add(helmet)
    this.head.add(box(0.32, 0.1, 0.12, visor, 0, 0.12, -0.2))
    const fin = box(0.05, 0.3, 0.55, trim, 0, 0.3, 0.14)
    fin.rotation.x = 0.55
    this.head.add(fin)
    const finGlow = box(0.055, 0.04, 0.4, glow, 0, 0.3, 0.14)
    finGlow.rotation.x = 0.55
    this.head.add(finGlow)

    // scarf of energy (chain of ribbons)
    let parent: THREE.Object3D = this.body
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group()
      seg.position.set(0, i === 0 ? 0.74 : 0, i === 0 ? 0.2 : 0.2)
      seg.add(box(0.12, 0.035, 0.22, i % 2 ? glow : trim, 0, 0, 0.1))
      parent.add(seg)
      this.scarf.push(seg)
      parent = seg
    }

    // arms
    for (const [arm, fore, s] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ] as const) {
      arm.position.set(s * 0.37, 0.66, 0)
      arm.add(box(0.14, 0.34, 0.14, suit, 0, -0.17, 0))
      fore.position.set(0, -0.34, 0)
      fore.add(box(0.13, 0.32, 0.13, suit, 0, -0.16, 0))
      fore.add(box(0.15, 0.07, 0.15, glow, 0, -0.3, 0))
      arm.add(fore)
      this.body.add(arm)
    }

    // legs (hip pivots live on the root so they stay at hip height)
    for (const [leg, shin, s] of [
      [this.legL, this.shinL, -1],
      [this.legR, this.shinR, 1],
    ] as const) {
      leg.position.set(s * 0.15, 0.0, 0)
      leg.add(box(0.2, 0.46, 0.2, suit, 0, -0.23, 0))
      shin.position.set(0, -0.46, 0)
      shin.add(box(0.18, 0.4, 0.18, suit, 0, -0.2, 0))
      shin.add(box(0.2, 0.12, 0.32, trim, 0, -0.4, -0.05))
      shin.add(box(0.2, 0.03, 0.32, glow, 0, -0.47, -0.05))
      leg.add(shin)
      this.body.add(leg)
    }

    // shield bubble
    this.bubble = new THREE.Mesh(geo.sphere, this.bubbleMat)
    this.bubble.scale.set(0.95, 1.15, 0.95)
    this.bubble.position.y = 0.95
    this.bubble.visible = false
    this.root.add(this.bubble)
  }

  setSkin(skin: Skin): void {
    this.suit.color.setHex(skin.suit)
    this.trim.emissive.setHex(skin.trim).multiplyScalar(0.7)
    this.glow.color.setHex(skin.glow)
    this.visor.color.setHex(skin.visor)
    this.base.setHex(skin.suit)
  }

  update(dt: number, p: PoseInput): void {
    const t = performance.now() / 1000
    const cadence = 9 + p.speedNorm * 7 + (p.boost ? 3 : 0)
    if (p.mode === 'run') this.phase += dt * cadence
    const ph = this.phase

    let bodyY = 0.95
    let lean = -0.16 - p.speedNorm * 0.1
    let tL = 0
    let tR = 0
    let kL = 0
    let kR = 0
    let aL = 0
    let aR = 0
    let eL = 1.1
    let eR = 1.1
    let headTilt = 0

    switch (p.mode) {
      case 'idle': {
        const b = Math.sin(t * 2) * 0.02
        bodyY = 0.95 + b
        lean = -0.04
        tL = tR = 0.05
        aL = 0.1 + Math.sin(t * 2) * 0.05
        aR = 0.1 - Math.sin(t * 2) * 0.05
        eL = eR = 0.25
        break
      }
      case 'run': {
        const s = Math.sin(ph)
        const c = Math.cos(ph)
        tL = s * 1.0
        tR = -s * 1.0
        kL = -Math.max(0, -c) * 1.5 - 0.1
        kR = -Math.max(0, c) * 1.5 - 0.1
        aL = -s * 0.95
        aR = s * 0.95
        bodyY = 0.95 + Math.abs(Math.sin(ph)) * 0.07 - 0.04
        break
      }
      case 'jump': {
        const rising = p.vy > 0
        tL = rising ? 1.1 : 0.55
        tR = rising ? -0.25 : -0.45
        kL = rising ? -1.4 : -0.5
        kR = rising ? -0.9 : -0.3
        aL = rising ? 2.5 : 1.3
        aR = rising ? 2.3 : 1.1
        eL = eR = 0.3
        lean = rising ? -0.28 : -0.05
        break
      }
      case 'slide': {
        lean = 1.2
        bodyY = 0.5
        tL = tR = -0.1
        kL = kR = -0.2
        aL = aR = -0.9
        eL = eR = 0.2
        headTilt = -0.9
        break
      }
      case 'hit': {
        const k = Math.min(1, p.modeTime / 0.35)
        lean = 0.2 + k * 1.1
        bodyY = 0.95 - k * 0.3
        tL = 0.6
        tR = -0.4
        kL = kR = -0.6
        aL = aR = 2.2 * (1 - k) + 0.4
        eL = eR = 0.4
        headTilt = -0.4 * k
        break
      }
      case 'fall': {
        lean = -0.2 + p.modeTime * 3
        tL = 0.8
        tR = -0.6
        aL = aR = 2.4
        break
      }
    }

    // lane-change roll + collect punch
    const roll = THREE.MathUtils.clamp(p.vx / 9, -1, 1)
    this.root.rotation.y = -roll * 0.22
    this.body.rotation.z = -roll * 0.38
    this.body.rotation.x = lean
    this.body.position.y = bodyY
    this.head.rotation.x = headTilt - lean * 0.45

    this.legL.rotation.x = tL
    this.legR.rotation.x = tR
    this.shinL.rotation.x = kL
    this.shinR.rotation.x = kR
    this.armL.rotation.x = aL
    this.armR.rotation.x = aR + p.collect * 1.7
    this.foreL.rotation.x = eL
    this.foreR.rotation.x = eR + p.collect * 0.4

    // scarf flutter
    const flow = 0.25 + p.speedNorm * 0.5
    this.scarf.forEach((seg, i) => {
      seg.rotation.x = -flow * 0.55 + Math.sin(t * 14 - i * 0.9) * 0.18 * (p.mode === 'idle' ? 0.4 : 1)
      seg.rotation.y = Math.sin(t * 9 - i * 1.1) * 0.22
    })

    // core pulse
    const pulse = 1 + p.collect * 1.8 + Math.sin(t * 6) * 0.1 + (p.boost ? 0.6 : 0)
    this.core.scale.setScalar(0.12 * pulse)

    // shield bubble + damage flash
    this.bubble.visible = p.shield
    if (p.shield) this.bubble.scale.set(0.95, 1.15, 0.95).multiplyScalar(1 + Math.sin(t * 8) * 0.03)
    const blink = p.invuln && Math.floor(t * 18) % 2 === 0
    this.root.visible = !blink || p.mode === 'hit'
    if (p.mode === 'hit') this.suit.color.copy(this.base).lerp(this.flash, Math.max(0, 1 - p.modeTime * 3) * 0.8)
    else this.suit.color.copy(this.base)
  }
}
