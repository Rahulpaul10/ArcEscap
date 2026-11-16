import * as THREE from 'three'
import { ROAD_W, live, mulberry32 } from './config'
import { geo, mats } from './materials'

const SC_LEN = 24
const SC_AHEAD = 6
const SC_BEHIND = 1

interface RowGroup extends THREE.Group {
  userData: { spinners: THREE.Object3D[] }
}

/** The futuristic city that lines the road: towers, billboards, floating platforms, chain blocks, arches. */
export class Scenery {
  readonly root = new THREE.Group()
  private rows = new Map<number, RowGroup>()
  private seed = 0

  update(playerZ: number, t: number): void {
    const cur = Math.floor(-playerZ / SC_LEN)
    for (let r = cur - SC_BEHIND; r <= cur + SC_AHEAD; r++) {
      if (!this.rows.has(r)) {
        const g = this.build(r)
        this.rows.set(r, g)
        this.root.add(g)
      }
    }
    for (const [r, g] of this.rows) {
      if (r < cur - SC_BEHIND - 1) {
        this.root.remove(g)
        this.rows.delete(r)
        continue
      }
      for (const s of g.userData.spinners) {
        s.rotation.y = t * 0.8 + r
        s.rotation.x = t * 0.5
        s.position.y += Math.sin(t * 1.3 + s.id) * 0.004
      }
    }
  }

  reset(seed = 0): void {
    this.seed = seed
    for (const g of this.rows.values()) this.root.remove(g)
    this.rows.clear()
  }

  private build(row: number): RowGroup {
    const g = new THREE.Group() as RowGroup
    g.userData = { spinners: [] }
    const rnd = mulberry32(row * 7919 + 101 + this.seed * 131)
    const z0 = -row * SC_LEN
    const edge = ROAD_W / 2

    // towers on both sides
    for (const side of [-1, 1]) {
      const count = 2
      for (let i = 0; i < count; i++) {
        const w = 5 + rnd() * 8
        const d = 6 + rnd() * 8
        const h = 18 + rnd() * 70 * (rnd() > 0.7 ? 1.5 : 1)
        const x = side * (edge + 5 + i * 11 + rnd() * 7 + w / 2)
        const z = z0 - (i * 0.5 + rnd() * 0.5) * SC_LEN
        const mat = mats.building[h > 60 ? 2 : h > 34 ? 1 : 0]
        const b = new THREE.Mesh(geo.box, mat)
        b.scale.set(w, h + 8, d)
        b.position.set(x, h / 2 - 4, z)
        g.add(b)
        const rim = new THREE.Mesh(geo.box, i % 2 ? mats.rim : mats.rim2)
        rim.scale.set(w + 0.3, 0.35, d + 0.3)
        rim.position.set(x, h, z)
        g.add(rim)
        if (rnd() > 0.65) {
          const spire = new THREE.Mesh(geo.box, mats.rim2)
          spire.scale.set(0.3, 6 + rnd() * 8, 0.3)
          spire.position.set(x, h + 3, z)
          g.add(spire)
        }
      }
    }

    // billboard (alternating sides)
    if (row % 2 === 0) {
      const side = row % 4 === 0 ? -1 : 1
      const bb = new THREE.Group()
      const screen = new THREE.Mesh(geo.plane, mats.billboard[Math.floor(rnd() * mats.billboard.length)])
      screen.scale.set(9, 4.5, 1)
      const frame = new THREE.Mesh(geo.box, mats.dark)
      frame.scale.set(9.5, 5, 0.3)
      frame.position.z = -0.2
      const glow = new THREE.Mesh(geo.box, mats.rim)
      glow.scale.set(9.7, 0.14, 0.36)
      glow.position.set(0, -2.55, -0.2)
      bb.add(frame, screen, glow)
      bb.position.set(side * (edge + 7 + rnd() * 3), 9 + rnd() * 8, z0 - rnd() * SC_LEN)
      // screen front is +Z (toward the oncoming runner), angled slightly toward the road
      bb.rotation.y = -side * 0.6
      g.add(bb)
    }

    // floating platforms with a crystal
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      if (rnd() < 0.45) continue
      const s = 4 + rnd() * 5
      const x = side * (edge + 3 + rnd() * 9)
      const y = 3 + rnd() * 11
      const z = z0 - rnd() * SC_LEN
      const p = new THREE.Mesh(geo.box, mats.platform)
      p.scale.set(s, 0.5, s)
      p.position.set(x, y, z)
      const rim = new THREE.Mesh(geo.box, mats.rim)
      rim.scale.set(s + 0.15, 0.12, s + 0.15)
      rim.position.set(x, y - 0.3, z)
      const crystal = new THREE.Mesh(geo.octa, mats.rim2)
      crystal.scale.set(1.2, 2, 1.2)
      crystal.position.set(x, y + 1.6, z)
      g.add(p, rim, crystal)
      g.userData.spinners.push(crystal)
    }

