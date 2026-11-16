/**
 * Pure pose functions for the runner rig. Every character uses the same poses, so animation is
 * identical across the roster. Angles are radians; positive thigh/arm X swings the limb forward (-Z).
 */
export interface Pose {
  /** pelvis height */
  by: number
  /** pelvis pitch (negative leans forward) */
  lean: number
  /** pelvis yaw */
  twist: number
  /** pelvis roll */
  roll: number
  /** chest yaw relative to the pelvis (counter-rotation) and extra chest pitch */
  ct: number
  cp: number
  tL: number
  tR: number
  kL: number
  kR: number
  /** ankle pitch (positive lifts the toes) */
  ankL: number
  ankR: number
  aL: number
  aR: number
  eL: number
  eR: number
  /** outward arm flare */
  azL: number
  azR: number
  /** head pitch / yaw */
  hx: number
  hy: number
}

export const makePose = (): Pose => ({
  by: 0.95, lean: 0, twist: 0, roll: 0, ct: 0, cp: 0, tL: 0, tR: 0, kL: 0, kR: 0, ankL: 0, ankR: 0,
  aL: 0, aR: 0, eL: 0, eR: 0, azL: 0, azR: 0, hx: 0, hy: 0,
})

const KEYS = Object.keys(makePose()) as (keyof Pose)[]
export const smooth = (x: number) => x * x * (3 - 2 * x)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export function lerpPose(out: Pose, a: Pose, b: Pose, k: number): void {
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k
}

/** Swap left and right so the same pose can lead with either leg. */
export function mirrorPose(o: Pose): void {
  ;[o.tL, o.tR] = [o.tR, o.tL]
  ;[o.kL, o.kR] = [o.kR, o.kL]
  ;[o.ankL, o.ankR] = [o.ankR, o.ankL]
  ;[o.aL, o.aR] = [o.aR, o.aL]
  ;[o.eL, o.eR] = [o.eR, o.eL]
  ;[o.azL, o.azR] = [o.azR, o.azL]
  o.twist = -o.twist
  o.roll = -o.roll
  o.ct = -o.ct
  o.hy = -o.hy
}

export function poseIdle(o: Pose, t: number): void {
  const b = Math.sin(t * 2)
  Object.assign(o, makePose())
  o.by = 0.95 + b * 0.012
  o.lean = -0.03 + b * 0.008
  o.tL = o.tR = 0.04
  o.aL = 0.08 + b * 0.04
  o.aR = 0.08 - b * 0.04
  o.eL = o.eR = 0.35
  o.azL = o.azR = 0.12
  o.hy = Math.sin(t * 0.7) * 0.15
  o.ct = Math.sin(t * 0.9) * 0.03
}

/** Athletic sprint: asymmetric stride, deep knee drive, 90 degree elbows, counter-rotating pelvis and chest. */
export function poseRun(o: Pose, ph: number, amp: number, sn: number, boost: boolean, threat: number): void {
  const s = Math.sin(ph)
  const c = Math.cos(ph)
  const swing = (0.95 + 0.3 * sn) * (1 - 0.25 * threat) * (boost ? 1.15 : 1)
  // legs: long reach forward, shorter push behind; the knee folds high while the leg recovers
  o.tL = 0.2 + s * amp * 0.88
  o.tR = 0.2 - s * amp * 0.88
  o.kL = -(0.3 + 1.75 * Math.pow(Math.max(0, c), 1.3))
  o.kR = -(0.3 + 1.75 * Math.pow(Math.max(0, -c), 1.3))
  // feet: toes lift as the leg swings through, point on push-off
  o.ankL = 0.3 * Math.max(0, c) - 0.6 * Math.max(0, -s)
  o.ankR = 0.3 * Math.max(0, -c) - 0.6 * Math.max(0, s)
  // arms drive opposite to the legs with bent elbows
  o.aL = 0.2 - s * swing
  o.aR = 0.2 + s * swing
  o.eL = 1.45 - 0.28 * s + threat * 0.2
  o.eR = 1.45 + 0.28 * s + threat * 0.2
  o.azL = o.azR = 0.1
  // pelvis rotates with the leading hip, chest counter-rotates with the arms
  o.twist = -s * 0.16
  o.ct = s * 0.32
  o.roll = c * 0.05
  o.by = 0.85 + s * s * 0.105
  o.lean = -0.3 - sn * 0.15 - (boost ? 0.1 : 0) + threat * 0.04
  o.cp = -0.08
  o.hx = 0.12 + threat * 0.1
  o.hy = -(o.twist + o.ct) * 0.85
}

