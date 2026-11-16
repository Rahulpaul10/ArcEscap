import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ARC_MARK_PATH } from './arcMark'
import { HAZARD, LANE_W, ROAD_W, live } from './config'

/** Shared "world bend" uniform: curves the horizon left/right and up/down for the winding-road feel. */
export const bendUniform = { value: new THREE.Vector2(0, 0) }

export function bend<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bendUniform
    shader.vertexShader =
      'uniform vec2 uBend;\n' +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_BATCHING
        mvPosition = batchingMatrix * mvPosition;
      #endif
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      float bendZ = max(-mvPosition.z - 9.0, 0.0);
      mvPosition.x += uBend.x * bendZ * bendZ;
      mvPosition.y += uBend.y * bendZ * bendZ;
      gl_Position = projectionMatrix * mvPosition;
    `,
      )
  }
  return m
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// ----------------------------------------------------------------- textures
const roadTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  const u = (x: number) => ((x + ROAD_W / 2) / ROAD_W) * w
  // soft lane glow
  for (const x of [-LANE_W, 0, LANE_W]) {
    const grad = g.createLinearGradient(u(x - 1.1), 0, u(x + 1.1), 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.10)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(u(x - 1.1), 0, u(x + 1.1) - u(x - 1.1), h)
  }
  // dashed dividers
  g.fillStyle = 'rgba(255,255,255,0.65)'
  for (const x of [-LANE_W / 2, LANE_W / 2]) g.fillRect(u(x) - 2, h * 0.22, 4, h * 0.56)
  // glowing edge rails
  for (const side of [-1, 1]) {
    const x = (side * (ROAD_W / 2 - 0.35))
    g.fillStyle = '#fff'
    g.fillRect(u(x) - 3, 0, 6, h)
    const grad = g.createLinearGradient(u(x), 0, u(x - side * 0.9), 0)
    grad.addColorStop(0, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(Math.min(u(x), u(x - side * 0.9)), 0, Math.abs(u(x) - u(x - side * 0.9)), h)
  }
  // seam
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.fillRect(0, 0, w, 2)
})

function windowTex(cols: number, rows: number, seed: number): THREE.CanvasTexture {
  const cell = 16
  const t = canvasTex(cols * cell, rows * cell, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    let s = seed
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const tints = ['#ffe6b0', '#ffd08a', '#bfe8ff', '#9fd8ff', '#ffffff', '#ffb3f0']
    for (let y = 0; y < rows; y++) {
      const bandLit = rnd() > 0.82
      for (let x = 0; x < cols; x++) {
        if (bandLit || rnd() > 0.5) {
          g.fillStyle = tints[Math.floor(rnd() * tints.length)]
          g.globalAlpha = bandLit ? 0.9 : 0.35 + rnd() * 0.65
          g.fillRect(x * cell + 3, y * cell + 4, cell - 6, cell - 8)
        }
      }
      g.globalAlpha = 0.5
      g.fillStyle = '#9fd8ff'
      if (y % 6 === 5) g.fillRect(0, y * cell + cell - 3, w, 2)
    }
    g.globalAlpha = 1
    // vertical mullions
    g.fillStyle = 'rgba(0,0,0,0.65)'
    for (let x = 0; x <= cols; x++) g.fillRect(x * cell - 1, 0, 2, h)
  })
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 8
  return t
}

const gridTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(255,255,255,0.7)'
  g.lineWidth = 2
  g.strokeRect(1, 1, w - 2, h - 2)
})
gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping
gridTex.repeat.set(60, 60)

const BILLBOARD_TEXT: [string, string][] = [
  ['ARC', 'THE ECONOMIC OS'],
  ['USDC', 'DIGITAL DOLLARS'],
  ['GM', 'RUNNER ONLINE'],
  ['0xA7C5', 'BLOCK CONFIRMED'],
  ['SUB-SECOND', 'FINALITY'],
  ['MINT', 'ARC ENERGY'],
  ['ESCAPE', 'KEEP RUNNING'],
  ['NODE 01', 'SYNCED'],
]

export const billboardTextures = BILLBOARD_TEXT.map(([big, small], i) =>
  canvasTex(256, 128, (g, w, h) => {
    const hue = [185, 300, 40, 150, 260, 45, 340, 200][i % 8]
    const bg = g.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, `hsl(${hue},70%,12%)`)
    bg.addColorStop(1, `hsl(${(hue + 50) % 360},70%,22%)`)
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = `hsl(${hue},100%,65%)`
    g.lineWidth = 4
    g.strokeRect(6, 6, w - 12, h - 12)
    g.fillStyle = `hsl(${hue},100%,75%)`
    g.font = '700 54px "Space Grotesk", "DM Sans", sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(big, w / 2, h * 0.43)
    g.fillStyle = 'rgba(255,255,255,0.78)'
    g.font = '600 15px "DM Sans", sans-serif'
    g.fillText(small, w / 2, h * 0.76)
    g.fillStyle = 'rgba(255,255,255,0.06)'
    for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1)
  }),
)

/** Energy coin face: dark disc, bright rim and the Arc arch mark. Tinted per instance (amber / pale blue). */
const coinFaceTex = canvasTex(256, 256, (g, w) => {
  const c = w / 2
  const disc = g.createRadialGradient(c, c, 8, c, c, c)
  disc.addColorStop(0, '#b4b4b4')
  disc.addColorStop(0.75, '#8a8a8a')
  disc.addColorStop(1, '#666')
  g.fillStyle = disc
  g.beginPath()
  g.arc(c, c, c - 2, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#fff'
  g.lineWidth = 16
  g.beginPath()
  g.arc(c, c, c - 11, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = 'rgba(255,255,255,0.5)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(c, c, c - 34, 0, Math.PI * 2)
  g.stroke()
  // ledger nodes around the inner ring
  g.fillStyle = 'rgba(255,255,255,0.75)'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath()
    g.arc(c + Math.cos(a) * (c - 34), c + Math.sin(a) * (c - 34), 4, 0, Math.PI * 2)
    g.fill()
  }
  // Arc mark
  g.save()
  g.translate(c, c + 3)
  g.scale(6.2, 6.2)
  g.translate(-9.84, -10.75)
  g.fillStyle = '#fff'
  g.shadowColor = 'rgba(255,255,255,0.8)'
  g.shadowBlur = 6
  g.fill(new Path2D(ARC_MARK_PATH))
  g.restore()
})

function buildCoinGeometry(): THREE.BufferGeometry {
  const r = 0.42
  const half = 0.05
  const rim = new THREE.CylinderGeometry(r, r, half * 2, 28, 1, true).rotateX(Math.PI / 2)
  const front = new THREE.CircleGeometry(r - 0.005, 28).translate(0, 0, half + 0.001)
  const back = new THREE.CircleGeometry(r - 0.005, 28).rotateY(Math.PI).translate(0, 0, -half - 0.001)
  return mergeGeometries([rim, front, back], true)
}

export const sunTexture = canvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, '#8a8a8a')
  g.fillStyle = grad
  g.beginPath()
  g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2)
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 7; i++) {
    const y = h * 0.5 + i * 15
    g.fillRect(0, y, w, 2 + i * 1.6)
  }
})

// ----------------------------------------------------------------- materials
// glossy wet asphalt: dark = mirror-like puddles, lighter = dry patches (green channel drives roughness)
const roadRoughTex = (() => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(96,96,96)'
  g.fillRect(0, 0, 256, 128)
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 40; i++) {
    const v = Math.floor(30 + rnd() * 110)
    g.fillStyle = `rgba(${v},${v},${v},0.7)`
    g.beginPath()
    g.ellipse(rnd() * 256, rnd() * 128, 6 + rnd() * 26, 3 + rnd() * 10, rnd() * 3, 0, Math.PI * 2)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  return t
})()

const poolTex = canvasTex(128, 128, (g, w) => {
  const grad = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, w, w)
})

const farTex = windowTex(8, 40, 91)

const stripeTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#16101a'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#ffd23d'
  for (let i = -2; i < 6; i++) {
    g.beginPath()
    g.moveTo(i * 16, h)
    g.lineTo(i * 16 + 8, h)
    g.lineTo(i * 16 + 8 + h, 0)
    g.lineTo(i * 16 + h, 0)
    g.closePath()
    g.fill()
  }
})
stripeTex.wrapS = stripeTex.wrapT = THREE.RepeatWrapping

const tinted: { mat: THREE.Material; apply: () => void }[] = []
function themed<T extends THREE.Material>(mat: T, apply: (m: T) => void): T {
  bend(mat)
  tinted.push({ mat, apply: () => apply(mat) })
  return mat
}

const tmp = new THREE.Color()
const white = new THREE.Color(1, 1, 1)

export const mats = {
  road: themed(new THREE.MeshStandardMaterial({ color: 0x0a0e1e, roughness: 1.4, metalness: 0.3, roughnessMap: roadRoughTex, emissiveMap: roadTex }), (m) => m.emissive.copy(live.accent).multiplyScalar(0.6)),
  roadBody: bend(new THREE.MeshStandardMaterial({ color: 0x080b18, roughness: 0.6, metalness: 0.4 })),
  building: [windowTex(4, 12, 11), windowTex(6, 20, 23), windowTex(8, 30, 37)].map((tex) =>
    themed(new THREE.MeshStandardMaterial({ color: 0x0a1226, roughness: 0.55, metalness: 0.45, emissive: 0xffffff, emissiveMap: tex }), (m) =>
      m.emissive.copy(white).lerp(live.accent, 0.3).multiplyScalar(0.6),
    ),
  ),
  rim: themed(new THREE.MeshBasicMaterial({ color: 0xffffff }), (m) => m.color.copy(live.accent).multiplyScalar(1.3)),
  rim2: themed(new THREE.MeshBasicMaterial({ color: 0xffffff }), (m) => m.color.copy(live.accent2).multiplyScalar(1.3)),
  glass: themed(new THREE.MeshStandardMaterial({ color: 0x0b1233, roughness: 0.4, metalness: 0.5, emissive: 0xffffff }), (m) => m.emissive.copy(live.accent2).multiplyScalar(0.25)),
  dark: bend(new THREE.MeshStandardMaterial({ color: 0x1a2142, roughness: 0.5, metalness: 0.4 })),
  platform: themed(new THREE.MeshStandardMaterial({ color: 0x141b3d, roughness: 0.5, metalness: 0.4, emissive: 0xffffff }), (m) => m.emissive.copy(live.accent).multiplyScalar(0.1)),
  edge: themed(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), (m) => m.color.copy(live.accent)),
  void: themed(new THREE.MeshBasicMaterial({ color: 0xffffff, map: gridTex, transparent: true, opacity: 0.5, depthWrite: false }), (m) =>
    m.color.copy(live.accent).multiplyScalar(0.22),
  ),
  hazard: bend(new THREE.MeshStandardMaterial({ color: 0x2a1822, roughness: 0.5, metalness: 0.4, emissive: HAZARD, emissiveIntensity: 0.25 })),
  hazardStripe: bend(new THREE.MeshStandardMaterial({ color: 0xffffff, map: stripeTex, roughness: 0.55, metalness: 0.2, emissive: 0xffa000, emissiveMap: stripeTex, emissiveIntensity: 0.3 })),
  hazardGlow: bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(HAZARD).multiplyScalar(1.35) })),
  laserOn: bend(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a6a).multiplyScalar(1.4) })),
  laserOff: bend(new THREE.MeshBasicMaterial({ color: 0xff5a6a, transparent: true, opacity: 0.12, depthWrite: false })),
  energy: [bend(new THREE.MeshBasicMaterial({ color: 0xd8d8d8 })), bend(new THREE.MeshBasicMaterial({ map: coinFaceTex })), bend(new THREE.MeshBasicMaterial({ map: coinFaceTex }))],
  shield: bend(new THREE.MeshBasicMaterial({ color: 0x4da3ff })),
  magnet: bend(new THREE.MeshBasicMaterial({ color: 0xff4d6d })),
  boost: bend(new THREE.MeshBasicMaterial({ color: 0x3dff8a })),
  powerRing: bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })),
  billboard: billboardTextures.map((map) => bend(new THREE.MeshBasicMaterial({ map }))),
  rail: bend(new THREE.MeshStandardMaterial({ color: 0x1a2140, roughness: 0.5, metalness: 0.45 })),
  pool: themed(
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff }),
    (m) => m.color.copy(live.accent).multiplyScalar(0.28),
  ),
  lamp: themed(new THREE.MeshBasicMaterial({ color: 0xffffff }), (m) => m.color.copy(live.accent).lerp(white, 0.4).multiplyScalar(1.4)),
  beacon: bend(new THREE.MeshBasicMaterial({ color: 0xff2a2a })),
  far: new THREE.MeshBasicMaterial({ map: farTex, color: 0x223055, fog: false }),
  sun: new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true, fog: false, depthWrite: false, color: 0xffffff }),
}

export function applyTheme(): void {
  for (const t of tinted) t.apply()
  tmp.copy(live.accent)
}

export const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  coin: buildCoinGeometry(),
  ico: new THREE.IcosahedronGeometry(0.42, 0),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  edges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
}
