import * as THREE from 'three'
import { AHEAD, BEHIND, LANE_W, ROAD_W, ROW_LEN, mulberry32 } from './config'
import { geo, mats } from './materials'
import type { PowerType } from './types'

export type ObstacleKind = 'low' | 'high' | 'block' | 'drone' | 'laser'

export interface Obstacle {
  kind: ObstacleKind
  x: number
  z: number
  hw: number
  hd: number
  y0: number
  y1: number
  mesh: THREE.Object3D
  baseX: number
  active: boolean
  sway?: { amp: number; freq: number; phase: number }
  pulse?: { period: number; on: number; phase: number; beam: THREE.Mesh }
  spinner?: THREE.Object3D
}

export interface Coin {
  x: number
  y: number
  z: number
}

export interface PowerPickup {
  type: PowerType
  x: number
  y: number
  z: number
  mesh: THREE.Group
}

const rowZ = (r: number) => -(r + 0.5) * ROW_LEN
const laneX = (l: number) => l * LANE_W
const COIN_CAP = 520
const ROAD_CAP = 64

/** Procedural road: row-based generator that keeps spawning patterns ahead of the player, forever. */
export class Track {
  readonly root = new THREE.Group()
  obstacles: Obstacle[] = []
  coins: Coin[] = []
  powers: PowerPickup[] = []

  private gapRows = new Set<number>()
  private nextRow = 0
  private rng: () => number = mulberry32(1)
  private patternCount = 0
  private lastPattern = -1
  private roadMesh: THREE.InstancedMesh
  private coinMesh: THREE.InstancedMesh
  private dummy = new THREE.Object3D()

  constructor() {
    const roadGeo = new THREE.BoxGeometry(ROAD_W, 0.5, ROW_LEN)
    this.roadMesh = new THREE.InstancedMesh(roadGeo, [mats.roadBody, mats.roadBody, mats.road, mats.roadBody, mats.roadBody, mats.roadBody], ROAD_CAP)
    this.roadMesh.frustumCulled = false
    this.coinMesh = new THREE.InstancedMesh(geo.coin, mats.energy, COIN_CAP)
    this.coinMesh.frustumCulled = false
    this.root.add(this.roadMesh, this.coinMesh)
  }

  reset(seed: number): void {
    for (const o of this.obstacles) this.root.remove(o.mesh)
    for (const p of this.powers) this.root.remove(p.mesh)
    this.obstacles = []
    this.coins = []
    this.powers = []
    this.gapRows.clear()
    this.nextRow = 0
    this.patternCount = 0
    this.lastPattern = -1
    this.rng = mulberry32(seed)
  }

  /** True when the player's body (z +/- margin) is entirely over a missing road segment. */
  isGap(z: number, margin = 0.9): boolean {
    const a = Math.floor((-z - margin) / ROW_LEN)
    const b = Math.floor((-z + margin) / ROW_LEN)
    return this.gapRows.has(a) && this.gapRows.has(b)
  }

  removeObstacle(o: Obstacle): void {
    this.root.remove(o.mesh)
    o.active = false
    this.obstacles = this.obstacles.filter((x) => x !== o)
  }

  removePower(p: PowerPickup): void {
    this.root.remove(p.mesh)
    this.powers = this.powers.filter((x) => x !== p)
  }

