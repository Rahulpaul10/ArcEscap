import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ROAD_W, live, mulberry32 } from './config'
import { bend, geo, mats } from './materials'

const SC_LEN = 24
const SC_AHEAD = 6
const SC_BEHIND = 1

interface RowGroup extends THREE.Group {
  userData: { spinners: THREE.Object3D[]; merged: THREE.BufferGeometry[] }
}

type V3 = [number, number, number]

/** Collects transformed copies of shared geometry per material, then merges them into one mesh per material. */
class Bucket {
  private map = new Map<THREE.Material, THREE.BufferGeometry[]>()
  private t = new THREE.Object3D()

  add(mat: THREE.Material, g: THREE.BufferGeometry, pos: V3, scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0]): void {
    const t = this.t
    t.position.set(...pos)
    t.scale.set(...scale)
    t.rotation.set(...rot)
    t.updateMatrix()
    const c = g.clone()
    c.applyMatrix4(t.matrix)
    const list = this.map.get(mat)
    if (list) list.push(c)
    else this.map.set(mat, [c])
  }

  build(into: THREE.Group, merged: THREE.BufferGeometry[]): void {
    for (const [mat, list] of this.map) {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false)
      if (list.length > 1) list.forEach((l) => l.dispose())
      merged.push(g)
      into.add(new THREE.Mesh(g, mat))
    }
  }
}

/** The futuristic city that lines the road: tiered towers, rooftop beacons, neon signs, street lamps, rails, billboards and floating blocks. */
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
        g.userData.merged.forEach((m) => m.dispose())
        this.rows.delete(r)
        continue
      }
      for (const s of g.userData.spinners) {
        s.rotation.y = t * 0.8 + r
        s.rotation.x = t * 0.5
        s.position.y += Math.sin(t * 1.3 + s.id) * 0.004
      }
    }
    // aircraft beacons blink, holographic billboards shimmer
    const b = Math.sin(t * 3) > 0.55 ? 1.8 : 0.15
    mats.beacon.color.setRGB(b, b * 0.1, b * 0.1)
    mats.billboard.forEach((m, i) => m.color.setScalar(0.95 + 0.08 * Math.sin(t * 2 + i) + (Math.sin(t * 17 + i * 3) > 0.97 ? 0.2 : 0)))
  }

  reset(seed = 0): void {
    this.seed = seed
    for (const g of this.rows.values()) {
      this.root.remove(g)
      g.userData.merged.forEach((m) => m.dispose())
    }
    this.rows.clear()
  }

  private build(row: number): RowGroup {
    const g = new THREE.Group() as RowGroup
    g.userData = { spinners: [], merged: [] }
    const rnd = mulberry32(row * 7919 + 101 + this.seed * 131)
    const z0 = -row * SC_LEN
    const zc = z0 - SC_LEN / 2
    const edge = ROAD_W / 2
    const B = new Bucket()

    // guard rails with a neon cap, support piers and cross girders beneath the roadway
    for (const s of [-1, 1]) {
      B.add(mats.rail, geo.box, [s * (edge + 0.2), 0.3, zc], [0.34, 0.6, SC_LEN])
      B.add(mats.rim, geo.box, [s * (edge + 0.05), 0.62, zc], [0.07, 0.05, SC_LEN])
      B.add(mats.rail, geo.box, [s * (edge - 0.7), -11.6, zc], [1.3, 22, 1.3])
    }
    B.add(mats.rail, geo.box, [0, -0.85, zc], [ROAD_W, 0.7, 1.1])

    // street lamps with additive light pools on the asphalt
    for (const s of [-1, 1]) {
      for (const dz of [6, 18]) {
        const z = z0 - dz
        B.add(mats.rail, geo.box, [s * (edge + 0.55), 2.7, z], [0.13, 5.4, 0.13])
        B.add(mats.rail, geo.box, [s * (edge - 0.1), 5.35, z], [1.4, 0.1, 0.1])
        B.add(mats.lamp, geo.box, [s * (edge - 0.7), 5.27, z], [0.6, 0.08, 0.28])
        B.add(mats.pool, geo.plane, [s * (edge - 2.2), 0.04, z], [5.5, 5.5, 1], [-Math.PI / 2, 0, 0])
      }
    }

    // towers on both sides: setbacks, rooftop kit, aircraft beacons and neon fins
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const w = 6 + rnd() * 8
        const d = 7 + rnd() * 8
        const h = 22 + rnd() * 70 * (rnd() > 0.7 ? 1.5 : 1)
        const x = side * (edge + 5 + i * 11 + rnd() * 7 + w / 2)
        const z = z0 - (i * 0.5 + rnd() * 0.5) * SC_LEN
        const mat = mats.building[h > 60 ? 2 : h > 34 ? 1 : 0]
        B.add(mat, geo.box, [x, h / 2 - 4, z], [w, h + 8, d])
        B.add(i % 2 ? mats.rim : mats.rim2, geo.box, [x, h, z], [w + 0.3, 0.35, d + 0.3])
        let top = h
        if (h > 34) {
          const th = 6 + rnd() * 12
          B.add(mats.building[0], geo.box, [x, h + th / 2, z], [w * 0.62, th, d * 0.62])
          B.add(mats.rim, geo.box, [x, h + th, z], [w * 0.62 + 0.2, 0.25, d * 0.62 + 0.2])
          top = h + th
        }
        // rooftop machinery
        for (let k = 0; k < 2; k++) B.add(mats.dark, geo.box, [x + (rnd() - 0.5) * w * 0.5, top + 0.7, z + (rnd() - 0.5) * d * 0.5], [1.2 + rnd() * 1.6, 1.4, 1.2 + rnd() * 1.6])
        if (rnd() > 0.4) {
          const ah = 7 + rnd() * 10
          B.add(mats.rail, geo.box, [x, top + ah / 2, z], [0.2, ah, 0.2])
          B.add(mats.beacon, geo.box, [x, top + ah + 0.2, z], [0.5, 0.5, 0.5])
        }
        // neon fin on the road-facing side
        const fh = 8 + rnd() * 18
        B.add(rnd() > 0.5 ? mats.rim2 : mats.rim, geo.box, [x - side * (w / 2 + 0.08), 8 + rnd() * (h * 0.6), z + (rnd() - 0.5) * d * 0.6], [0.28, fh, 0.7])
        // glowing podium base
        B.add(mats.rim, geo.box, [x - side * (w / 2 + 0.05), 1.2, z], [0.12, 0.12, d + 0.4])
      }
    }

    // floating platforms
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1
      if (rnd() < 0.45) continue
      const s = 4 + rnd() * 5
      const x = side * (edge + 3 + rnd() * 9)
      const y = 3 + rnd() * 11
      const z = z0 - rnd() * SC_LEN
      B.add(mats.platform, geo.box, [x, y, z], [s, 0.5, s])
      B.add(mats.rim, geo.box, [x, y - 0.3, z], [s + 0.15, 0.12, s + 0.15])
      const crystal = new THREE.Mesh(geo.octa, mats.rim2)
      crystal.scale.set(1.2, 2, 1.2)
      crystal.position.set(x, y + 1.6, z)
      g.add(crystal)
      g.userData.spinners.push(crystal)
    }

    // gateway arch every third row
    if (row % 3 === 0) {
      const az = z0 - SC_LEN / 2
      for (const s of [-1, 1]) {
        B.add(mats.dark, geo.box, [s * (edge + 0.4), 4.5, az], [0.7, 9, 0.7])
        B.add(mats.rim, geo.box, [s * (edge - 0.05), 4.5, az], [0.12, 9, 0.12])
      }
      B.add(mats.dark, geo.box, [0, 9.2, az], [ROAD_W + 1.8, 0.8, 0.8])
      B.add(mats.rim2, geo.box, [0, 8.75, az], [ROAD_W + 1.9, 0.12, 0.12])
      B.add(mats.rim, geo.box, [0, 9.62, az], [ROAD_W + 1.9, 0.08, 0.08])
    }
    B.build(g, g.userData.merged)

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
      bb.rotation.y = -side * 0.6
      g.add(bb)
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
    return g
  }
}

