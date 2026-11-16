import * as THREE from 'three'

/** Tapered limb hanging down -Y from its joint: radius at the top, widest point, and the far joint. */
export function limbGeometry(len: number, rTop: number, rMid: number, rBot: number, midAt = 0.4): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(0.001, 0.004),
    new THREE.Vector2(rTop * 0.8, 0.0),
    new THREE.Vector2(rTop, -len * 0.08),
    new THREE.Vector2(rMid, -len * midAt),
    new THREE.Vector2(rBot, -len * 0.96),
    new THREE.Vector2(rBot * 0.7, -len),
    new THREE.Vector2(0.001, -len - 0.004),
  ]
  return new THREE.LatheGeometry(pts, 14)
}

const TORSO_M: [number, number][] = [[0.001, -0.03], [0.18, -0.01], [0.2, 0.07], [0.18, 0.24], [0.215, 0.4], [0.25, 0.54], [0.245, 0.62], [0.17, 0.69], [0.08, 0.735], [0.001, 0.75]]
const TORSO_F: [number, number][] = [[0.001, -0.03], [0.185, -0.01], [0.215, 0.07], [0.16, 0.24], [0.19, 0.4], [0.225, 0.52], [0.213, 0.61], [0.15, 0.69], [0.07, 0.735], [0.001, 0.75]]

/** Torso lathe: broad shoulders and narrow waist (male) or softer shoulders, defined waist and wider hips (female). y 0 (hips) to 0.75. */
export function torsoGeometry(female = false): THREE.LatheGeometry {
  return new THREE.LatheGeometry((female ? TORSO_F : TORSO_M).map(([r, y]) => new THREE.Vector2(r, y)), 24)
}

/** Depth (Z half-size) of the torso surface at height y, so garment details can sit on the body. */
export function torsoFront(y: number, female: boolean): number {
  const pts = female ? TORSO_F : TORSO_M
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][1]) {
      const [r0, y0] = pts[i - 1]
      const [r1, y1] = pts[i]
      return (r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1)) * 0.8
    }
  }
  return 0.06
}

/** Open dome of hair that frames the face: hairline above the brows, covers temples and the back of the head. Unit size. */
export function hairCapGeometry(): THREE.SphereGeometry {
  const g = new THREE.SphereGeometry(1, 30, 18, 0, Math.PI * 2, 0, Math.PI * 0.486)
  g.rotateX(0.567)
  return g
}

/** Tapered lock of hair (root radius r, length len). dir picks which way it points from the origin. */
export function clumpGeometry(len: number, r: number, dir: 'down' | 'up' | 'back' = 'down'): THREE.LatheGeometry {
  const pts = [
    [0.001, 0.0], [r * 0.85, -len * 0.04], [r, -len * 0.25], [r * 0.82, -len * 0.55], [r * 0.45, -len * 0.85], [0.001, -len],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const g = new THREE.LatheGeometry(pts, 10)
  if (dir === 'up') g.rotateX(Math.PI)
  else if (dir === 'back') g.rotateX(-Math.PI / 2)
  return g
}

/** Skull with a tapered jaw and chin. Unit sphere: scale it to the head size. */
export function headGeometry(): THREE.SphereGeometry {
  const g = new THREE.SphereGeometry(1, 28, 22)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    if (y < 0) {
      const t = -y
      x *= 1 - 0.34 * t * t - 0.07 * t
      z *= 1 - 0.13 * t
      y *= 1.1
      if (z < 0) z -= 0.03 * t * t // chin juts forward
    }
    pos.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

/** Painted iris: dark limbal ring, coloured iris with radial fibres, pupil and a catch light. Tinted by material colour. */
export function irisTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const m = 64
  const base = g.createRadialGradient(m, m, 6, m, m, 62)
  base.addColorStop(0, '#ffffff')
  base.addColorStop(0.55, '#d8d8d8')
  base.addColorStop(0.85, '#8a8a8a')
  base.addColorStop(1, '#2a2a2a')
  g.fillStyle = base
  g.beginPath()
  g.arc(m, m, 62, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(0,0,0,0.25)'
  g.lineWidth = 1.5
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    g.beginPath()
    g.moveTo(m + Math.cos(a) * 18, m + Math.sin(a) * 18)
    g.lineTo(m + Math.cos(a) * 56, m + Math.sin(a) * 56)
    g.stroke()
  }
  g.fillStyle = '#05040a'
  g.beginPath()
  g.arc(m, m, 22, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.beginPath()
  g.arc(m - 20, m - 22, 9, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.5)'
  g.beginPath()
  g.arc(m + 18, m + 20, 4, 0, Math.PI * 2)
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface Hand {
  root: THREE.Group
  /** four finger roots (first knuckle) */
  fingers: THREE.Group[]
  /** second joint of each finger */
  tips: THREE.Group[]
  thumb: THREE.Group
}

const finger1 = new THREE.CapsuleGeometry(0.0115, 0.032, 3, 8)
const finger2 = new THREE.CapsuleGeometry(0.0105, 0.024, 3, 8)
const thumbGeo = new THREE.CapsuleGeometry(0.0125, 0.03, 3, 8)
const palmGeo = new THREE.SphereGeometry(1, 12, 10)
const cuffGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 14)

/** Articulated hand hanging from the wrist. Palm faces the body; fingers curl toward it. */
export function buildHand(skin: THREE.Material, cuff: THREE.Material): Hand {
  const root = new THREE.Group()
  const mk = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(g, m)
    mesh.castShadow = true
    return mesh
  }
  const cf = mk(cuffGeo, cuff)
  cf.scale.set(0.1, 0.04, 0.095)
  cf.position.y = -0.005
  root.add(cf)
  const palm = mk(palmGeo, skin)
  palm.scale.set(0.024, 0.05, 0.043)
  palm.position.y = -0.052
  root.add(palm)
  const fingers: THREE.Group[] = []
  const tips: THREE.Group[] = []
  const lens = [0.95, 1.05, 1, 0.85]
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group()
    f.position.set(0, -0.092, (i - 1.5) * 0.02)
    f.scale.setScalar(lens[i])
    const seg1 = mk(finger1, skin)
    seg1.position.y = -0.03
    f.add(seg1)
    const t = new THREE.Group()
    t.position.y = -0.062
    const seg2 = mk(finger2, skin)
    seg2.position.y = -0.022
    t.add(seg2)
    f.add(t)
    root.add(f)
    fingers.push(f)
    tips.push(t)
  }
  const thumb = new THREE.Group()
  thumb.position.set(0, -0.04, -0.04)
  thumb.rotation.x = 0.5
  const th = mk(thumbGeo, skin)
  th.position.y = -0.025
  thumb.add(th)
  root.add(thumb)
  return { root, fingers, tips, thumb }
}
