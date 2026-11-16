import * as THREE from 'three'
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
  t.anisotropy = 4
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
  const t = canvasTex(cols * 12, rows * 12, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    let s = seed
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rnd() > 0.42) {
          const a = 0.35 + rnd() * 0.65
          g.fillStyle = `rgba(255,255,255,${a})`
          g.fillRect(x * 12 + 2, y * 12 + 3, 8, 6)
        }
      }
    }
  })
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
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
const tinted: { mat: THREE.Material; apply: () => void }[] = []
function themed<T extends THREE.Material>(mat: T, apply: (m: T) => void): T {
  bend(mat)
  tinted.push({ mat, apply: () => apply(mat) })
  return mat
}

const tmp = new THREE.Color()
const white = new THREE.Color(1, 1, 1)

export const mats = {
  road: themed(new THREE.MeshLambertMaterial({ color: 0x080d20, emissiveMap: roadTex }), (m) => m.emissive.copy(live.accent).multiplyScalar(1.1)),
  roadBody: bend(new THREE.MeshLambertMaterial({ color: 0x070b1b })),
  building: [windowTex(4, 10, 11), windowTex(6, 16, 23), windowTex(8, 24, 37)].map((tex) =>
    themed(new THREE.MeshLambertMaterial({ color: 0x0a1030, emissive: 0xffffff, emissiveMap: tex }), (m) =>
      m.emissive.copy(live.accent).lerp(white, 0.28).multiplyScalar(0.85),
    ),
  ),
  rim: themed(new THREE.MeshBasicMaterial({ color: 0xffffff }), (m) => m.color.copy(live.accent)),
  rim2: themed(new THREE.MeshBasicMaterial({ color: 0xffffff }), (m) => m.color.copy(live.accent2)),
  glass: themed(new THREE.MeshLambertMaterial({ color: 0x0b1233, emissive: 0xffffff }), (m) => m.emissive.copy(live.accent2).multiplyScalar(0.35)),
  dark: bend(new THREE.MeshLambertMaterial({ color: 0x10163a })),
  platform: themed(new THREE.MeshLambertMaterial({ color: 0x0d1331, emissive: 0xffffff }), (m) => m.emissive.copy(live.accent).multiplyScalar(0.12)),
  edge: themed(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), (m) => m.color.copy(live.accent)),
  void: themed(new THREE.MeshBasicMaterial({ color: 0xffffff, map: gridTex, transparent: true, opacity: 0.5, depthWrite: false }), (m) =>
    m.color.copy(live.accent).multiplyScalar(0.4),
  ),
  hazard: bend(new THREE.MeshLambertMaterial({ color: 0x1a0f1c, emissive: HAZARD, emissiveIntensity: 0.55 })),
  hazardGlow: bend(new THREE.MeshBasicMaterial({ color: HAZARD })),
  laserOn: bend(new THREE.MeshBasicMaterial({ color: 0xff5a6a })),
  laserOff: bend(new THREE.MeshBasicMaterial({ color: 0xff5a6a, transparent: true, opacity: 0.12, depthWrite: false })),
  energy: bend(new THREE.MeshBasicMaterial({ color: 0xffffff })),
  shield: bend(new THREE.MeshBasicMaterial({ color: 0x4da3ff })),
  magnet: bend(new THREE.MeshBasicMaterial({ color: 0xff4d6d })),
  boost: bend(new THREE.MeshBasicMaterial({ color: 0x3dff8a })),
  powerRing: bend(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })),
  billboard: billboardTextures.map((map) => bend(new THREE.MeshBasicMaterial({ map }))),
  sun: new THREE.MeshBasicMaterial({ map: sunTexture, transparent: true, fog: false, depthWrite: false, color: 0xffffff }),
}

export function applyTheme(): void {
  for (const t of tinted) t.apply()
  tmp.copy(live.accent)
}

export const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  coin: new THREE.CylinderGeometry(0.34, 0.34, 0.11, 6).rotateX(Math.PI / 2),
  ico: new THREE.IcosahedronGeometry(0.42, 0),
  sphere: new THREE.SphereGeometry(1, 14, 10),
  octa: new THREE.OctahedronGeometry(0.5, 0),
  edges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
}
