import * as THREE from 'three'
import { ARC_MARK_PATH } from './arcMark'
import { buildHand, headGeometry, limbGeometry, torsoFront, torsoGeometry, type Hand } from './bodyparts'
import { CHARACTERS, type Character, type Mood, type Palette } from './characters'
import { OUTFIT_TRAITS, buildAccessory, buildHair, buildOutfit, buildPack, type Ctx, type Part, type V3 } from './cosmetics'
import { Face, type Expression, type MoodCfg } from './face'
import { bend, geo } from './materials'
import { makePose, mirrorPose, poseAir, poseHit, poseFall, poseIdle, poseRun, poseSlide, smooth, type Pose } from './poses'

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
  /** extra yaw for the character-select turntable */
  yaw: number
  /** uniform scale pop used when a character is picked */
  pop: number
  /** ground speed in units/s (drives cadence so feet match the road) */
  speed: number
  /** side the last Energy was grabbed on: -1 left, 1 right */
  collectSide: number
  /** close-call pulse 0..1 and the side the hazard passed on */
  dodge: number
  dodgeDir: number
  /** 0..1, a hazard is close ahead in your lane */
  threat: number
}

/** Personality: how the face rests (eyelids, brows, smile width, blush, open-mouth grin). */
const MOODS: Record<Mood, MoodCfg> = {
  cheerful: { lid: 1, brow: 0, smile: 1, blush: 1, grin: false },
  cool: { lid: 0.62, brow: 0.18, smile: 0.8, blush: 0.4, grin: false },
  shy: { lid: 0.95, brow: -0.2, smile: 0.7, blush: 1.9, grin: false },
  bold: { lid: 1, brow: 0.3, smile: 1.25, blush: 0.7, grin: false },
  goofy: { lid: 1.1, brow: -0.05, smile: 1.1, blush: 1.2, grin: true },
  calm: { lid: 0.85, brow: 0, smile: 0.9, blush: 0.8, grin: false },
}

const emblemTex = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.translate(64, 66)
  g.scale(5.3, 5.3)
  g.translate(-9.84, -10.75)
  g.fillStyle = '#fff'
  g.fill(new Path2D(ARC_MARK_PATH))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

const HEAD_BASE = 0.52
const BODY_SCALE = 1.1

/**
 * Stylised-realistic runner rig: athletic proportions, V-tapered torso, tapered limbs, articulated
 * hands, an expressive face and PBR materials. Pelvis and chest are separate so the run has real
 * counter-rotation. Every character shares the skeleton and hitbox; only build, hair, outfit and
 * colour change. Faces -Z.
 */
export class Runner {
  readonly root = new THREE.Group()
  private body = new THREE.Group() // pelvis
  private chest = new THREE.Group()
  private head = new THREE.Group()
  private armL = new THREE.Group()
  private armR = new THREE.Group()
  private foreL = new THREE.Group()
  private foreR = new THREE.Group()
  private legL = new THREE.Group()
  private legR = new THREE.Group()
  private shinL = new THREE.Group()
  private shinR = new THREE.Group()
  private footL = new THREE.Group()
  private footR = new THREE.Group()
  private hands: Hand[] = []
  private scarf: THREE.Group[] = []
  private hairBack: THREE.Group[] = []
  private hairHang: THREE.Group[] = []
  private headAcc = new THREE.Group()
  private packAcc = new THREE.Group()
  private outfitAcc = new THREE.Group()
  private torso: Part
  private belt: Part
  private skirt: Part
  private emblem: THREE.Mesh
  private pads: Part[] = []
  private geoM = torsoGeometry(false)
  private geoF = torsoGeometry(true)
  private armLimbs: Part[] = []
  private legLimbs: Part[] = []
  private cloth: THREE.Group[] = []
  private skirtGroup = new THREE.Group()
  private skirtSegs: { g: THREE.Group; dx: number; dz: number; idx: number }[] = []
  private depth = new Map<THREE.Group, number>()
  private springs = new Map<THREE.Group, { x: number; vx: number; a: number; va: number }>()
  private prevBy = 0.95
  private kick = 0
  private sm = { eL: 0, eR: 0, hx: 0, hy: 0 }
  private core: THREE.Mesh
  private halo: THREE.Mesh | null = null
  private bubble: THREE.Mesh
  private face: Face
  private ownGeo: THREE.BufferGeometry[] = []
  private current: string | null = null
  private cur: Character | null = null
  private heightScale = 1
  private mood: MoodCfg = MOODS.cheerful
  private lead = 1
  private fist = 0.5

