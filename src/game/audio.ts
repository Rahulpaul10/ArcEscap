type Sfx = 'coin' | 'jump' | 'slide' | 'power' | 'shieldBreak' | 'hit' | 'gameover' | 'milestone' | 'tick' | 'click' | 'smash'

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
const PROG = [
  { root: 45, chord: [0, 3, 7, 12] }, // Am
  { root: 41, chord: [0, 4, 7, 12] }, // F
  { root: 48, chord: [0, 4, 7, 12] }, // C
  { root: 43, chord: [0, 4, 7, 11] }, // G
]

/** Tiny WebAudio synth: every sound is generated, no audio files. */
class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noise: AudioBuffer | null = null
  private muted = false
  private musicTimer: number | null = null
  private nextStep = 0
  private step = 0
  private tempoScale = 0
  private wantMusic = false

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      this.master.connect(this.ctx.destination)
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = 0.9
      this.sfxBus.connect(this.master)
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = 0.32
      this.musicBus.connect(this.master)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.wantMusic) this.startMusic()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.03)
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  // ------------------------------------------------------------- helpers
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, bus?: GainNode | null): void {
    const c = this.ctx
    const out = bus ?? this.sfxBus
    if (!c || !out) return
    const t = c.currentTime + delay
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private burst(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0, bus?: GainNode | null): void {
    const c = this.ctx
    const out = bus ?? this.sfxBus
    if (!c || !out || !this.noise) return
    const t = c.currentTime + delay
    const s = c.createBufferSource()
    s.buffer = this.noise
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.setValueAtTime(f0, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur)
    f.Q.value = 1.2
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f).connect(g).connect(out)
    s.start(t, Math.random() * 0.5)
    s.stop(t + dur + 0.05)
  }

  // ------------------------------------------------------------- sfx
  play(name: Sfx, arg = 0): void {
    if (!this.ctx || this.muted) return
    switch (name) {
      case 'coin': {
        const f = 880 * Math.pow(2, Math.min(arg, 12) / 12)
        this.tone('triangle', f, f, 0.09, 0.16)
        this.tone('triangle', f * 1.5, f * 1.5, 0.14, 0.14, 0.06)
        break
      }
      case 'jump':
        this.tone('square', 220, 560, 0.16, 0.07)
        break
      case 'slide':
        this.burst(0.3, 0.35, 'bandpass', 2200, 420)
        break
      case 'power':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.15, i * 0.06))
        break
      case 'shieldBreak':
        this.burst(0.35, 0.5, 'highpass', 3000, 500)
        this.tone('sine', 520, 120, 0.3, 0.2)
        break
      case 'smash':
        this.burst(0.25, 0.5, 'lowpass', 2400, 200)
        this.tone('sawtooth', 180, 60, 0.2, 0.12)
        break
      case 'hit':
        this.burst(0.5, 0.8, 'lowpass', 1800, 90)
        this.tone('sawtooth', 160, 38, 0.5, 0.22)
        break
      case 'gameover':
        ;[440, 349, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.34, 0.2, 0.15 + i * 0.2))
        break
      case 'milestone':
        ;[659, 784, 988, 1319].forEach((f, i) => this.tone('square', f, f, 0.14, 0.07, i * 0.07))
        break
      case 'tick':
        this.burst(0.04, 0.12, 'highpass', 4000, 3000)
        break
      case 'click':
        this.tone('sine', 700, 500, 0.05, 0.1)
        break
    }
  }

  // ------------------------------------------------------------- music
  startMusic(): void {
    this.wantMusic = true
    const c = this.ctx
    if (!c || this.musicTimer !== null) return
    this.nextStep = c.currentTime + 0.08
    this.step = 0
    this.musicTimer = window.setInterval(() => this.schedule(), 40)
  }

  stopMusic(): void {
    this.wantMusic = false
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  /** 0..1 progress of the run, nudges tempo up. */
  setIntensity(v: number): void {
    this.tempoScale = Math.max(0, Math.min(1, v))
  }

  private schedule(): void {
    const c = this.ctx
    if (!c || c.state !== 'running') return
    while (this.nextStep < c.currentTime + 0.18) {
      this.playStep(this.step, this.nextStep)
      const bpm = 118 + this.tempoScale * 34
      this.nextStep += 60 / bpm / 4
      this.step = (this.step + 1) % 64
    }
  }

  private playStep(step: number, t: number): void {
    const c = this.ctx
    const bus = this.musicBus
    if (!c || !bus || !this.noise) return
    const s = step % 16
    const chord = PROG[Math.floor(step / 16) % 4]
    const delay = Math.max(0, t - c.currentTime)

    if (s % 4 === 0) {
      this.tone('sine', 150, 42, 0.18, 0.9, delay, bus)
    }
    if (s === 4 || s === 12) this.burst(0.12, 0.28, 'bandpass', 1800, 1400, delay, bus)
    if (s % 2 === 0) this.burst(0.035, s % 4 === 2 ? 0.16 : 0.07, 'highpass', 7500, 7000, delay, bus)

    // off-beat bass
    if (s % 4 === 2 || s === 0 || s === 7 || s === 15) this.tone('sawtooth', midi(chord.root - 12), midi(chord.root - 12), 0.16, 0.2, delay, bus)
    // arpeggio
    const note = chord.root + 24 + chord.chord[(s * 3 + (s > 7 ? 1 : 0)) % chord.chord.length]
    if (s % 2 === 1 || s % 4 === 0) this.tone('triangle', midi(note), midi(note), 0.12, 0.1, delay, bus)
    // pad on bar start
    if (s === 0) {
      chord.chord.slice(0, 3).forEach((n) => this.tone('sine', midi(chord.root + 12 + n), midi(chord.root + 12 + n), 1.6, 0.05, delay, bus))
    }
  }
}

export const audio = new AudioEngine()