/** Distant skyline silhouettes (instanced) that give the city real depth behind the near towers. */
class Skyline {
  readonly mesh = new THREE.InstancedMesh(geo.box, mats.far, 160)
  private cell = -9999
  private dummy = new THREE.Object3D()

  constructor() {
    this.mesh.frustumCulled = false
  }

  update(playerZ: number): void {
    mats.far.color.copy(live.fog).lerp(live.accent, 0.22).multiplyScalar(1.2)
    const cell = Math.floor(-playerZ / 80)
    if (cell === this.cell) return
    this.cell = cell
    let n = 0
    for (let c = cell - 1; c <= cell + 6; c++) {
      const rnd = mulberry32(c * 131 + 7)
      for (let k = 0; k < 14 && n < 160; k++) {
        const side = rnd() < 0.5 ? -1 : 1
        const w = 14 + rnd() * 28
        const d = 14 + rnd() * 28
        const h = 70 + rnd() * 170 * (rnd() > 0.8 ? 1.4 : 1)
        this.dummy.position.set(side * (75 + rnd() * 140), h / 2 - 24, -(c * 80 + rnd() * 80))
        this.dummy.scale.set(w, h, d)
        this.dummy.updateMatrix()
        this.mesh.setMatrixAt(n++, this.dummy.matrix)
      }
    }
    this.mesh.count = n
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

/** Hover traffic streaming through the sky lanes above the city. */
class Traffic {
  readonly root = new THREE.Group()
  private static N = 26
  private body: THREE.InstancedMesh
  private lights: THREE.InstancedMesh
  private dummy = new THREE.Object3D()
  private cars: { x: number; y: number; z0: number; v: number }[] = []

  constructor() {
    const N = Traffic.N
    this.body = new THREE.InstancedMesh(geo.box, bend(new THREE.MeshStandardMaterial({ color: 0x1b2038, roughness: 0.3, metalness: 0.85 })), N)
    this.lights = new THREE.InstancedMesh(geo.box, bend(new THREE.MeshBasicMaterial({ color: 0xffffff })), N * 4)
    this.lights.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 12), 3)
    this.body.frustumCulled = this.lights.frustumCulled = false
    const rnd = mulberry32(99)
    const red = new THREE.Color(1.5, 0.1, 0.15)
    const white = new THREE.Color(1.3, 1.3, 1.5)
    for (let i = 0; i < N; i++) {
      const side = rnd() < 0.5 ? -1 : 1
      this.cars.push({ x: side * (14 + rnd() * 50), y: 9 + rnd() * 34, z0: rnd() * 260, v: (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 30) })
      for (let k = 0; k < 4; k++) this.lights.setColorAt(i * 4 + k, k < 2 ? red : white)
    }
    this.root.add(this.body, this.lights)
  }