  // materials: physically based, no outlines
  private std = (color: number, rough = 0.6, metal = 0.1) => bend(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }))
  private suit = this.std(0x2f6bff, 0.78, 0)
  private trim = this.std(0xffd23d, 0.6, 0.06)
  private gear = this.std(0xffffff, 0.55, 0)
  private skin = this.std(0xf2c29b, 0.66, 0)
  private hair = this.std(0x1d2a6b, 0.5, 0)
  private acc = this.std(0x242a3a, 0.78, 0)
  private dark = this.std(0x1a1f33, 0.7, 0)
  private armUp = this.std(0x2f6bff, 0.78, 0)
  private armLow = this.std(0x2f6bff, 0.78, 0)
  private legLow = this.std(0x2f6bff, 0.78, 0)
  private skirtMat = this.std(0xffd23d, 0.75, 0)
  private lens = bend(new THREE.MeshStandardMaterial({ color: 0x0e0c1c, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.94 }))
  private glow = bend(new THREE.MeshBasicMaterial({ color: 0x35f2ff }))
  private emblemMat = bend(new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, depthWrite: false, color: 0x35f2ff }))
  private bubbleMat = bend(new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.2, depthWrite: false }))
  private flash = new THREE.Color(0xff3344)
  private base = new THREE.Color()
  private lipTint = new THREE.Color()
  private phase = 0
  private pose = makePose()
  private poses = { idle: makePose(), run: makePose(), air: makePose(), slide: makePose(), hit: makePose(), fall: makePose() }
  private w = { idle: 1, run: 0, air: 0, slide: 0, hit: 0, fall: 0 }
  private lat = 0
  private landT = 0
  private landStr = 0
  private launchT = 0
  private peakFall = 0
  private prevMode: RunnerMode = 'idle'

  constructor() {
    const { suit, trim, glow, gear, skin } = this
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 22)
    const cone = new THREE.CylinderGeometry(0.2, 0.32, 0.24, 20)
    const upperArm = limbGeometry(0.3, 0.066, 0.058, 0.043, 0.35)
    const foreArm = limbGeometry(0.28, 0.046, 0.047, 0.03, 0.25)
    const thigh = limbGeometry(0.46, 0.112, 0.1, 0.066, 0.3)
    const calf = limbGeometry(0.44, 0.068, 0.075, 0.042, 0.28)

    this.root.add(this.body)
    this.body.position.y = 0.95
    this.body.add(this.chest)

    // pelvis: belt + optional skirt
    this.belt = this.mk(this.body, cyl, trim, [0, 0.05, 0], [0.5, 0.075, 0.4])
    this.skirt = this.mk(this.body, cone, this.skirtMat, [0, -0.05, 0], [1, 1, 1])

    // chest: V-tapered torso, Arc emblem, shoulder pads, neck, head
    this.torso = this.mk(this.chest, torsoGeometry(), suit, [0, 0, 0], [1, 1, 0.8])
    this.emblem = new THREE.Mesh(geo.plane, this.emblemMat)
    this.emblem.scale.set(0.2, 0.2, 1)
    this.emblem.position.set(0, 0.5, -0.203)
    this.emblem.rotation.y = Math.PI
    this.chest.add(this.emblem)
    this.body.add(this.skirtGroup)
    this.core = new THREE.Mesh(geo.sphere, glow)
    this.core.scale.setScalar(0.1)
    this.chest.add(this.packAcc, this.outfitAcc, this.core)
    this.mk(this.chest, cyl, skin, [0, 0.8, 0], [0.105, 0.17, 0.105])

    this.head.position.set(0, 0.84, 0)
    this.chest.add(this.head)
    this.mk(this.head, headGeometry(), skin, [0, 0.2, 0], [0.3, 0.29, 0.29])
    this.face = new Face(this.head, skin, this.hair, bend)
    this.head.add(this.headAcc)

    // scarf of energy
    let parent: THREE.Object3D = this.chest
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group()
      seg.position.set(0, i === 0 ? 0.72 : 0, i === 0 ? 0.14 : 0.2)
      const rib = new THREE.Mesh(geo.box, i % 2 ? glow : trim)
      rib.scale.set(0.12, 0.035, 0.22)
      rib.position.z = 0.1
      seg.add(rib)
      parent.add(seg)
      this.scarf.push(seg)
      parent = seg
    }

    // arms: shoulder + biceps + forearm + articulated hand
    for (const [arm, fore, s] of [
      [this.armL, this.foreL, -1],
      [this.armR, this.foreR, 1],
    ] as const) {
      arm.position.set(s * 0.285, 0.64, 0)
      this.armLimbs.push(this.mk(arm, upperArm, this.armUp, [0, 0, 0]))
      fore.position.set(0, -0.3, 0)
      this.armLimbs.push(this.mk(fore, foreArm, this.armLow, [0, 0, 0]))
      const hand = buildHand(skin, glow)
      hand.root.position.y = -0.285
      fore.add(hand.root)
      this.hands.push(hand)
      arm.add(fore)
      this.chest.add(arm)
    }

    // legs: thigh + calf + sneaker
    for (const [leg, shin, foot, s] of [
      [this.legL, this.shinL, this.footL, -1],
      [this.legR, this.shinR, this.footR, 1],
    ] as const) {
      leg.position.set(s * 0.12, 0, 0)
      this.legLimbs.push(this.mk(leg, thigh, suit, [0, 0, 0]))
      shin.position.set(0, -0.46, 0)
      this.legLimbs.push(this.mk(shin, calf, this.legLow, [0, 0, 0]))
      foot.position.set(0, -0.42, 0)
      // sneaker: rounded upper, toe box, heel counter, flat sole with a thin Arc stripe
      this.mk(foot, geo.sphere, gear, [0, -0.04, -0.045], [0.06, 0.05, 0.12])
      this.mk(foot, geo.sphere, gear, [0, -0.052, -0.125], [0.05, 0.036, 0.055])
      this.mk(foot, geo.sphere, suit, [0, -0.03, 0.04], [0.056, 0.05, 0.05])
      this.mk(foot, geo.sphere, gear, [0, -0.082, -0.06], [0.064, 0.018, 0.15])
      const sole = new THREE.Mesh(geo.box, glow)
      sole.scale.set(0.118, 0.008, 0.2)
      sole.position.set(0, -0.092, -0.06)
      foot.add(sole)
      shin.add(foot)
      leg.add(shin)
      this.body.add(leg)
    }

    this.bubble = new THREE.Mesh(geo.sphere, this.bubbleMat)
    this.bubble.scale.set(0.95, 1.15, 0.95)
    this.bubble.position.y = 0.95
    this.bubble.visible = false
    this.root.add(this.bubble)
    this.markShadows()
  }

  private markShadows(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.castShadow = true
    })
    this.bubble.castShadow = false
    this.emblem.castShadow = false
  }

  // ------------------------------------------------------------- builders
  private mk(parent: THREE.Object3D, g: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scale: V3 = [1, 1, 1], _ol = 0): Part {
    void _ol
    const m = new THREE.Mesh(g, mat)
    m.position.set(...pos)
    m.scale.set(...scale)
    m.castShadow = true
    parent.add(m)
    return { m, o: null, k: 1 }
  }

  private resize(p: Part, x: number, y: number, z: number): void {
    p.m.scale.set(x, y, z)
  }

  private place(p: Part, x: number, y: number, z: number): void {
    p.m.position.set(x, y, z)
  }

  /**
   * Apply a character's build, hair, outfit and colours (colorways recolor the outfit only).
   * Never throws: if a character fails to build, the default runner is used so the game keeps running.
   */
  setLook(c: Character, p: Palette): void {
    try {
      this.applyLook(c, p)
    } catch (err) {
      console.warn(`Runner "${c.id}" failed to load, using the default runner`, err)
      this.current = null
      const d = CHARACTERS[0]
      try {
        this.applyLook(d, d.palette)
      } catch (err2) {
        console.warn('Default runner failed to load', err2)
      }
    }
  }

  /** Clear animation state so a runner can resume from a clean pose (after a fault or a character swap). */
  resetState(): void {
    for (const k of Object.keys(this.w) as (keyof typeof this.w)[]) this.w[k] = k === 'idle' ? 1 : 0
    this.springs.clear()
    this.lat = 0
    this.landT = 0
    this.launchT = 0
    this.peakFall = 0
    this.kick = 0
    this.prevBy = 0.95
    this.prevMode = 'idle'
    this.sm = { eL: 0, eR: 0, hx: 0, hy: 0 }
  }

  private applyLook(c: Character, p: Palette): void {
    if (this.current !== c.id) {
      this.rebuild(c)
      this.resetState()
    }
    this.cur = c
    this.suit.color.setHex(p.suit)
    this.trim.color.setHex(p.trim)
    this.trim.emissive.setHex(p.trim).multiplyScalar(0.12)
    this.glow.color.setHex(p.glow).multiplyScalar(1.1)
    this.emblemMat.color.setHex(p.glow).multiplyScalar(1.05)
    this.gear.color.setHex(p.visor)
    this.skin.color.setHex(c.skin)
    this.skin.emissive.setHex(c.skin).multiplyScalar(0.04) // faint warmth that fakes subsurface scattering
    this.hair.color.setHex(c.hair)
    this.acc.color.setHex(c.accent)
    this.lipTint.setHex(c.skin).lerp(new THREE.Color(0xb03a48), 0.5)
    this.face.setProfile(c.eyeScale, this.mood, c.eye, this.lipTint.getHex(), c.gender === 'female')
    this.base.setHex(p.suit)
    this.syncSuit()
  }

  /** Sleeves, trousers and dress follow the outfit colour (including the hit flash); bare limbs follow the skin. */
  private syncSuit(): void {
    const c = this.cur
    if (!c) return
    this.armUp.color.copy(c.sleeves === 'none' ? this.skin.color : this.suit.color)
    this.armLow.color.copy(c.sleeves === 'long' ? this.suit.color : this.skin.color)
    this.legLow.color.copy(c.legs === 'pants' ? this.suit.color : this.skin.color)
    this.skirtMat.color.copy(c.outfit === 'dress' ? this.suit.color : this.trim.color)
  }

  private clear(g: THREE.Group): void {
    for (const child of [...g.children]) g.remove(child)
  }

  private own<T extends THREE.BufferGeometry>(g: T): T {
    this.ownGeo.push(g)
    return g
  }

  private rebuild(c: Character): void {
    this.current = c.id
    this.cur = c
    this.clear(this.headAcc)
    this.clear(this.packAcc)
    this.clear(this.outfitAcc)
    for (const g of this.ownGeo) g.dispose()
    this.ownGeo = []
    this.hairBack = []
    this.hairHang = []
    this.cloth = []
    this.halo = null

    const tr = OUTFIT_TRAITS[c.outfit]
    const female = c.gender === 'female'
    this.torso.m.geometry = female ? this.geoF : this.geoM
    this.resize(this.torso, c.chest, 1, 0.8)
    this.belt.m.visible = tr.belt
    this.resize(this.belt, 0.46 * c.chest + 0.06, 0.075, 0.4)
    this.emblem.visible = tr.emblem
    this.emblem.position.z = -(torsoFront(0.5, female) + 0.006)
    const es = 0.2 * Math.min(1, c.chest)
    this.emblem.scale.set(es, es, 1)
    this.skirt.m.visible = false
    this.buildSkirt(c)
    const lk = THREE.MathUtils.clamp(0.86 + (c.chest - 0.8) * 0.5, 0.86, 1.1)
    const lh = THREE.MathUtils.clamp(0.92 + (c.hip - 1) * 0.9, 0.9, 1.1)
    this.armLimbs.forEach((p) => this.resize(p, lk, 1, lk))
    this.legLimbs.forEach((p) => this.resize(p, lh, 1, lh))
    this.armL.position.x = -0.285 * c.chest
    this.armR.position.x = 0.285 * c.chest
    this.legL.position.x = -0.12 * c.hip
    this.legR.position.x = 0.12 * c.hip
    this.scarf[0].visible = c.scarf
    this.head.scale.set(HEAD_BASE * c.headW, HEAD_BASE * c.headH, HEAD_BASE * c.headW)
    this.heightScale = c.height * BODY_SCALE
    this.mood = MOODS[c.mood]

    const ctx: Ctx = {
      mk: (parent, g, mat, pos, scale, ol) => this.mk(parent, g, mat, pos, scale, ol),
      own: (g) => this.own(g),
      chain: (parent, count, step, list, piece) => this.chain(parent, count, step, list, piece),
      mat: { hair: this.hair, trim: this.trim, glow: this.glow, suit: this.suit, gear: this.gear, acc: this.acc, dark: this.dark, lens: this.lens },
      head: this.headAcc,
      outfit: this.outfitAcc,
      pack: this.packAcc,
      hairBack: this.hairBack,
      hairHang: this.hairHang,
      cloth: this.cloth,
      front: (y) => torsoFront(y, female),
      setHalo: (m) => (this.halo = m),
      core: this.core,
    }
    buildHair(ctx, c)
    buildAccessory(ctx, c)
    buildOutfit(ctx, c)
    buildPack(ctx, c)
    this.depth.clear()
    for (const list of [this.hairBack, this.hairHang, this.cloth]) {
      const set = new Set(list)
      for (const g of list) {
        let d = 0
        let par = g.parent
        while (par && set.has(par as THREE.Group)) {
          d++
          par = par.parent
        }
        this.depth.set(g, d)
      }
    }
    this.markShadows()
  }

  /** Skirts and dresses are rings of hanging panels, so they billow with speed and bounce with every stride. */
  private buildSkirt(c: Character): void {
    for (const ch of [...this.skirtGroup.children]) this.skirtGroup.remove(ch)
    this.skirtSegs = []
    if (c.skirt === 0) return
    const n = 10
    const R = 0.19 * c.hip + 0.01
    const long = c.skirt === 2
    const len = long ? 0.17 : 0.12
    const segs = long ? 2 : 1
    const w = ((Math.PI * 2 * R) / n) * 1.3
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2
      const g = new THREE.Group()
      g.position.set(Math.sin(ang) * R, 0.03, Math.cos(ang) * R)
      g.rotation.y = ang
      this.skirtGroup.add(g)
      let parent: THREE.Object3D = g
      for (let k = 0; k < segs; k++) {
        const seg = new THREE.Group()
        if (k > 0) seg.position.y = -len
        const panel = new THREE.Mesh(geo.box, this.skirtMat)
        panel.scale.set(w * (1 + k * 0.12), len * 1.06, 0.022)
        panel.position.y = -len / 2
        panel.castShadow = true
        seg.add(panel)
        parent.add(seg)
        this.skirtSegs.push({ g: seg, dx: Math.sin(ang), dz: Math.cos(ang), idx: k })
        parent = seg
      }
    }
  }

  /** Damped spring toward a target angle: gives hair and cloth lag, overshoot and settle. */
  private follow(g: THREE.Group, tx: number, ta: number, axis: 'y' | 'z', k: number, c: number, dt: number): void {
    let s = this.springs.get(g)
    if (s && !(Number.isFinite(s.x) && Number.isFinite(s.a))) s = undefined
    if (!s) {
      s = { x: tx, vx: 0, a: ta, va: 0 }
      this.springs.set(g, s)
    }
    s.vx += (k * (tx - s.x) - c * s.vx) * dt
    s.x += s.vx * dt
    s.va += (k * (ta - s.a) - c * s.va) * dt
    s.a += s.va * dt
    g.rotation.x = s.x
    if (axis === 'y') g.rotation.y = s.a
    else g.rotation.z = s.a
  }

  private chain(parent: THREE.Object3D, count: number, step: THREE.Vector3, list: THREE.Group[], piece: (i: number, seg: THREE.Group) => void): void {
    let p: THREE.Object3D = parent
    for (let i = 0; i < count; i++) {
      const seg = new THREE.Group()
      if (i > 0) seg.position.copy(step)
      piece(i, seg)
      p.add(seg)
      list.push(seg)
      p = seg
    }
  }

  // ------------------------------------------------------------- animation
  update(dt: number, p: PoseInput): void {
    const t = performance.now() / 1000
    const sn = p.speedNorm

    // cadence follows ground speed so the feet keep up with the road instead of skating
    if (p.mode === 'run') this.phase = (this.phase + dt * (15 + p.speed * 0.42)) % (Math.PI * 2)

    // --- blend weights: smooth cross-fades between locomotion states
    const target: Record<keyof typeof this.w, number> = { idle: 0, run: 0, air: 0, slide: 0, hit: 0, fall: 0 }
    target[p.mode === 'jump' ? 'air' : p.mode] = 1
    const RATE = { idle: 8, run: 14, air: 24, slide: 22, hit: 34, fall: 34 }
    let sum = 0
    for (const k of Object.keys(this.w) as (keyof typeof this.w)[]) {
      const rate = target[k] ? RATE[k] : 14
      this.w[k] += (target[k] - this.w[k]) * (1 - Math.exp(-rate * dt))
      sum += this.w[k]
    }

    // alternate the leading leg on each jump / slide so repeated moves never look copy-pasted
    if ((p.mode === 'jump' && this.prevMode !== 'jump') || (p.mode === 'slide' && this.prevMode !== 'slide')) this.lead = -this.lead

    if (this.w.idle > 0.01) poseIdle(this.poses.idle, t)
    if (this.w.run > 0.01) poseRun(this.poses.run, this.phase, 1.1 + sn * 0.2, sn, p.boost, p.threat)
    if (this.w.air > 0.01) {
      poseAir(this.poses.air, THREE.MathUtils.clamp(p.vy / 14, -1, 1), t)
      if (this.lead < 0) mirrorPose(this.poses.air)
    }
    if (this.w.slide > 0.01) {
      poseSlide(this.poses.slide, t)
      if (this.lead < 0) mirrorPose(this.poses.slide)
    }
    if (this.w.hit > 0.01) poseHit(this.poses.hit, p.modeTime)
    if (this.w.fall > 0.01) poseFall(this.poses.fall, t, p.modeTime)

    const P = this.pose
    const keys = Object.keys(P) as (keyof Pose)[]
    for (const key of keys) P[key] = 0
    for (const m of Object.keys(this.w) as (keyof typeof this.w)[]) {
      const wt = this.w[m] / (sum || 1)
      if (wt < 0.002) continue
      const src = this.poses[m]
      for (const key of keys) P[key] += src[key] * wt
    }

    // fallback: if any channel ever goes non-finite, use the idle pose instead of freezing the character
    if (keys.some((key) => !Number.isFinite(P[key])) || Object.values(this.w).some((v) => !Number.isFinite(v))) {
      this.resetState()
      poseIdle(this.poses.idle, t)
      for (const key of keys) P[key] = this.poses.idle[key]
    }

    // --- takeoff / landing impulses
    if (p.mode === 'jump') {
      this.peakFall = Math.min(this.peakFall, p.vy)
      if (this.prevMode === 'run' || this.prevMode === 'slide') this.launchT = 1
    } else if (this.prevMode === 'jump' && (p.mode === 'run' || p.mode === 'slide')) {
      this.landT = 1
      this.landStr = THREE.MathUtils.clamp(-this.peakFall / 26, 0.35, 1)
      this.peakFall = 0
    }
    this.prevMode = p.mode
    this.landT = Math.max(0, this.landT - dt * 4.5)
    this.launchT = Math.max(0, this.launchT - dt * 6)
    const L = smooth(this.landT) * this.landStr
    P.by += -0.3 * L + 0.05 * this.launchT
    P.kL -= 0.8 * L
    P.kR -= 0.8 * L
    P.tL += 0.55 * L
    P.tR += 0.55 * L
    P.lean += -0.2 * L - 0.12 * this.launchT
    P.cp += -0.1 * L
    P.aL += (0.5 - P.aL) * L * 0.7
    P.aR += (0.5 - P.aR) * L * 0.7

    // --- lane change: bank into the turn, rotate chest and head, cross-step, sweep the arms
    const latT = THREE.MathUtils.clamp(p.vx / 10, -1, 1)
    this.lat += (latT - this.lat) * (1 - Math.exp(-18 * dt))
    const lat = this.lat
    P.roll -= lat * 0.55
    P.twist += lat * 0.12
    P.ct -= lat * 0.5
    P.hy -= lat * 0.55

    // --- Energy pickup: reach with the nearest arm, look at it, hop of joy
    const e = smooth(p.collect)
    if (e > 0.001) {
      const side = p.collectSide >= 0 ? 1 : -1
      if (side > 0) {
        P.aR += 2.0 * e
        P.eR -= 1.0 * e
        P.aL -= 0.6 * e
        P.azR += 0.35 * e
      } else {
        P.aL += 2.0 * e
        P.eL -= 1.0 * e
        P.aR -= 0.6 * e
        P.azL += 0.35 * e
      }
      P.ct -= side * 0.4 * e
      P.hy -= side * 0.35 * e
      P.by += 0.06 * e
    }

    // --- close call: duck, flare the arms, glance at the hazard that just passed
    const d = smooth(p.dodge)
    if (d > 0.001) {
      P.by -= 0.09 * d
      P.lean -= 0.12 * d
      P.kL -= 0.3 * d
      P.kR -= 0.3 * d
      P.azL += 0.65 * d
      P.azR += 0.65 * d
      P.hy -= p.dodgeDir * 0.7 * d
      P.roll -= p.dodgeDir * 0.16 * d
      P.ct += p.dodgeDir * 0.3 * d
    }

    // --- follow-through: elbows and head trail the big joints slightly, which removes the stiff, mechanical feel
    const fk = 1 - Math.exp(-24 * dt)
    this.sm.eL += (P.eL - this.sm.eL) * fk
    this.sm.eR += (P.eR - this.sm.eR) * fk
    this.sm.hx += (P.hx - this.sm.hx) * (1 - Math.exp(-18 * dt))
    this.sm.hy += (P.hy - this.sm.hy) * (1 - Math.exp(-18 * dt))

    // --- apply to the rig
    this.root.rotation.y = -lat * 0.38 + p.yaw
    this.root.scale.setScalar(p.pop * this.heightScale)
    this.body.position.y = P.by
    this.body.rotation.set(P.lean, P.twist, P.roll)
    this.chest.rotation.set(P.cp, P.ct, 0)
    this.head.rotation.set(this.sm.hx - (P.lean + P.cp) * 0.45, this.sm.hy, 0)
    this.legL.rotation.set(P.tL, 0, lat * 0.25)
    this.legR.rotation.set(P.tR, 0, lat * 0.25)
    this.shinL.rotation.x = P.kL
    this.shinR.rotation.x = P.kR
    this.footL.rotation.x = P.ankL
    this.footR.rotation.x = P.ankR
    this.armL.rotation.set(P.aL, 0, -P.azL + lat * 0.45)
    this.armR.rotation.set(P.aR, 0, P.azR + lat * 0.45)
    this.foreL.rotation.x = this.sm.eL
    this.foreR.rotation.x = this.sm.eR

    // --- hands: loose fists while sprinting, open when reaching or airborne
    const fistT = p.collect > 0.2 ? 0.1 : p.mode === 'run' ? 0.85 : p.mode === 'slide' ? 0.5 : p.mode === 'idle' ? 0.35 : 0.18
    this.fist += (fistT - this.fist) * (1 - Math.exp(-16 * dt))
    this.hands.forEach((h, i) => {
      const side = i === 0 ? 1 : -1 // left hand curls +z, right hand -z (palms face the body)
      h.fingers.forEach((f, j) => {
        f.rotation.z = side * this.fist * (1.25 + j * 0.05)
        h.tips[j].rotation.z = side * this.fist * 1.35
      })
      h.thumb.rotation.z = side * this.fist * 0.5
    })

    // --- face
    this.face.update(this.expression(p), dt, lat)

    // --- secondary motion: hair, scarf and garments are damped springs that lag behind the body,
    // kick with every stride and landing, stream back with speed and swing opposite to lane changes
    const calm = p.mode === 'idle' ? 0.4 : 1
    const flow = 0.25 + sn * 0.5
    const vyN = THREE.MathUtils.clamp(p.vy / 20, -1, 1)
    const byVel = (P.by - this.prevBy) / Math.max(dt, 0.006)
    this.prevBy = P.by
    this.kick += (THREE.MathUtils.clamp(-byVel * 0.05, -0.6, 0.6) - this.kick) * (1 - Math.exp(-25 * dt))
    const kick = this.kick
    this.scarf.forEach((seg, i) => {
      this.follow(seg, -flow * 0.55 + vyN * 0.45 - kick * (0.5 + 0.2 * i) + Math.sin(t * 14 - i * 0.9) * 0.14 * calm, Math.sin(t * 9 - i * 1.1) * 0.15 - lat * 0.5, 'y', 110 - i * 14, 10, dt)
    })
    this.hairBack.forEach((seg) => {
      const i = this.depth.get(seg) ?? 0
      this.follow(seg, 0.08 - flow * 0.3 + vyN * 0.4 - kick * (0.4 + 0.25 * i) + Math.sin(t * 12 - i * 0.9) * 0.1 * calm, Math.sin(t * 8 - i) * 0.08 - lat * 0.45, 'y', 85 - i * 12, 9, dt)
    })
    this.hairHang.forEach((seg) => {
      const i = this.depth.get(seg) ?? 0
      this.follow(seg, -(0.08 + flow * 0.32) + vyN * 0.3 - kick * (0.3 + 0.2 * i) + Math.sin(t * 11 - i * 1.2) * 0.08 * calm, -lat * 0.4, 'z', 95 - i * 14, 9, dt)
    })
    this.cloth.forEach((seg) => {
      const i = this.depth.get(seg) ?? 0
      this.follow(seg, -(0.05 + flow * 0.45) + vyN * 0.5 - kick * (0.4 + 0.25 * i) + Math.sin(t * 13 - i * 1.3) * 0.09 * calm, -lat * 0.3, 'z', 70 - i * 10, 7, dt)
    })
    for (const sk of this.skirtSegs) {
      // panels at the back flare out with speed, panels at the front tuck in; bounce and lane changes sway them
      const flare = 0.2 + sk.dz * flow * 0.5 - vyN * 0.25 - kick * 0.5
      this.follow(sk.g, -THREE.MathUtils.clamp(flare, 0, 1) - sk.idx * 0.06, -lat * 0.25 * sk.dx, 'z', 65, 6.5, dt)
    }
    if (this.halo) this.halo.position.y = 0.62 + Math.sin(t * 3) * 0.02

    // core pulse
    const pulse = 1 + p.collect * 1.8 + p.dodge * 0.8 + Math.sin(t * 6) * 0.1 + (p.boost ? 0.6 : 0)
    this.core.scale.setScalar(0.1 * pulse)

    // shield bubble + damage flash
    this.bubble.visible = p.shield
    if (p.shield) this.bubble.scale.set(0.95, 1.15, 0.95).multiplyScalar(1 + Math.sin(t * 8) * 0.03)
    const blink = p.invuln && Math.floor(t * 18) % 2 === 0
    this.root.visible = !blink || p.mode === 'hit'
    if (p.mode === 'hit') this.suit.color.copy(this.base).lerp(this.flash, Math.max(0, 1 - p.modeTime * 3) * 0.8)
    else this.suit.color.copy(this.base)
    this.syncSuit()
  }

  private expression(p: PoseInput): Expression {
    if (p.mode === 'hit' || p.mode === 'fall') return 'ouch'
    if (p.collect > 0.15 || p.dodge > 0.15 || (p.mode === 'jump' && p.vy > 2)) return 'excited'
    if (p.threat > 0.45) return 'worried'
    if (p.mode === 'run' || p.mode === 'slide') return 'run'
    return 'happy'
  }
}
