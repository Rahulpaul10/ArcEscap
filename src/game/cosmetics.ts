import * as THREE from 'three'
import type { Character, Outfit } from './characters'
import { clumpGeometry, hairCapGeometry } from './bodyparts'
import { geo } from './materials'

export type V3 = [number, number, number]
export interface Part {
  m: THREE.Mesh
  o: THREE.Mesh | null
  k: number
}

export interface Ctx {
  mk(parent: THREE.Object3D, g: THREE.BufferGeometry, mat: THREE.Material, pos: V3, scale?: V3, ol?: number): Part
  own<T extends THREE.BufferGeometry>(g: T): T
  chain(parent: THREE.Object3D, count: number, step: THREE.Vector3, list: THREE.Group[], piece: (i: number, seg: THREE.Group) => void): void
  mat: { hair: THREE.Material; trim: THREE.Material; glow: THREE.Material; suit: THREE.Material; gear: THREE.Material; acc: THREE.Material; dark: THREE.Material; lens: THREE.Material }
  /** head accessories group, body outfit group, backpack group */
  head: THREE.Group
  outfit: THREE.Group
  pack: THREE.Group
  hairBack: THREE.Group[]
  hairHang: THREE.Group[]
  /** garment panels that flutter (hem flaps, capes, hood, drawstrings) */
  cloth: THREE.Group[]
  /** torso surface depth at height y */
  front(y: number): number
  setHalo(m: THREE.Mesh): void
  core: THREE.Mesh
}

const rot = (p: Part, x: number, y: number, z: number) => {
  p.m.rotation.set(x, y, z)
  p.o?.rotation.set(x, y, z)
}

// ------------------------------------------------------------------ hair
const CAP = hairCapGeometry()

/** Hair dome with a natural hairline (above the brows, over the temples, down the nape). */
function cap(ctx: Ctx, s = 1): void {
  ctx.mk(ctx.head, CAP, ctx.mat.hair, [0, 0.2, 0.03], [0.318 * s, 0.312 * s, 0.318 * s])
}

/** Soft locks of hair falling over the forehead. */
function fringe(ctx: Ctx, kind: 'side' | 'center' | 'swept'): void {
  const g = ctx.own(clumpGeometry(0.12, 0.062, 'down'))
  const sets: Record<string, [number, number, number, number][]> = {
    side: [[-0.11, 0.405, -0.225, 0.25], [0.0, 0.415, -0.24, -0.05], [0.11, 0.405, -0.225, -0.3]],
    center: [[-0.12, 0.405, -0.22, 0.2], [-0.04, 0.418, -0.24, 0.05], [0.04, 0.418, -0.24, -0.05], [0.12, 0.405, -0.22, -0.2]],
    swept: [[-0.1, 0.41, -0.23, 0.9], [0.0, 0.42, -0.24, 0.8], [0.1, 0.41, -0.23, 0.7]],
  }
  for (const [x, y, z, rz] of sets[kind]) {
    const m = ctx.mk(ctx.head, g, ctx.mat.hair, [x, y, z], [1, 1, 1])
    m.m.rotation.set(0.5, 0, rz)
  }
}

function lock(ctx: Ctx, parent: THREE.Object3D, len: number, r: number, dir: 'down' | 'up' | 'back', pos: V3, scale: V3 = [1, 1, 1], rot: V3 = [0, 0, 0]): Part {
  const p = ctx.mk(parent, ctx.own(clumpGeometry(len, r, dir)), ctx.mat.hair, pos, scale)
  p.m.rotation.set(...rot)
  return p
}