  update(playerZ: number, time: number, diff: number, speed: number): void {
    const dist = -playerZ
    while (this.nextRow * ROW_LEN < dist + AHEAD) this.genNext(diff, speed)

    // recycle everything behind the camera
    const cutoff = playerZ + BEHIND
    if (this.obstacles.some((o) => o.z > cutoff)) {
      for (const o of this.obstacles) if (o.z > cutoff) this.root.remove(o.mesh)
      this.obstacles = this.obstacles.filter((o) => o.z <= cutoff)
    }
    if (this.coins.length && this.coins[0].z > cutoff) this.coins = this.coins.filter((c) => c.z <= cutoff)
    if (this.powers.some((p) => p.z > cutoff)) {
      for (const p of this.powers) if (p.z > cutoff) this.root.remove(p.mesh)
      this.powers = this.powers.filter((p) => p.z <= cutoff)
    }
    this.gapRows.forEach((r) => {
      if (rowZ(r) > cutoff + 40) this.gapRows.delete(r)
    })

    // road tiles
    const prow = Math.floor(dist / ROW_LEN)
    let n = 0
    for (let r = prow - 8; r < Math.min(this.nextRow, prow + Math.ceil(AHEAD / ROW_LEN) + 2) && n < ROAD_CAP; r++) {
      if (this.gapRows.has(r)) continue
      this.dummy.position.set(0, -0.25, rowZ(r))
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.set(1, 1, 1)
      this.dummy.updateMatrix()
      this.roadMesh.setMatrixAt(n++, this.dummy.matrix)
    }
    this.roadMesh.count = n
    this.roadMesh.instanceMatrix.needsUpdate = true

    // moving hazards
    for (const o of this.obstacles) {
      if (o.sway) {
        o.x = o.baseX + o.sway.amp * Math.sin(time * o.sway.freq + o.sway.phase)
        o.mesh.position.x = o.x
      }
      if (o.pulse) {
        const ph = ((time + o.pulse.phase) % o.pulse.period) / o.pulse.period
        o.active = ph < o.pulse.on
        o.pulse.beam.material = o.active ? mats.laserOn : mats.laserOff
      }
      if (o.spinner) o.spinner.rotation.y = time * 5
    }
    for (const p of this.powers) {
      p.mesh.rotation.y = time * 2.2
      p.mesh.position.y = p.y + Math.sin(time * 3 + p.z) * 0.12
    }

    // energy cells (instanced)
    const count = Math.min(this.coins.length, COIN_CAP)
    for (let i = 0; i < count; i++) {
      const c = this.coins[i]
      this.dummy.position.set(c.x, c.y + Math.sin(time * 4 + c.z) * 0.06, c.z)
      this.dummy.rotation.set(0, time * 3.2 + c.z * 0.4, 0)
      this.dummy.scale.set(1, 1, 1)
      this.dummy.updateMatrix()
      this.coinMesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.coinMesh.count = count
    this.coinMesh.instanceMatrix.needsUpdate = true
  }

  // ------------------------------------------------------------- generation
  private lane(): number {
    return Math.floor(this.rng() * 3) - 1
  }

  private shuffledLanes(): number[] {
    const l = [-1, 0, 1]
    for (let i = 2; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1))
      ;[l[i], l[j]] = [l[j], l[i]]
    }
    return l
  }

  private genNext(diff: number, speed: number): void {
    const r = this.nextRow
    const rng = this.rng
    this.patternCount++
    let used: number
    if (r < 10) {
      used = this.coinLine(r, 0, 7)
    } else {
      const options: [number, () => number][] = [
        [3, () => this.coinLine(r, this.lane(), 6 + Math.floor(rng() * 4))],
        [diff < 0.7 ? 1.6 : 0.5, () => this.coinSnake(r)],
        [4, () => this.lowPattern(r, diff)],
        [3.2, () => this.highPattern(r, diff)],
        [4, () => this.blockPattern(r, diff)],
        [diff > 0.08 ? 3 : 0, () => this.gapPattern(r, speed)],
        [diff > 0.2 ? 2 : 0, () => this.dronePattern(r, diff)],
        [diff > 0.28 ? 2 : 0, () => this.laserPattern(r)],
        [diff > 0.38 ? 2.4 : 0, () => this.slalomPattern(r)],
        [this.patternCount % 5 === 0 ? 6 : 0.3, () => this.powerPattern(r)],
      ]
      // never repeat the same pattern twice in a row
      if (this.lastPattern >= 0) options[this.lastPattern][0] *= 0.15
      const total = options.reduce((s, o) => s + o[0], 0)
      let roll = rng() * total
      let idx = 0
      for (; idx < options.length - 1; idx++) {
        roll -= options[idx][0]
        if (roll <= 0) break
      }
      this.lastPattern = idx
      used = options[idx][1]()
    }
    const spacing = Math.max(2, Math.ceil((speed * (0.82 - 0.28 * diff)) / ROW_LEN))
    this.nextRow = r + used + spacing
  }

  private addCoin(x: number, y: number, z: number): void {
    this.coins.push({ x, y, z })
  }

  private coinLine(r: number, lane: number, n: number): number {
    for (let i = 0; i < n; i++) this.addCoin(laneX(lane), 0.9, -(r * ROW_LEN) - 1 - i * 2)
    return Math.ceil((n * 2) / ROW_LEN)
  }

  private coinSnake(r: number): number {
    let lane = this.lane()
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 3 === 0) {
        const step = lane === 0 ? (this.rng() > 0.5 ? 1 : -1) : -lane
        lane += step
      }
      this.addCoin(laneX(lane), 0.9, -(r * ROW_LEN) - 1 - i * 2)
    }
    return 6
  }

  private arcCoins(x: number, zc: number, n: number, spread: number, peak: number): void {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1)
      this.addCoin(x, 0.9 + peak * Math.sin(Math.PI * u), zc - (u - 0.5) * spread)
    }
  }

  private obstacle(kind: ObstacleKind, lane: number, row: number, mesh: THREE.Object3D, box: { hw: number; hd: number; y0: number; y1: number }): Obstacle {
    const o: Obstacle = { kind, x: laneX(lane), baseX: laneX(lane), z: rowZ(row), ...box, mesh, active: true }
    mesh.position.set(o.x, 0, o.z)
    this.root.add(mesh)
    this.obstacles.push(o)
    return o
  }

  private mk(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo.box, mat)
    m.scale.set(w, h, d)
    m.position.set(x, y, z)
    return m
  }

  private addLow(lane: number, row: number): void {
    const g = new THREE.Group()
    g.add(this.mk(mats.hazard, 1.9, 0.75, 0.55, 0, 0.375), this.mk(mats.hazardGlow, 1.95, 0.1, 0.6, 0, 0.82))
    this.obstacle('low', lane, row, g, { hw: 0.95, hd: 0.3, y0: 0, y1: 0.9 })
  }

  private addHigh(lane: number, row: number): void {
    const g = new THREE.Group()
    g.add(
      this.mk(mats.hazard, 2.0, 2.2, 0.5, 0, 2.2),
      this.mk(mats.hazardGlow, 2.04, 0.1, 0.54, 0, 1.12),
      this.mk(mats.dark, 0.2, 3.0, 0.3, -1.05, 1.5),
      this.mk(mats.dark, 0.2, 3.0, 0.3, 1.05, 1.5),
    )
    this.obstacle('high', lane, row, g, { hw: 1.0, hd: 0.3, y0: 1.1, y1: 3.3 })
  }

  private addBlock(lane: number, row: number): void {
    const g = new THREE.Group()
    g.add(this.mk(mats.dark, 2.0, 3.2, 2.0, 0, 1.6))
    for (const y of [0.45, 1.6, 2.75]) g.add(this.mk(mats.hazardGlow, 2.05, 0.12, 2.05, 0, y))
    this.obstacle('block', lane, row, g, { hw: 1.0, hd: 1.0, y0: 0, y1: 3.2 })
  }

  private coinsFreeLane(free: number, r: number, rows: number): void {
    this.coinLine(r, free, Math.ceil((rows * ROW_LEN) / 2) - 1)
  }

  private lowPattern(r: number, diff: number): number {
    const k = 1 + Math.floor(this.rng() * (diff > 0.4 ? 3 : diff > 0.12 ? 2 : 1))
    const lanes = this.shuffledLanes().slice(0, k)
    for (const l of lanes) this.addLow(l, r + 1)
    this.arcCoins(laneX(lanes[0]), rowZ(r + 1), 7, 9, 1.5)
    return 4
  }

  private highPattern(r: number, diff: number): number {
    const k = 1 + Math.floor(this.rng() * (diff > 0.3 ? 3 : 2))
    const lanes = this.shuffledLanes().slice(0, k)
    for (const l of lanes) this.addHigh(l, r + 1)
    for (let i = 0; i < 4; i++) this.addCoin(laneX(lanes[0]), 0.55, rowZ(r + 1) + 3 - i * 2)
    return 4
  }

  private blockPattern(r: number, diff: number): number {
    const lanes = this.shuffledLanes()
    const k = diff > 0.18 && this.rng() > 0.5 ? 2 : 1
    const blocked = lanes.slice(0, k)
    const free = lanes.slice(k)
    for (const l of blocked) this.addBlock(l, r + 1)
    this.coinsFreeLane(free[0], r, 3)
    if (diff > 0.45 && this.rng() < 0.45) {
      const nextFree = free[free.length - 1] === free[0] ? lanes[0] : free[free.length - 1]
      const f2 = Math.abs(nextFree - free[0]) <= 1 ? nextFree : 0
      for (const l of [-1, 0, 1]) if (l !== f2) this.addBlock(l, r + 6)
      this.coinLine(r + 4, f2, 5)
      return 8
    }
    return 4
  }

  private gapPattern(r: number, speed: number): number {
    const g = Math.max(2, Math.min(5, Math.ceil((speed * 0.42) / ROW_LEN)))
    const s = r + 1
    for (let i = 0; i < g; i++) this.gapRows.add(s + i)
    const zc = -((s + g / 2) * ROW_LEN)
    this.arcCoins(laneX(this.lane()), zc, Math.max(5, g * 2), g * ROW_LEN + 2, 1.7)
    return g + 2
  }

  private dronePattern(r: number, diff: number): number {
    const mk = (row: number, phase: number) => {
      const g = new THREE.Group()
      const body = new THREE.Mesh(geo.sphere, mats.hazard)
      body.scale.set(0.7, 0.34, 0.7)
      const ring = this.mk(mats.hazardGlow, 1.5, 0.07, 1.5, 0, 0)
      const eye = new THREE.Mesh(geo.sphere, mats.rim2)
      eye.scale.setScalar(0.16)
      eye.position.set(0, 0.02, -0.6)
      g.add(body, ring, eye)
      body.position.y = ring.position.y = 0.95
      eye.position.y = 0.95
      const o = this.obstacle('drone', 0, row, g, { hw: 0.75, hd: 0.7, y0: 0.35, y1: 1.6 })
      o.sway = { amp: LANE_W, freq: 2.1 + diff * 0.8, phase }
      o.spinner = ring
    }
    const ph = this.rng() * Math.PI * 2
    mk(r + 1, ph)
    if (diff > 0.55) {
      mk(r + 4, ph + Math.PI)
      return 6
    }
    return 3
  }

  private laserPattern(r: number): number {
    const lanes = this.shuffledLanes()
    const k = this.rng() > 0.5 ? 2 : 1
    const phase = this.rng() * 3
    for (const l of lanes.slice(0, k)) {
      const g = new THREE.Group()
      const beam = this.mk(mats.laserOff, 2.0, 3.2, 0.14, 0, 1.6)
      g.add(this.mk(mats.dark, 0.25, 3.0, 0.3, -1.05, 1.5), this.mk(mats.dark, 0.25, 3.0, 0.3, 1.05, 1.5), beam)
      const o = this.obstacle('laser', l, r + 1, g, { hw: 1.0, hd: 0.15, y0: 0, y1: 3.3 })
      o.pulse = { period: 2.2, on: 0.55, phase, beam }
      o.active = false
    }
    this.coinsFreeLane(lanes[k], r, 3)
    return 4
  }

  private slalomPattern(r: number): number {
    let free = this.lane()
    for (let i = 0; i < 3; i++) {
      for (const l of [-1, 0, 1]) if (l !== free) this.addBlock(l, r + 1 + i * 4)
      this.coinLine(r + i * 4, free, 4)
      free = free === 0 ? (this.rng() > 0.5 ? 1 : -1) : 0
    }
    return 11
  }

  private powerPattern(r: number): number {
    const roll = this.rng()
    const type: PowerType = roll < 0.38 ? 'shield' : roll < 0.7 ? 'magnet' : 'boost'
    const lane = this.lane()
    const g = new THREE.Group()
    const ring = new THREE.Mesh(geo.sphere, mats.powerRing)
    ring.scale.setScalar(0.72)
    let icon: THREE.Mesh
    if (type === 'shield') icon = new THREE.Mesh(geo.ico, mats.shield)
    else if (type === 'magnet') {
      icon = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.1, 6, 12, Math.PI), mats.magnet)
      icon.rotation.z = Math.PI
    } else {
      icon = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), mats.boost)
      icon.rotation.x = -Math.PI / 2
    }
    g.add(ring, icon)
    const y = 1.1
    g.position.set(laneX(lane), y, rowZ(r + 1))
    this.root.add(g)
    this.powers.push({ type, x: laneX(lane), y, z: rowZ(r + 1), mesh: g })
    this.coinLine(r, lane, 3)
    return 3
  }
}