    // "onchain" blocks: rotating wire cubes
    for (let i = 0; i < 2; i++) {
      if (rnd() < 0.4) continue
      const side = rnd() > 0.5 ? 1 : -1
      const holder = new THREE.Group()
      const size = 1.2 + rnd() * 1.6
      const cube = new THREE.LineSegments(geo.edges, mats.edge)
      cube.scale.setScalar(size)
      const inner = new THREE.Mesh(geo.box, mats.glass)
      inner.scale.setScalar(size * 0.7)
      holder.add(cube, inner)
      holder.position.set(side * (edge + 2 + rnd() * 6), 5 + rnd() * 14, z0 - rnd() * SC_LEN)
      g.add(holder)
      g.userData.spinners.push(holder)
    }

    // gateway arch every third row
    if (row % 3 === 0) {
      const az = z0 - SC_LEN / 2
      for (const s of [-1, 1]) {
        const pillar = new THREE.Mesh(geo.box, mats.dark)
        pillar.scale.set(0.6, 8, 0.6)
        pillar.position.set(s * (edge + 0.4), 4, az)
        const strip = new THREE.Mesh(geo.box, mats.rim)
        strip.scale.set(0.12, 8, 0.12)
        strip.position.set(s * (edge - 0.05), 4, az)
        g.add(pillar, strip)
      }
      const beam = new THREE.Mesh(geo.box, mats.dark)
      beam.scale.set(ROAD_W + 1.8, 0.7, 0.7)
      beam.position.set(0, 8.2, az)
      const glow = new THREE.Mesh(geo.box, mats.rim2)
      glow.scale.set(ROAD_W + 1.9, 0.12, 0.12)
      glow.position.set(0, 7.8, az)
      g.add(beam, glow)
    }
    return g
  }
}

/** Distant sun disc + glowing grid void beneath the road. Both follow the player. */
export class Backdrop {
  readonly root = new THREE.Group()
  private sun = new THREE.Mesh(geo.plane, mats.sun)
  private voidFloor = new THREE.Mesh(geo.plane, mats.void)

  constructor() {
    this.sun.scale.set(150, 150, 1)
    this.root.add(this.sun)
    this.voidFloor.rotation.x = -Math.PI / 2
    this.voidFloor.scale.set(600, 600, 1)
    this.voidFloor.position.y = -22
    this.root.add(this.voidFloor)
  }

  update(playerZ: number): void {
    this.sun.position.set(0, 52, playerZ - 360)
    ;(this.sun.material).color.copy(live.sun)
    // snap to the grid cell size so the grid slides smoothly
    const cell = 600 / 60
    this.voidFloor.position.set(0, -22, Math.round(playerZ / cell) * cell - 200)
  }
}

/** Floating motes + speed streaks around the player, plus a pooled particle burst for pickups and crashes. */
export class Atmosphere {
  readonly root = new THREE.Group()
  private motes: THREE.Points
  private moteArr: Float32Array
  private streaks: THREE.LineSegments
  private streakArr: Float32Array
  private streakMat: THREE.LineBasicMaterial
  private burst: THREE.Points
  private bPos: Float32Array
  private bCol: Float32Array
  private bVel: Float32Array
  private bLife: Float32Array
  private bHead = 0
  private static N = 360
  private static S = 36
  private static B = 160

  constructor() {
    const N = Atmosphere.N
    this.moteArr = new Float32Array(N * 3)
    const rnd = mulberry32(5)
    for (let i = 0; i < N; i++) {
      this.moteArr[i * 3] = (rnd() - 0.5) * 60
      this.moteArr[i * 3 + 1] = rnd() * 28
      this.moteArr[i * 3 + 2] = -rnd() * 130 + 15
    }
    const mg = new THREE.BufferGeometry()
    mg.setAttribute('position', new THREE.BufferAttribute(this.moteArr, 3))
    this.motes = new THREE.Points(
      mg,
      new THREE.PointsMaterial({ size: 0.2, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }),
    )
    this.motes.frustumCulled = false
    this.root.add(this.motes)

    const S = Atmosphere.S
    this.streakArr = new Float32Array(S * 6)
    for (let i = 0; i < S; i++) this.respawnStreak(i, rnd, true)
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(this.streakArr, 3))
    this.streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    this.streaks = new THREE.LineSegments(sg, this.streakMat)
    this.streaks.frustumCulled = false
    this.root.add(this.streaks)