export function buildHair(ctx: Ctx, c: Character): void {
  const a = ctx.head
  const hair = ctx.mat.hair
  switch (c.hairStyle) {
    case 'none':
      break
    case 'buzz':
      cap(ctx, 0.985)
      break
    case 'quiff': {
      cap(ctx)
      lock(ctx, a, 0.26, 0.11, 'up', [0, 0.5, -0.12], [1, 1, 1.1], [-0.55, 0, 0])
      lock(ctx, a, 0.2, 0.08, 'up', [0.1, 0.49, -0.04], [1, 1, 1], [-0.2, 0, -0.5])
      fringe(ctx, 'swept')
      break
    }
    case 'slick': {
      cap(ctx, 1.02)
      for (const x of [-0.12, -0.04, 0.04, 0.12]) lock(ctx, a, 0.42, 0.075, 'back', [x, 0.5, -0.17], [1, 1, 1], [0.12, 0, x * -1.2])
      break
    }
    case 'spikes': {
      cap(ctx)
      const pts: [number, number, number, number][] = [[-0.16, 0.46, -0.02, 0.5], [-0.08, 0.5, 0.06, 0.25], [0.08, 0.5, 0.06, -0.25], [0.16, 0.46, -0.02, -0.5], [0, 0.52, -0.12, 0], [0, 0.5, 0.16, 0]]
      for (const [x, y, z, rz] of pts) lock(ctx, a, 0.26, 0.07, 'up', [x, y, z], [1, 1, 1], [z > 0.1 ? 0.5 : z < -0.1 ? -0.45 : 0, 0, rz])
      fringe(ctx, 'center')
      break
    }
    case 'afro': {
      cap(ctx, 1.04)
      // a cloud of curls over the top and back of the head, leaving the face clear
      for (let i = 0; i < 26; i++) {
        const ang = i * 2.399 // golden angle spread
        const t = (i + 0.5) / 26
        const phi = Math.acos(1 - t * 1.25) // polar from top
        const x = Math.sin(phi) * Math.cos(ang) * 0.4
        const y = 0.22 + Math.cos(phi) * 0.4
        const z = 0.04 + Math.sin(phi) * Math.sin(ang) * 0.4
        if (z < -0.04 && y < 0.46) continue
        ctx.mk(a, geo.sphere, hair, [x, y, z], [0.13, 0.13, 0.13])
      }
      break
    }
    case 'curly': {
      cap(ctx)
      for (let i = 0; i < 12; i++) {
        const ang = i * 2.399
        const r = 0.06 + (i % 3) * 0.07
        const x = Math.cos(ang) * r
        const z = 0.0 + Math.sin(ang) * r * 1.1
        ctx.mk(a, geo.sphere, hair, [x, 0.5 + (0.1 - r * 0.5), z], [0.11, 0.1, 0.11])
      }
      fringe(ctx, 'center')
      break
    }
    case 'mohawk': {
      cap(ctx, 0.985)
      for (let i = 0; i < 7; i++) lock(ctx, a, 0.2 + (i % 2) * 0.06, 0.055, 'up', [0, 0.5, -0.18 + i * 0.07], [0.8, 1, 1], [(i - 3) * 0.1, 0, 0])
      break
    }
    case 'bun': {
      cap(ctx)
      fringe(ctx, 'side')
      ctx.mk(a, geo.sphere, hair, [0, 0.56, 0.08], [0.14, 0.12, 0.14])
      ctx.mk(a, geo.sphere, ctx.mat.acc, [0, 0.48, 0.07], [0.115, 0.02, 0.115])
      break
    }
    case 'twinbuns': {
      cap(ctx)
      fringe(ctx, 'center')
      for (const s of [-1, 1]) {
        ctx.mk(a, geo.sphere, hair, [s * 0.2, 0.53, 0.03], [0.13, 0.125, 0.13])
        ctx.mk(a, geo.sphere, ctx.mat.glow, [s * 0.17, 0.46, 0.02], [0.03, 0.03, 0.03])
      }
      break
    }
    case 'ponytail': {
      cap(ctx)
      fringe(ctx, 'side')
      ctx.mk(a, geo.sphere, ctx.mat.glow, [0, 0.36, 0.25], [0.045, 0.045, 0.045])
      const root = new THREE.Group()
      root.position.set(0, 0.36, 0.26)
      a.add(root)
      ctx.chain(root, 4, new THREE.Vector3(0, 0, 0.16), ctx.hairBack, (i, seg) => {
        lock(ctx, seg, 0.2, 0.075 - i * 0.012, 'back', [0, 0, 0], [1.1, 1, 1])
      })
      break
    }
    case 'bob': {
      cap(ctx, 1.02)
      fringe(ctx, 'side')
      for (const s of [-1, 1]) lock(ctx, a, 0.3, 0.1, 'down', [s * 0.27, 0.27, 0.0], [0.8, 1, 1.2], [0, 0, s * -0.08])
      lock(ctx, a, 0.28, 0.17, 'down', [0, 0.28, 0.2], [1.5, 1, 0.55])
      break
    }
    case 'pigtails': {
      cap(ctx)
      fringe(ctx, 'center')
      for (const s of [-1, 1]) {
        const root = new THREE.Group()
        root.position.set(s * 0.27, 0.24, 0.07)
        a.add(root)
        ctx.mk(a, geo.sphere, ctx.mat.glow, [s * 0.275, 0.27, 0.07], [0.045, 0.045, 0.035])
        ctx.chain(root, 3, new THREE.Vector3(0, -0.15, 0), ctx.hairHang, (i, seg) => {
          lock(ctx, seg, 0.17, 0.085 - i * 0.017, 'down', [0, 0, 0])
        })
      }
      break
    }
    case 'long': {
      cap(ctx, 1.02)
      fringe(ctx, 'side')
      for (const s of [-1, 1]) lock(ctx, a, 0.3, 0.075, 'down', [s * 0.28, 0.25, -0.02], [0.8, 1, 1], [0, 0, 0])
      const root = new THREE.Group()
      root.position.set(0, 0.26, 0.21)
      a.add(root)
      ctx.chain(root, 3, new THREE.Vector3(0, -0.2, 0), ctx.hairHang, (i, seg) => {
        lock(ctx, seg, 0.26, 0.2 - i * 0.04, 'down', [0, 0, 0], [1.3, 1, 0.55])
      })
      void hair
      break
    }
  }
}

