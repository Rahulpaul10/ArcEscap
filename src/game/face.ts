import * as THREE from 'three'
import { irisTexture } from './bodyparts'
import { geo } from './materials'

export type Expression = 'happy' | 'run' | 'excited' | 'worried' | 'ouch'
export interface MoodCfg {
  lid: number
  brow: number
  smile: number
  blush: number
  grin: boolean
}

const irisTex = irisTexture()

/**
 * Stylised realistic face: sclera + painted iris, skin eyelids that really close, tapered brows, nose,
 * two-part lips with corners, an open-mouth cavity with teeth, and soft cheek colour.
 * Parts are built in head-local space (skull radius ~0.3).
 */
export class Face {
  readonly irisMat: THREE.MeshBasicMaterial
  readonly lipMat: THREE.MeshStandardMaterial
  private eyes: { grp: THREE.Group; lid: THREE.Mesh; iris: THREE.Mesh; lash: THREE.Mesh }[] = []
  private browL: THREE.Mesh
  private browR: THREE.Mesh
  private upper: THREE.Mesh
  private lower: THREE.Mesh
  private corners: THREE.Mesh[] = []
  private cavity: THREE.Mesh
  private teeth: THREE.Mesh
  private blush: THREE.Mesh[] = []
  private mood: MoodCfg = { lid: 1, brow: 0, smile: 1, blush: 1, grin: false }
  private eyeScale = 1
  private blinkT = 2
  private blinkLeft = 0
  private open = 1
  private browY = 0.325
  private browTilt = 0
  private smile = 0.5
  private mouth = 0
  private gaze = 0