    const B = Atmosphere.B
    this.bPos = new Float32Array(B * 3).fill(9999)
    this.bCol = new Float32Array(B * 3)
    this.bVel = new Float32Array(B * 3)
    this.bLife = new Float32Array(B)
    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.BufferAttribute(this.bPos, 3))
    bg.setAttribute('color', new THREE.BufferAttribute(this.bCol, 3))
    this.burst = new THREE.Points(
      bg,
      new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.burst.frustumCulled = false
    this.root.add(this.burst)
  }

  private respawnStreak(i: number, rnd: () => number, initial = false): void {
    const a = this.streakArr
    const x = (rnd() - 0.5) * 16
    const y = 0.5 + rnd() * 9
    const z = -rnd() * 70 - (initial ? 0 : 40)
    a.set([x, y, z, x, y, z - 1], i * 6)
  }

  emit(x: number, y: number, z: number, color: THREE.Color | number, count: number, speed = 6): void {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color)
    for (let n = 0; n < count; n++) {
      const i = this.bHead
      this.bHead = (this.bHead + 1) % Atmosphere.B
      this.bPos[i * 3] = x
      this.bPos[i * 3 + 1] = y
      this.bPos[i * 3 + 2] = z
      const a = Math.random() * Math.PI * 2
      const b = Math.random() * Math.PI - Math.PI / 2
      const s = speed * (0.4 + Math.random() * 0.8)
      this.bVel[i * 3] = Math.cos(a) * Math.cos(b) * s
      this.bVel[i * 3 + 1] = Math.sin(b) * s + 2
      this.bVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s
      this.bCol[i * 3] = c.r
      this.bCol[i * 3 + 1] = c.g
      this.bCol[i * 3 + 2] = c.b
      this.bLife[i] = 1
    }
  }

  update(dt: number, playerZ: number, speed: number, speedNorm: number): void {
    ;(this.motes.material as THREE.PointsMaterial).color.copy(live.accent)
    const m = this.moteArr
    for (let i = 0; i < Atmosphere.N; i++) {
      const k = i * 3
      m[k + 1] += Math.sin(playerZ * 0.02 + i) * dt * 0.4
      if (m[k + 2] > playerZ + 14) {
        m[k + 2] -= 132
        m[k] = (Math.random() - 0.5) * 60
        m[k + 1] = Math.random() * 28
      } else if (m[k + 2] < playerZ - 118) m[k + 2] += 132
    }
    this.motes.geometry.attributes.position.needsUpdate = true

    // streaks live in a player-local frame
    this.streaks.position.set(0, 0, playerZ)
    this.streakMat.opacity = Math.max(0, (speedNorm - 0.25) * 0.9)
    this.streakMat.color.copy(live.accent)
    const s = this.streakArr
    const len = 1.5 + speed * 0.28
    for (let i = 0; i < Atmosphere.S; i++) {
      const k = i * 6
      s[k + 2] += speed * dt * 1.3
      s[k + 5] = s[k + 2] - len
      if (s[k + 2] > 12) this.respawnStreak(i, Math.random, false)
    }
    this.streaks.geometry.attributes.position.needsUpdate = true

    // burst particles
    for (let i = 0; i < Atmosphere.B; i++) {
      if (this.bLife[i] <= 0) continue
      this.bLife[i] -= dt * 1.8
      const k = i * 3
      this.bVel[k + 1] -= 9 * dt
      this.bPos[k] += this.bVel[k] * dt
      this.bPos[k + 1] += this.bVel[k + 1] * dt
      this.bPos[k + 2] += this.bVel[k + 2] * dt
      const f = Math.max(0, this.bLife[i])
      if (f === 0) this.bPos[k] = 9999
      this.bCol[k] *= 0.96 + f * 0.04
      this.bCol[k + 1] *= 0.96 + f * 0.04
      this.bCol[k + 2] *= 0.96 + f * 0.04
    }
    this.burst.geometry.attributes.position.needsUpdate = true
    this.burst.geometry.attributes.color.needsUpdate = true
  }

  clearBurst(): void {
    this.bPos.fill(9999)
    this.bLife.fill(0)
  }
}