// ------------------------------------------------------------------ accessories
export function buildAccessory(ctx: Ctx, c: Character): void {
  const a = ctx.head
  const { acc, glow, dark, lens, trim } = ctx.mat
  switch (c.accessory) {
    case 'none':
      break
    case 'headphones': {
      const band = ctx.own(new THREE.TorusGeometry(0.325, 0.028, 8, 22, Math.PI))
      const b = new THREE.Mesh(band, acc)
      b.position.set(0, 0.2, 0.02)
      a.add(b)
      for (const s of [-1, 1]) {
        ctx.mk(a, geo.sphere, acc, [s * 0.325, 0.19, 0.02], [0.075, 0.11, 0.1], 1.1)
        ctx.mk(a, geo.sphere, glow, [s * 0.4, 0.19, 0.02], [0.02, 0.06, 0.06], 0)
      }
      break
    }
    case 'headband': {
      const band = ctx.mk(a, ctx.own(new THREE.TorusGeometry(0.3, 0.03, 8, 24)), acc, [0, 0.37, 0.02], [1, 1, 1], 1.15)
      rot(band, Math.PI / 2 + 0.12, 0, 0)
      break
    }
    case 'shades': {
      for (const s of [-1, 1]) ctx.mk(a, geo.sphere, lens, [s * 0.1, 0.215, -0.335], [0.105, 0.075, 0.035], 1.1)
      ctx.mk(a, geo.box, acc, [0, 0.225, -0.335], [0.1, 0.02, 0.025], 0)
      ctx.mk(a, geo.box, acc, [0, 0.235, -0.28], [0.6, 0.018, 0.02], 0)
      break
    }
    case 'glasses': {
      const ring = ctx.own(new THREE.TorusGeometry(0.1, 0.014, 6, 18))
      for (const s of [-1, 1]) {
        const r = new THREE.Mesh(ring, acc)
        r.position.set(s * 0.1, 0.215, -0.34)
        a.add(r)
      }
      ctx.mk(a, geo.box, acc, [0, 0.225, -0.34], [0.05, 0.014, 0.014], 0)
      for (const s of [-1, 1]) ctx.mk(a, geo.box, acc, [s * 0.215, 0.22, -0.27], [0.018, 0.014, 0.2], 0)
      break
    }
    case 'goggles': {
      const strap = ctx.mk(a, ctx.own(new THREE.TorusGeometry(0.3, 0.025, 6, 24)), dark, [0, 0.38, 0.02], [1, 1, 1], 0)
      rot(strap, Math.PI / 2 + 0.15, 0, 0)
      for (const s of [-1, 1]) {
        ctx.mk(a, geo.sphere, acc, [s * 0.1, 0.42, -0.27], [0.1, 0.085, 0.06], 1.1)
        ctx.mk(a, geo.sphere, glow, [s * 0.1, 0.42, -0.305], [0.072, 0.058, 0.03], 0)
      }
      break
    }
    case 'cap':
    case 'capback': {
      ctx.mk(a, geo.sphere, acc, [0, 0.38, 0.0], [0.33, 0.22, 0.33], 1.05)
      const front = c.accessory === 'cap'
      const brim = ctx.mk(a, geo.box, acc, [0, 0.34, front ? -0.34 : 0.34], [0.3, 0.025, 0.2], 1.15)
      rot(brim, front ? 0.12 : -0.12, 0, 0)
      ctx.mk(a, geo.sphere, glow, [0, 0.5, -0.02], [0.035, 0.03, 0.035], 0)
      break
    }
    case 'beanie': {
      ctx.mk(a, geo.sphere, acc, [0, 0.35, 0.02], [0.33, 0.25, 0.33], 1.05)
      const fold = ctx.mk(a, ctx.own(new THREE.TorusGeometry(0.3, 0.045, 8, 24)), trim, [0, 0.31, 0.02], [1, 1, 1], 1.1)
      rot(fold, Math.PI / 2 + 0.1, 0, 0)
      ctx.mk(a, geo.sphere, trim, [0, 0.6, 0.02], [0.075, 0.075, 0.075], 1.12)
      break
    }
    case 'bandana': {
      const band = ctx.mk(a, ctx.own(new THREE.TorusGeometry(0.3, 0.035, 8, 24)), acc, [0, 0.36, 0.02], [1, 1, 1], 1.12)
      rot(band, Math.PI / 2 + 0.1, 0, 0)
      ctx.mk(a, geo.sphere, acc, [0, 0.36, 0.31], [0.07, 0.07, 0.06], 1.1)
      break
    }
    case 'antennae': {
      for (const s of [-1, 1]) {
        rot(ctx.mk(a, geo.box, trim, [s * 0.14, 0.52, 0], [0.03, 0.3, 0.03], 1.2), 0, 0, -s * 0.3)
        ctx.mk(a, geo.sphere, glow, [s * 0.22, 0.68, 0], [0.065, 0.065, 0.065], 1.15)
      }
      break
    }
    case 'halo': {
      const ring = new THREE.Mesh(ctx.own(new THREE.TorusGeometry(0.27, 0.028, 8, 28)), glow)
      ring.rotation.x = Math.PI / 2
      ring.position.y = 0.62
      a.add(ring)
      ctx.setHalo(ring)
      break
    }
    case 'bow': {
      for (const s of [-1, 1]) ctx.mk(a, geo.sphere, acc, [0.2 + s * 0.07, 0.5, -0.06], [0.07, 0.05, 0.045], 1.15)
      ctx.mk(a, geo.sphere, glow, [0.2, 0.5, -0.06], [0.04, 0.04, 0.04], 1.15)
      break
    }
    case 'catears': {
      const ear = ctx.own(new THREE.ConeGeometry(0.1, 0.22, 4))
      for (const s of [-1, 1]) {
        rot(ctx.mk(a, ear, acc, [s * 0.19, 0.5, 0.02], [1, 1, 0.6], 1.12), 0, 0, -s * 0.3)
        rot(ctx.mk(a, ear, ctx.mat.glow, [s * 0.19, 0.49, -0.015], [0.55, 0.65, 0.4], 0), 0, 0, -s * 0.3)
      }
      break
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2
        ctx.mk(a, geo.sphere, acc, [-0.2 + Math.cos(ang) * 0.055, 0.46 + Math.sin(ang) * 0.055, -0.09], [0.04, 0.04, 0.025], 1.15)
      }
      ctx.mk(a, geo.sphere, glow, [-0.2, 0.46, -0.1], [0.035, 0.035, 0.03], 1.1)
      break
    }
    case 'visor': {
      ctx.mk(a, geo.box, lens, [0, 0.22, -0.3], [0.54, 0.09, 0.05], 0)
      ctx.mk(a, geo.box, glow, [0, 0.22, -0.328], [0.5, 0.03, 0.01], 0)
      for (const s of [-1, 1]) ctx.mk(a, geo.sphere, acc, [s * 0.29, 0.22, -0.12], [0.04, 0.07, 0.1], 1.1)
      break
    }
  }
}