  update(playerZ: number, t: number): void {
    const N = Traffic.N
    for (let i = 0; i < N; i++) {
      const c = this.cars[i]
      const rel = ((((c.z0 + c.v * t - playerZ + 200) % 260) + 260) % 260) - 200
      const z = playerZ + rel
      const dir = Math.sign(c.v) // heading along +z when positive
      this.dummy.position.set(c.x, c.y, z)
      this.dummy.rotation.set(0, 0, 0)
      this.dummy.scale.set(1.7, 0.45, 4.2)
      this.dummy.updateMatrix()
      this.body.setMatrixAt(i, this.dummy.matrix)
      for (let k = 0; k < 4; k++) {
        const front = k >= 2
        const lx = (k % 2 === 0 ? -1 : 1) * 0.6
        this.dummy.position.set(c.x + lx, c.y, z + (front ? 1 : -1) * dir * 2.12)
        this.dummy.scale.set(0.4, 0.2, 0.12)
        this.dummy.updateMatrix()
        this.lights.setMatrixAt(i * 4 + k, this.dummy.matrix)
      }
    }
    this.body.instanceMatrix.needsUpdate = true
    this.lights.instanceMatrix.needsUpdate = true
    if (this.lights.instanceColor) this.lights.instanceColor.needsUpdate = true
  }
}

const skyTop = new THREE.Color()
const skyMid = new THREE.Color()
const skyHor = new THREE.Color()
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
  uniforms: { uTop: { value: skyTop }, uMid: { value: skyMid }, uHor: { value: skyHor } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor;
    varying vec3 vDir;
    float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    void main(){
      float h = vDir.y;
      vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.25, h));
      c = mix(c, uTop, smoothstep(0.15, 0.9, h));
      c += uHor * 0.45 * exp(-abs(h) * 14.0);
      if (h < 0.0) c = mix(uHor * 0.45, uTop * 0.3, smoothstep(0.0, -0.4, h));
      float star = step(0.9972, hash(floor(vDir * 170.0)));
      c += star * smoothstep(0.08, 0.4, h) * 0.8;
      gl_FragColor = vec4(c, 1.0);
    }`,
})

/** Sky dome, distant sun, skyline, hover traffic and the glowing grid void beneath the road. All follow the player. */
export class Backdrop {
  readonly root = new THREE.Group()
  private sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 14), skyMat)
  private sun = new THREE.Mesh(geo.plane, mats.sun)
  private voidFloor = new THREE.Mesh(geo.plane, mats.void)
  private skyline = new Skyline()
  private traffic = new Traffic()

  constructor() {
    this.sky.renderOrder = -100
    this.sky.frustumCulled = false
    this.root.add(this.sky)
    this.sun.scale.set(170, 170, 1)
    this.root.add(this.sun)
    this.voidFloor.rotation.x = -Math.PI / 2
    this.voidFloor.scale.set(600, 600, 1)
    this.voidFloor.position.y = -22
    this.root.add(this.voidFloor, this.skyline.mesh, this.traffic.root)
  }

  update(playerZ: number, t: number, cameraX: number, cameraY: number): void {
    this.sky.position.set(cameraX, cameraY, playerZ)
    skyTop.copy(live.sky).multiplyScalar(0.85)
    skyMid.copy(live.fog).lerp(live.accent2, 0.18).multiplyScalar(1.1)
    skyHor.copy(live.accent2).multiplyScalar(0.32)
    this.sun.position.set(0, 58, playerZ - 400)
    ;(this.sun.material).color.copy(live.sun).multiplyScalar(0.9)
    const cell = 600 / 60
    this.voidFloor.position.set(0, -22, Math.round(playerZ / cell) * cell - 200)
    this.skyline.update(playerZ)
    this.traffic.update(playerZ, t)
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
      new THREE.PointsMaterial({ size: 0.14, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffffff }),
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
    this.streakMat.opacity = Math.max(0, (speedNorm - 0.3) * 0.4)
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