  constructor(head: THREE.Object3D, skin: THREE.Material, brow: THREE.Material, wrap: <T extends THREE.Material>(m: T) => T) {
    this.irisMat = wrap(new THREE.MeshBasicMaterial({ map: irisTex, color: 0x2fb6ff }))
    this.lipMat = wrap(new THREE.MeshStandardMaterial({ color: 0xc86a6a, roughness: 0.4, metalness: 0 }))
    const white = wrap(new THREE.MeshStandardMaterial({ color: 0xf4f1ee, roughness: 0.3 }))
    const dark = wrap(new THREE.MeshBasicMaterial({ color: 0x2a0a12 }))
    const tooth = wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }))
    const blushMat = wrap(new THREE.MeshBasicMaterial({ color: 0xe8788a, transparent: true, opacity: 0.32, depthWrite: false }))
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: [number, number, number], s: [number, number, number]) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(...p)
      o.scale.set(...s)
      head.add(o)
      return o
    }

    for (const s of [-1, 1]) {
      const grp = new THREE.Group()
      grp.position.set(s * 0.105, 0.225, -0.245)
      const ball = new THREE.Mesh(geo.sphere, white)
      ball.scale.set(0.058, 0.05, 0.05)
      grp.add(ball)
      const iris = new THREE.Mesh(new THREE.CircleGeometry(1, 20), this.irisMat)
      iris.scale.setScalar(0.037)
      iris.position.z = -0.0505
      iris.rotation.y = Math.PI
      grp.add(iris)
      head.add(grp)
      // eyelid: a skin dome that slides over the eye
      const lid = new THREE.Mesh(geo.sphere, skin)
      lid.scale.set(0.066, 0.056, 0.056)
      lid.position.set(s * 0.105, 0.29, -0.243)
      head.add(lid)
      const lash = new THREE.Mesh(geo.box, brow)
      lash.scale.set(0.078, 0.007, 0.012)
      lash.position.set(s * 0.105, 0.26, -0.294)
      lash.visible = false
      head.add(lash)
      this.eyes.push({ grp, lid, iris, lash })
    }
    this.browL = mesh(geo.box, brow, [-0.105, 0.325, -0.238], [0.1, 0.018, 0.022])
    this.browR = mesh(geo.box, brow, [0.105, 0.325, -0.238], [0.1, 0.018, 0.022])
    mesh(geo.sphere, skin, [0, 0.185, -0.272], [0.026, 0.05, 0.03])
    mesh(geo.sphere, skin, [0, 0.133, -0.286], [0.031, 0.026, 0.032])
    for (const s of [-1, 1]) {
      mesh(geo.sphere, skin, [s * 0.286, 0.19, 0.02], [0.034, 0.062, 0.03]) // ears
      const b = mesh(geo.sphere, blushMat, [s * 0.16, 0.14, -0.232], [0.045, 0.028, 0.01])
      b.rotation.y = s * 0.7
      this.blush.push(b)
    }
    this.cavity = mesh(geo.sphere, dark, [0, 0.078, -0.244], [0.036, 0.004, 0.012])
    this.teeth = mesh(geo.box, tooth, [0, 0.088, -0.247], [0.05, 0.011, 0.006])
    this.upper = mesh(geo.sphere, this.lipMat, [0, 0.088, -0.25], [0.045, 0.011, 0.017])
    this.lower = mesh(geo.sphere, this.lipMat, [0, 0.067, -0.249], [0.04, 0.013, 0.019])
    for (const s of [-1, 1]) this.corners.push(mesh(geo.sphere, this.lipMat, [s * 0.05, 0.078, -0.24], [0.009, 0.009, 0.01]))
    for (const o of head.children) o.traverse((m) => ((m as THREE.Mesh).castShadow = false))
  }

  setProfile(eyeScale: number, mood: MoodCfg, irisColor: number, lipColor: number, lashes = false): void {
    this.eyeScale = eyeScale
    this.mood = mood
    this.irisMat.color.setHex(irisColor)
    this.lipMat.color.setHex(lipColor)
    for (const e of this.eyes) {
      e.grp.scale.setScalar(eyeScale)
      e.lash.visible = lashes
    }
    this.blush.forEach((b) => b.scale.set(0.045 * mood.blush, 0.028 * Math.min(1.4, mood.blush), 0.01))
  }

  /** gazeX in -1..1 nudges the irises toward what the runner is looking at */
  update(expr: Expression, dt: number, gazeX = 0): void {
    const m = this.mood
    this.blinkT -= dt
    if (this.blinkT <= 0) {
      this.blinkT = 2 + Math.random() * 3.2
      this.blinkLeft = 0.14
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt)
    const openT = expr === 'ouch' ? 0.12 : this.blinkLeft > 0 ? 0.04 : (expr === 'excited' ? 1.12 : expr === 'worried' ? 1.05 : 1) * m.lid
    this.open += (openT - this.open) * (1 - Math.exp(-34 * dt))
    const k = 1 - Math.exp(-22 * dt)
    this.gaze += (gazeX - this.gaze) * k

    for (const e of this.eyes) {
      // closed: lid covers the eye; open: lid rests above it
      e.lid.position.y = 0.231 + 0.106 * Math.min(1.1, this.open)
      e.iris.position.x = this.gaze * 0.012
      e.lash.position.y = e.lid.position.y - 0.058
    }

    // brows
    let by = 0.325
    let tilt = 0
    if (expr === 'run') tilt = 0.2
    else if (expr === 'excited') by = 0.355
    else if (expr === 'worried') {
      by = 0.338
      tilt = -0.32
    } else if (expr === 'ouch') {
      by = 0.33
      tilt = -0.45
    } else tilt = m.brow
    if (expr === 'run') tilt += m.brow
    this.browY += (by - this.browY) * k
    this.browTilt += (tilt - this.browTilt) * k
    this.browL.position.y = this.browR.position.y = this.browY
    this.browL.rotation.z = -this.browTilt
    this.browR.rotation.z = this.browTilt

    // mouth: smile amount (-1..1) and openness (0..1)
    let smile = 0.45
    let open = 0
    if (expr === 'run') smile = 0.7
    else if (expr === 'excited') {
      smile = 1
      open = 0.7
    } else if (expr === 'worried') {
      smile = -0.35
      open = 0.2
    } else if (expr === 'ouch') {
      smile = -0.2
      open = 1
    } else if (m.grin) {
      smile = 1
      open = 0.5
    }
    smile *= m.smile
    this.smile += (smile - this.smile) * k
    this.mouth += (open - this.mouth) * k
    const w = 1 + 0.3 * this.smile
    this.upper.scale.x = 0.045 * w
    this.lower.scale.x = 0.04 * w
    this.upper.position.y = 0.088 + 0.014 * this.mouth
    this.lower.position.y = 0.067 - 0.032 * this.mouth
    this.cavity.scale.y = 0.004 + 0.034 * this.mouth
    this.cavity.scale.x = 0.036 * w
    this.cavity.position.y = 0.078 - 0.01 * this.mouth
    this.teeth.visible = this.mouth > 0.25
    this.teeth.position.y = this.upper.position.y - 0.008
    this.corners.forEach((c, i) => {
      const s = i === 0 ? -1 : 1
      c.position.x = s * (0.05 + 0.028 * this.smile) * (1 + 0.04 * this.mouth)
      c.position.y = 0.078 + 0.02 * this.smile - 0.02 * this.mouth
    })
  }
}
