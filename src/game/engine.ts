import * as THREE from 'three'
import {
  BASE_SPEED, ENERGY_COLOR, GRAVITY, HAZARD, JUMP_V, LANE_W, MAX_SPEED, MILESTONE_STEP, POWER_DURATION, SLIDE_H, SLIDE_TIME, STAND_H,
  blendTheme, live,
} from './config'
import { audio } from './audio'
import { Input } from './input'
import { applyTheme, bendUniform } from './materials'
import type { Skin } from './progress'
import { Runner, type RunnerMode } from './runner'
import { Atmosphere, Backdrop, Scenery } from './scenery'
import { Track } from './track'
import { emptyHud, type Action, type EngineEvents, type HudState, type Phase, type PowerType, type RunStats } from './types'

const POWER_COLORS: Record<PowerType, number> = { shield: 0x4da3ff, magnet: 0xff4d6d, boost: 0x3dff8a }
const POWER_LABEL: Record<PowerType, string> = { shield: 'Shield online', magnet: 'Magnet field', boost: 'Overdrive' }

/** The whole game: scene, simulation, camera and phase machine. React only listens to its events. */
export class Engine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 420)
  private runner = new Runner()
  private scenery = new Scenery()
  private backdrop = new Backdrop()
  private atmos = new Atmosphere()
  private track = new Track()
  private hemi = new THREE.HemisphereLight(0xffffff, 0x101030, 2.4)
  private dirLight = new THREE.DirectionalLight(0xffffff, 2.2)
  private glowLight = new THREE.PointLight(0xffffff, 30, 16, 2)
  private input: Input
  private ro: ResizeObserver
  private raf = 0
  private last = 0
  private disposed = false
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  private fpsFrames = 0
  private fpsTime = 0

  private phase: Phase = 'menu'
  private time = 0
  private runTime = 0
  private hudTimer = 0

  // player state
  private z = 0
  private x = 0
  private lane = 0
  private y = 0
  private vy = 0
  private vx = 0
  private slideT = 0
  private falling = false
  private speed = 0
  private dist = 0
  private queuedJump = 0
  private queuedSlide = false
  private shield = 0
  private magnet = 0
  private boost = 0
  private invuln = 0
  private boostMul = 1
  private collectPulse = 0
  private combo = 0
  private comboT = 0
  private energy = 0
  private extraScore = 0
  private nextMilestone = MILESTONE_STEP
  private lastSection = ''
  private dyingT = 0
  private dyingKind: 'hit' | 'fall' = 'hit'
  private mode: RunnerMode = 'idle'
  private modeSince = 0
  private shake = 0
  private stats: RunStats = this.freshStats()
  private camPos = new THREE.Vector3(2, 2.2, -5)
  private camLook = new THREE.Vector3(0, 1.1, 0)
  private tmpA = new THREE.Vector3()
  private fov = 66
  private sceneSeed = 0

  constructor(
    private host: HTMLElement,
    private ev: EngineEvents,
    skin: Skin,
    muted: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(this.pixelRatio)
    const canvas = this.renderer.domElement
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;outline:none'
    host.appendChild(canvas)

    this.scene.fog = new THREE.Fog(0x0a1030, 30, 150)
    this.scene.add(this.hemi, this.dirLight, this.glowLight, this.track.root, this.scenery.root, this.backdrop.root, this.atmos.root, this.runner.root, this.dirLight.target)
    this.dirLight.position.set(-6, 14, 6)
    this.runner.setSkin(skin)
    audio.setMuted(muted)

    this.input = new Input(host, (a) => this.handleAction(a))
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    document.addEventListener('visibilitychange', this.onVisibility)
    this.resize()
    this.prepare()
    this.snapCamera()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  // ------------------------------------------------------------- public API
  getPhase(): Phase {
    return this.phase
  }

  setSkin(skin: Skin): void {
    this.runner.setSkin(skin)
  }

  setMuted(m: boolean): void {
    audio.setMuted(m)
  }

  start(): void {
    audio.unlock()
    this.prepare()
    this.runTime = 0
    this.setPhase('playing')
    audio.startMusic()
  }

  toMenu(): void {
    this.prepare()
    audio.stopMusic()
    this.setPhase('menu')
  }

  pause(): void {
    if (this.phase !== 'playing') return
    this.setPhase('paused')
    audio.suspend()
  }

  resume(): void {
    if (this.phase !== 'paused') return
    audio.resume()
    this.runTime = Math.max(0, this.runTime - 0.5)
    this.last = performance.now()
    this.setPhase('playing')
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.input.dispose()
    this.ro.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    audio.stopMusic()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------- state
  private freshStats(): RunStats {
    return { score: 0, distance: 0, energy: 0, jumps: 0, slides: 0, shields: 0, magnets: 0, boosts: 0, milestones: 0 }
  }

  private setPhase(p: Phase): void {
    this.phase = p
    this.ev.onPhase(p)
    this.emitHud()
  }

  private prepare(): void {
    this.sceneSeed = Math.floor(Math.random() * 1000)
    this.track.reset((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
    this.scenery.reset(this.sceneSeed)
    this.atmos.clearBurst()
    this.z = 0
    this.x = 0
    this.lane = 0
    this.y = 0
    this.vy = 0
    this.vx = 0
    this.slideT = 0
    this.falling = false
    this.speed = 0
    this.dist = 0
    this.queuedJump = 0
    this.queuedSlide = false
    this.shield = this.magnet = this.boost = this.invuln = 0
    this.boostMul = 1
    this.combo = this.comboT = 0
    this.energy = 0
    this.extraScore = 0
    this.nextMilestone = MILESTONE_STEP
    this.lastSection = ''
    this.dyingT = 0
    this.shake = 0
    this.stats = this.freshStats()
    this.setMode('idle')
  }

  private setMode(m: RunnerMode): void {
    if (m !== this.mode) {
      this.mode = m
      this.modeSince = this.time
    }
  }

  private score(): number {
    return Math.floor(this.dist) + this.energy * 10 + Math.floor(this.extraScore)
  }

  private emitHud(): void {
    const h: HudState = emptyHud()
    h.score = this.score()
    h.distance = Math.floor(this.dist)
    h.energy = this.energy
    h.speed = this.speed
    h.powers = {
      shield: this.shield > 0 ? Math.min(1, this.shield / POWER_DURATION.shield) : 0,
      magnet: this.magnet > 0 ? this.magnet / POWER_DURATION.magnet : 0,
      boost: this.boost > 0 ? this.boost / POWER_DURATION.boost : 0,
    }
    h.section = live.name
    this.ev.onHud(h)
  }

  private onVisibility = () => {
    if (document.hidden) this.pause()
  }

  // ------------------------------------------------------------- input
  handleAction(a: Action): void {
    if (a === 'pause') {
      if (this.phase === 'playing') this.pause()
      else if (this.phase === 'paused') this.resume()
      return
    }
    if (this.phase !== 'playing' || this.falling) return
    audio.unlock()
    if (a === 'left' || a === 'right') {
      const next = Math.max(-1, Math.min(1, this.lane + (a === 'left' ? -1 : 1)))
      if (next !== this.lane) {
        this.lane = next
        audio.play('tick')
      }
    } else if (a === 'jump') {
      if (this.y <= 0.01 && this.vy <= 0) this.jump()
      else this.queuedJump = 0.16
    } else if (a === 'slide') {
      if (this.y <= 0.01 && this.vy <= 0) this.slide()
      else {
        this.vy = Math.min(this.vy, -30)
        this.queuedSlide = true
      }
    }
  }

  private jump(): void {
    this.vy = JUMP_V
    this.y = 0.02
    this.slideT = 0
    this.stats.jumps++
    audio.play('jump')
  }

  private slide(): void {
    this.slideT = SLIDE_TIME
    this.stats.slides++
    audio.play('slide')
  }

  // ------------------------------------------------------------- loop
  private loop = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const raw = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000))
    this.last = now
    this.time += raw
    this.monitorFps(raw)
    if (this.phase === 'playing') this.stepPlaying(raw)
    else if (this.phase === 'dying') this.stepDying(raw * 0.55)
    this.visuals(raw)
    this.renderer.render(this.scene, this.camera)
  }

  private monitorFps(dt: number): void {
    this.fpsFrames++
    this.fpsTime += dt
    if (this.fpsTime < 2.5) return
    const fps = this.fpsFrames / this.fpsTime
    this.fpsFrames = 0
    this.fpsTime = 0
    if (this.phase === 'playing' && fps < 42 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25)
      this.renderer.setPixelRatio(this.pixelRatio)
    }
  }

  private stepPlaying(dt: number): void {
    this.runTime += dt
    const difficulty = 1 - Math.exp(-this.dist / 2600)
    const baseSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * (1 - Math.exp(-this.dist / 1800))
    this.boostMul += ((this.boost > 0 ? 1.45 : 1) - this.boostMul) * Math.min(1, dt * 4)
    const ramp = Math.min(1, 0.35 + this.runTime / 0.9)
    this.speed = baseSpeed * this.boostMul * ramp

    const prevZ = this.z
    this.z -= this.speed * dt
    this.dist = -this.z

    // lateral movement (eased toward lane target)
    const tx = this.lane * LANE_W
    const nx = this.x + (tx - this.x) * Math.min(1, dt * 17)
    this.vx = (nx - this.x) / dt
    this.x = nx

    // vertical movement
    if (!this.falling) {
      if (this.y > 0 || this.vy > 0) {
        this.vy -= GRAVITY * dt
        this.y += this.vy * dt
        if (this.y <= 0) {
          this.y = 0
          this.vy = 0
          if (this.queuedSlide) {
            this.slide()
            this.queuedSlide = false
          } else if (this.queuedJump > 0) this.jump()
        }
      }
      if (this.y <= 0.001 && this.vy <= 0 && this.track.isGap(this.z)) {
        this.falling = true
        this.vy = -2
      }
    } else {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
      if (this.y < -9) {
        this.die('fall')
        return
      }
    }
    this.queuedJump = Math.max(0, this.queuedJump - dt)
    if (this.slideT > 0 && this.y <= 0.01) this.slideT -= dt

    // timers
    this.invuln = Math.max(0, this.invuln - dt)
    this.comboT -= dt
    if (this.comboT <= 0) this.combo = 0
    this.collectPulse = Math.max(0, this.collectPulse - dt * 4)
    this.shake = Math.max(0, this.shake - dt * 2.2)
    for (const k of ['shield', 'magnet', 'boost'] as const) {
      const before = this[k]
      if (before > 0) {
        this[k] = Math.max(0, before - dt)
        if (this[k] === 0 && k === 'boost') this.invuln = Math.max(this.invuln, 0.9)
      }
    }
    if (this.boost > 0) this.extraScore += this.speed * dt * 0.6

    this.track.update(this.z, this.time, difficulty, baseSpeed)
    this.collect(dt)
    this.collide(prevZ)
    if (this.phase !== 'playing') return

    // milestones and districts
    if (this.dist >= this.nextMilestone) {
      const bonus = 15 + (this.nextMilestone / MILESTONE_STEP) * 5
      this.energy += bonus
      this.stats.milestones++
      this.ev.onToast(`${this.nextMilestone} m reached  +${bonus} energy`, 'info')
      audio.play('milestone')
      this.nextMilestone += MILESTONE_STEP
    }
    blendTheme(this.dist)
    if (this.lastSection && live.name !== this.lastSection) this.ev.onToast(`Entering ${live.name}`, 'info')
    this.lastSection = live.name
    audio.setIntensity(difficulty)

    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.09
      this.emitHud()
    }
  }

  private collect(dt: number): void {
    const cy = this.slideT > 0 ? 0.4 : 0.95
    const py = this.y + cy
    const coins = this.track.coins
    let taken = false
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]
      const dz = c.z - this.z
      if (this.magnet > 0 && dz < 4 && dz > -26) {
        const f = Math.min(1, dt * 10)
        c.x += (this.x - c.x) * f
        c.y += (py - c.y) * f
        c.z += (this.z - c.z) * Math.min(1, dt * 5)
      }
      if (Math.abs(c.z - this.z) > 1.0) continue
      if (Math.abs(c.x - this.x) < 0.95 && Math.abs(c.y - py) < 1.15) {
        coins.splice(i, 1)
        taken = true
        this.energy++
        this.combo++
        this.comboT = 0.7
        this.collectPulse = 1
        this.atmos.emit(c.x, c.y, c.z, ENERGY_COLOR, 6, 4)
        audio.play('coin', this.combo % 13)
      }
    }
    if (taken) this.glowLight.intensity = 90

    for (const p of [...this.track.powers]) {
      if (Math.abs(p.z - this.z) < 1.3 && Math.abs(p.x - this.x) < 1.2 && Math.abs(p.y - py) < 1.6) {
        this.track.removePower(p)
        this.activate(p.type, p.x, p.y, p.z)
      }
    }
  }

  private activate(type: PowerType, x: number, y: number, z: number): void {
    this[type] = POWER_DURATION[type]
    if (type === 'shield') this.stats.shields++
    else if (type === 'magnet') this.stats.magnets++
    else this.stats.boosts++
    if (type === 'boost') this.invuln = Math.max(this.invuln, 0.4)
    this.collectPulse = 1
    this.atmos.emit(x, y, z, POWER_COLORS[type], 28, 8)
    this.ev.onToast(POWER_LABEL[type], 'power')
    audio.play('power')
  }

  private collide(prevZ: number): void {
    if (this.falling || (this.invuln > 0 && this.boost <= 0)) return
    const top = this.y + (this.slideT > 0 ? SLIDE_H : STAND_H) - 0.12
    const bottom = this.y + 0.05
    const zMin = Math.min(prevZ, this.z) - 0.35
    const zMax = Math.max(prevZ, this.z) + 0.35
    for (const o of this.track.obstacles) {
      if (!o.active || o.z + o.hd < zMin || o.z - o.hd > zMax) continue
      if (Math.abs(o.x - this.x) >= o.hw + 0.38 - 0.1) continue
      if (bottom >= o.y1 || top <= o.y0) continue
      if (this.boost > 0) {
        this.smash(o.x, o.mesh.position.y + 1, o.z)
        this.track.removeObstacle(o)
        this.extraScore += 25
        continue
      }
      if (this.shield > 0) {
        this.shield = 0
        this.invuln = 1.5
        this.shake = 0.7
        this.smash(o.x, 1.2, o.z)
        this.track.removeObstacle(o)
        this.ev.onToast('Shield absorbed the hit', 'danger')
        audio.play('shieldBreak')
        continue
      }
      this.die('hit')
      return
    }
  }

  private smash(x: number, y: number, z: number): void {
    this.atmos.emit(x, y, z, HAZARD, 26, 9)
    this.atmos.emit(x, y, z, 0xffffff, 8, 6)
    this.shake = Math.max(this.shake, 0.35)
    audio.play('smash')
  }

  private die(kind: 'hit' | 'fall'): void {
    this.dyingKind = kind
    this.dyingT = 0
    this.shake = 1
    this.stats = {
      ...this.stats,
      score: this.score(),
      distance: this.dist,
      energy: this.energy,
    }
    this.atmos.emit(this.x, this.y + 1, this.z, HAZARD, 40, 10)
    audio.stopMusic()
    audio.play('hit')
    this.setMode(kind)
    this.setPhase('dying')
  }

  private stepDying(dt: number): void {
    this.dyingT += dt / 0.55
    this.speed *= Math.exp(-5 * dt)
    this.z -= this.speed * dt
    this.vx = 0
    if (this.dyingKind === 'fall') {
      this.vy -= GRAVITY * dt
      this.y += this.vy * dt
    }
    this.shake = Math.max(0, this.shake - dt * 1.4)
    this.collectPulse = 0
    this.track.update(this.z, this.time, 0, BASE_SPEED)
    if (this.dyingT > 1.35) {
      audio.play('gameover')
      this.setPhase('over')
      this.ev.onGameOver({ ...this.stats })
    }
  }

  // ------------------------------------------------------------- visuals
  private visuals(dt: number): void {
    const speedNorm = Math.max(0, Math.min(1, (this.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED) + (this.speed > 1 ? 0.15 : 0)))
    if (this.phase === 'menu') blendTheme(0)
    applyTheme()
    this.scene.background = live.sky
    const fog = this.scene.fog as THREE.Fog
    fog.color.copy(live.fog)
    this.hemi.color.copy(live.ambient)
    this.hemi.groundColor.copy(live.sky)
    this.dirLight.color.copy(live.accent2)
    this.glowLight.color.copy(live.accent)
    this.glowLight.intensity += (30 - this.glowLight.intensity) * Math.min(1, dt * 8)
    this.dirLight.position.set(this.x - 6, 14, this.z + 6)
    this.dirLight.target.position.set(this.x, 0, this.z - 10)
    this.glowLight.position.set(this.x, 2.4, this.z + 1.5)

    // winding road: horizon bends left/right and rolls with the distance travelled
    const d = this.dist
    bendUniform.value.set(0.0005 * Math.sin(d * 0.0046) + 0.0003 * Math.sin(d * 0.0021 + 1.3), -0.0006 + 0.0005 * Math.sin(d * 0.0031))

    // runner
    let mode = this.mode
    if (this.phase === 'playing') {
      if (this.falling) mode = 'fall'
      else if (this.slideT > 0 && this.y <= 0.02) mode = 'slide'
      else if (this.y > 0.02 || this.vy > 0) mode = 'jump'
      else mode = 'run'
      this.setMode(mode)
    } else if (this.phase === 'menu') this.setMode('idle')
    this.runner.root.position.set(this.x, this.y, this.z)
    this.runner.update(dt, {
      mode: this.mode,
      speedNorm,
      vx: this.vx,
      vy: this.vy,
      collect: this.collectPulse,
      shield: this.shield > 0,
      boost: this.boost > 0,
      invuln: this.invuln > 0 && this.boost <= 0,
      modeTime: this.time - this.modeSince,
    })

    this.scenery.update(this.z, this.time)
    this.backdrop.update(this.z)
    this.atmos.update(this.phase === 'paused' ? 0 : dt, this.z, this.speed, speedNorm)
    if (this.phase === 'menu') this.track.update(this.z, this.time, 0, BASE_SPEED)

    this.updateCamera(dt, speedNorm)
  }

  private cameraTargets(): { pos: THREE.Vector3; look: THREE.Vector3; rate: number } {
    const p = this.tmpA
    if (this.phase === 'menu') {
      const orbit = Math.sin(this.time * 0.5) * 0.5
      p.set(1.9 + orbit, 2.0, this.z - 4.9)
      return { pos: p, look: new THREE.Vector3(0, 1.25, this.z), rate: 3 }
    }
    const h = this.mode === 'fall' ? 4.5 : 4.5 + Math.max(0, this.y) * 0.3 - (this.slideT > 0 ? 0.4 : 0)
    p.set(this.x * 0.6, h, this.z + 7.8 + (this.boost > 0 ? 1.2 : 0))
    return { pos: p, look: new THREE.Vector3(this.x * 0.4, 1.7, this.z - 14), rate: this.phase === 'dying' ? 3 : 8 }
  }

  private snapCamera(): void {
    const t = this.cameraTargets()
    this.camPos.copy(t.pos)
    this.camLook.copy(t.look)
  }

  private updateCamera(dt: number, speedNorm: number): void {
    const t = this.cameraTargets()
    const k = 1 - Math.exp(-dt * t.rate)
    this.camPos.lerp(t.pos, k)
    this.camLook.lerp(t.look, 1 - Math.exp(-dt * (t.rate + 2)))
    this.camera.position.copy(this.camPos)
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.5
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
    }
    this.camera.lookAt(this.camLook)
    const aspect = this.camera.aspect
    const baseFov = aspect < 0.8 ? 74 : aspect < 1.2 ? 68 : 62
    const targetFov = this.phase === 'menu' ? baseFov - 14 : baseFov + speedNorm * 8 + (this.boost > 0 ? 8 : 0)
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 4)
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov
      this.camera.updateProjectionMatrix()
    }
  }

  private resize(): void {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}