export const K_RISE = makePose()
export const K_APEX = makePose()
export const K_FALL = makePose()
Object.assign(K_RISE, {
  by: 0.99, lean: -0.3, cp: -0.1, tL: 1.55, tR: -0.55, kL: -1.7, kR: -1.15, ankL: 0.1, ankR: -0.7,
  aL: 2.3, aR: -0.5, eL: 0.55, eR: 1.1, azL: 0.3, azR: 0.35, hx: 0.1, twist: -0.1, ct: 0.15,
})
Object.assign(K_APEX, {
  by: 0.96, lean: -0.16, tL: 1.2, tR: 0.95, kL: -2.0, kR: -1.8, ankL: -0.3, ankR: -0.4,
  aL: 1.3, aR: 1.1, eL: 1.0, eR: 1.0, azL: 0.4, azR: 0.4,
})
Object.assign(K_FALL, {
  by: 0.97, lean: 0.02, tL: 0.7, tR: -0.15, kL: -0.45, kR: -0.3, ankL: 0.3, ankR: 0.2,
  aL: 1.0, aR: 1.5, eL: 0.4, eR: 0.5, azL: 0.9, azR: 0.9, hx: 0.05,
})

/** a: +1 rising fast, 0 apex, -1 falling fast */
export function poseAir(o: Pose, a: number, t: number): void {
  lerpPose(o, K_APEX, a >= 0 ? K_RISE : K_FALL, smooth(Math.abs(a)))
  o.aL += Math.sin(t * 9) * 0.06
  o.aR += Math.sin(t * 9 + 2) * 0.06
}

export function poseSlide(o: Pose, t: number): void {
  Object.assign(o, makePose())
  o.by = 0.46
  o.lean = 1.3
  o.cp = 0.15
  o.tL = 0.45
  o.kL = -0.15
  o.tR = 1.0
  o.kR = -1.7
  o.ankL = 0.4
  o.aL = -1.1
  o.aR = -0.6
  o.eL = 0.3
  o.eR = 0.5
  o.azL = 0.5
  o.azR = 0.35
  o.hx = -0.85
  o.roll = 0.1 + Math.sin(t * 12) * 0.015
}

export function poseHit(o: Pose, modeTime: number): void {
  Object.assign(o, makePose())
  const k = smooth(clamp01(modeTime / 0.4))
  const lie = smooth(clamp01((modeTime - 0.25) / 0.35))
  o.lean = 0.25 + k * 0.85 + lie * 0.45
  o.by = 0.95 - k * 0.3 - lie * 0.2
  o.tL = 0.6 + lie * 0.3
  o.tR = -0.4
  o.kL = o.kR = -0.7 - lie * 0.5
  o.aL = 2.2 * (1 - k) + 0.3
  o.aR = 2.4 * (1 - k) + 0.1
  o.eL = o.eR = 0.5
  o.azL = 0.4 + k * 1.0
  o.azR = 0.4 + k * 1.1
  o.hx = -0.5 * k
  o.ct = -0.4 * k
  o.roll = Math.sin(modeTime * 10) * 0.12 * (1 - lie)
}

export function poseFall(o: Pose, t: number, modeTime: number): void {
  Object.assign(o, makePose())
  const tumble = Math.min(modeTime, 1.2)
  o.lean = -0.3 - tumble * 2.2
  o.by = 0.95
  o.tL = Math.sin(t * 15) * 0.9 + 0.3
  o.tR = Math.sin(t * 15 + Math.PI) * 0.9 + 0.3
  o.kL = -0.9 - Math.sin(t * 15) * 0.5
  o.kR = -0.9 + Math.sin(t * 15) * 0.5
  o.aL = 2.3 + Math.sin(t * 18) * 0.6
  o.aR = 2.3 + Math.sin(t * 18 + Math.PI) * 0.6
  o.eL = o.eR = 0.3
  o.azL = o.azR = 0.7
  o.hx = 0.2
}