// ------------------------------------------------------------------ outfits
export const OUTFIT_TRAITS: Record<Outfit, { pads: boolean; belt: boolean; emblem: boolean }> = {
  jacket: { pads: false, belt: false, emblem: true },
  hoodie: { pads: false, belt: false, emblem: true },
  armor: { pads: false, belt: true, emblem: false },
  jersey: { pads: false, belt: false, emblem: true },
  techsuit: { pads: false, belt: false, emblem: true },
  puffer: { pads: false, belt: false, emblem: false },
  overalls: { pads: false, belt: false, emblem: false },
  dress: { pads: false, belt: true, emblem: true },
  vest: { pads: false, belt: false, emblem: false },
}

/** A thin garment panel hanging from a point (hem flap, drawstring, cape). Registered as cloth so it flutters. */
function flap(ctx: Ctx, parent: THREE.Object3D, mat: THREE.Material, pos: V3, w: number, h: number, count: number): void {
  const root = new THREE.Group()
  root.position.set(...pos)
  parent.add(root)
  ctx.chain(root, count, new THREE.Vector3(0, -h, 0), ctx.cloth, (_i, seg) => {
    ctx.mk(seg, geo.box, mat, [0, -h / 2, 0], [w, h * 1.04, 0.02])
  })
}

function ring(ctx: Ctx, parent: THREE.Object3D, mat: THREE.Material, y: number, rx: number, rz: number, thick: number): void {
  ctx.mk(parent, ctx.own(new THREE.CylinderGeometry(0.5, 0.5, 1, 24)), mat, [0, y, 0], [rx * 2, thick, rz * 2])
}

