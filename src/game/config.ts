import * as THREE from 'three'

export const LANE_W = 2.4
export const ROW_LEN = 4
export const ROAD_W = LANE_W * 3 + 1.4
export const AHEAD = 132
export const BEHIND = 28

export const GRAVITY = 50
export const JUMP_V = 17.5
export const BASE_SPEED = 15
export const MAX_SPEED = 37
export const STAND_H = 1.7
export const SLIDE_H = 0.7
export const SLIDE_TIME = 0.78
export const MILESTONE_STEP = 500
export const SECTION_LEN = 900
export const BLEND_LEN = 160

export const POWER_DURATION = { shield: 12, magnet: 10, boost: 5 } as const
export const HAZARD = 0xff4d5e
export const ENERGY_COLOR = 0xffc83d

export interface Theme {
  name: string
  sky: number
  fog: number
  accent: number
  accent2: number
  ambient: number
  sun: number
}

export const THEMES: Theme[] = [
  { name: 'Neon Core', sky: 0x070a1f, fog: 0x0a1030, accent: 0x35f2ff, accent2: 0xff3df0, ambient: 0x4a5cff, sun: 0xff3df0 },
  { name: 'Solar Bridge', sky: 0x2b0f2c, fog: 0x4a1a3a, accent: 0xffa63d, accent2: 0xff4d8d, ambient: 0xff8a5c, sun: 0xffb347 },
  { name: 'Mint District', sky: 0x03201c, fog: 0x07302a, accent: 0x3dffb0, accent2: 0xb6ff3d, ambient: 0x3dd6a0, sun: 0x3dffb0 },
  { name: 'Void Nexus', sky: 0x0d0626, fog: 0x1a0c44, accent: 0xa56bff, accent2: 0x4d9dff, ambient: 0x7a5cff, sun: 0xa56bff },
]

/** Live, blended theme colors. Mutated every frame by blendTheme. */
export const live = {
  sky: new THREE.Color(THEMES[0].sky),
  fog: new THREE.Color(THEMES[0].fog),
  accent: new THREE.Color(THEMES[0].accent),
  accent2: new THREE.Color(THEMES[0].accent2),
  ambient: new THREE.Color(THEMES[0].ambient),
  sun: new THREE.Color(THEMES[0].sun),
  name: THEMES[0].name,
  section: 0,
}

const cache = THEMES.map((t) => ({
  sky: new THREE.Color(t.sky),
  fog: new THREE.Color(t.fog),
  accent: new THREE.Color(t.accent),
  accent2: new THREE.Color(t.accent2),
  ambient: new THREE.Color(t.ambient),
  sun: new THREE.Color(t.sun),
}))

const smooth = (x: number) => x * x * (3 - 2 * x)

export function blendTheme(dist: number): void {
  const sec = Math.floor(dist / SECTION_LEN)
  const local = dist - sec * SECTION_LEN
  const ia = sec % THEMES.length
  const ib = (sec + 1) % THEMES.length
  const t = local > SECTION_LEN - BLEND_LEN ? smooth((local - (SECTION_LEN - BLEND_LEN)) / BLEND_LEN) : 0
  const a = cache[ia]
  const b = cache[ib]
  live.sky.copy(a.sky).lerp(b.sky, t)
  live.fog.copy(a.fog).lerp(b.fog, t)
  live.accent.copy(a.accent).lerp(b.accent, t)
  live.accent2.copy(a.accent2).lerp(b.accent2, t)
  live.ambient.copy(a.ambient).lerp(b.ambient, t)
  live.sun.copy(a.sun).lerp(b.sun, t)
  live.name = t > 0.5 ? THEMES[ib].name : THEMES[ia].name
  live.section = t > 0.5 ? sec + 1 : sec
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