export function buildOutfit(ctx: Ctx, c: Character): void {
  const a = ctx.outfit
  const { acc, glow, gear, trim, suit } = ctx.mat
  const ch = c.chest
  const fz = (y: number) => -(ctx.front(y) + 0.006)
  const collar = (mat: THREE.Material, r = 0.108) => {
    const t = ctx.mk(a, ctx.own(new THREE.TorusGeometry(r, 0.026, 8, 20)), mat, [0, 0.745, 0], [1.05 * (ch > 1 ? 1.05 : 1), 1, 1])
    t.m.rotation.x = Math.PI / 2
  }
  switch (c.outfit) {
    case 'jacket': {
      // zip jacket: stand collar, front zip, ribbed hem and cuffs, two hem flaps that swing
      collar(trim)
      for (let i = 0; i < 6; i++) {
        const y = 0.66 - i * 0.1
        ctx.mk(a, geo.box, acc, [0, y, fz(y)], [0.016, 0.1, 0.01])
      }
      ring(ctx, a, trim, -0.005, 0.2 * ch + 0.01, 0.17, 0.05)
      flap(ctx, a, suit, [-0.12 * ch, 0.0, 0.1], 0.13, 0.1, 2)
      flap(ctx, a, suit, [0.12 * ch, 0.0, 0.1], 0.13, 0.1, 2)
      break
    }
    case 'dress': {
      collar(trim, 0.1)
      ring(ctx, a, trim, 0.2, 0.17 * ch + 0.02, 0.14, 0.05)
      break
    }
    case 'hoodie': {
      // bunched hood, kangaroo pocket, drawstrings
      ctx.mk(a, geo.sphere, acc, [0, 0.72, 0.13], [0.17 * Math.max(1, ch * 0.9), 0.11, 0.1])
      flap(ctx, a, acc, [0, 0.72, 0.2], 0.2, 0.09, 2)
      ctx.mk(a, geo.box, acc, [0, 0.15, fz(0.15) + 0.005], [0.3 * ch, 0.12, 0.035])
      for (const s of [-1, 1]) flap(ctx, a, gear, [s * 0.04, 0.68, fz(0.68) - 0.005], 0.014, 0.1, 2)
      break
    }
    case 'armor': {
      // leather jerkin: shoulder straps, diagonal strap, belt buckle and hip pouch
      for (const s of [-1, 1]) ctx.mk(a, geo.box, acc, [s * 0.15 * ch, 0.69, 0], [0.05, 0.03, 0.34])
      const strap = ctx.mk(a, geo.box, acc, [0, 0.4, fz(0.4) + 0.002], [0.055, 0.7, 0.025])
      strap.m.rotation.z = 0.55
      ctx.mk(a, geo.box, trim, [0, 0.06, fz(0.06) - 0.004], [0.07, 0.06, 0.02])
      ctx.mk(a, geo.box, acc, [0.19 * ch, 0.0, -0.03], [0.1, 0.12, 0.09])
      break
    }
    case 'jersey': {
      collar(acc, 0.1)
      for (const y of [0.27, 0.34]) ring(ctx, a, y > 0.3 ? gear : acc, y, 0.2 * ch + 0.003, 0.162, 0.034)
      break
    }
    case 'techsuit': {
      // fitted suit with thin Arc-coloured piping
      collar(trim, 0.1)
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const y = 0.12 + i * 0.1
          ctx.mk(a, geo.box, glow, [s * 0.15 * ch, y, fz(y) + 0.003], [0.014, 0.1, 0.008])
        }
      }
      break
    }
    case 'puffer': {
      // quilted vest: soft horizontal puffs and a high collar
      for (const y of [0.12, 0.29, 0.46]) ring(ctx, a, acc, y, 0.21 * ch + 0.012, 0.17, 0.16)
      ctx.mk(a, geo.sphere, acc, [0, 0.71, 0], [0.16, 0.07, 0.14])
      break
    }
    case 'overalls': {
      for (const s of [-1, 1]) {
        const st = ctx.mk(a, geo.box, acc, [s * 0.12 * ch, 0.5, fz(0.5) + 0.002], [0.05, 0.36, 0.02])
        st.m.rotation.z = s * 0.06
        ctx.mk(a, geo.sphere, gear, [s * 0.125 * ch, 0.32, fz(0.32) - 0.006], [0.026, 0.026, 0.012])
      }
      ctx.mk(a, geo.box, acc, [0, 0.24, fz(0.24) + 0.004], [0.28 * ch, 0.2, 0.03])
      ctx.mk(a, geo.box, trim, [0, 0.22, fz(0.22) - 0.006], [0.11, 0.07, 0.01])
      break
    }
    case 'vest': {
      // explorer vest: bandolier strap, chest pocket, collar
      collar(acc, 0.105)
      const strap = ctx.mk(a, geo.box, acc, [0, 0.38, fz(0.38) + 0.002], [0.06, 0.7, 0.025])
      strap.m.rotation.z = 0.6
      ctx.mk(a, geo.box, acc, [-0.1 * ch, 0.45, fz(0.45) + 0.003], [0.1, 0.09, 0.025])
      ctx.mk(a, geo.box, acc, [0.18 * ch, 0.08, -0.02], [0.1, 0.1, 0.07])
      break
    }
  }
}

// ------------------------------------------------------------------ backpacks
export function buildPack(ctx: Ctx, c: Character): void {
  const a = ctx.pack
  const { suit, trim, acc } = ctx.mat
  const ch = c.chest
  const straps = (m: THREE.Material) => {
    for (const s of [-1, 1]) {
      const st = ctx.mk(ctx.outfit, geo.box, m, [s * 0.14 * ch, 0.52, -ctx.front(0.52) - 0.004], [0.04, 0.32, 0.016])
      st.m.rotation.z = s * -0.08
    }
  }
  switch (c.pack) {
    case 'core':
      // compact backpack with a small Arc energy cell
      ctx.mk(a, ctx.own(new THREE.CapsuleGeometry(0.12, 0.18, 4, 12)), suit, [0, 0.4, 0.25], [1.25, 1, 0.8])
      ctx.core.position.set(0, 0.42, 0.34)
      straps(acc)
      break
    case 'wings': {
      // short flowing cape in three hanging panels
      for (const s of [-1, 1]) {
        ctx.mk(ctx.outfit, geo.box, trim, [s * 0.2 * ch, 0.68, 0.0], [0.05, 0.03, 0.3])
      }
      ctx.chain(a, 3, new THREE.Vector3(0, -0.2, 0), ctx.cloth, (i, seg) => {
        if (i === 0) seg.position.set(0, 0.7, 0.2)
        ctx.mk(seg, geo.box, suit, [0, -0.1, 0], [0.4 * ch - i * 0.04, 0.21, 0.025])
      })
      ctx.core.position.set(0, 0.36, 0.26)
      break
    }
    case 'tank':
      // hiker's pack with a bedroll on top
      ctx.mk(a, geo.box, acc, [0, 0.38, 0.25], [0.3, 0.38, 0.16])
      ctx.mk(a, ctx.own(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 12)), trim, [0, 0.62, 0.25], [1, 1, 1]).m.rotation.z = Math.PI / 2
      ctx.core.position.set(0, 0.3, 0.34)
      straps(acc)
      break
    case 'bag':
      // shoulder satchel
      ctx.mk(a, geo.box, acc, [0, 0.3, 0.24], [0.32, 0.24, 0.12])
      ctx.mk(a, geo.box, trim, [0, 0.4, 0.31], [0.28, 0.05, 0.02])
      ctx.core.position.set(0, 0.62, 0.27)
      straps(acc)
      break
    case 'none':
      ctx.core.position.set(0, 0.45, 0.22)
      break
  }
}
