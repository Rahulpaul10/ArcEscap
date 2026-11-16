import { useSyncExternalStore } from 'react'
import { CHARACTERS } from './characters'
import { mulberry32, MILESTONE_STEP } from './config'
import type { RunStats } from './types'

const KEY = 'arc-escape:v1'

export interface Totals {
  runs: number
  distance: number
  energy: number
  jumps: number
  slides: number
  shields: number
  magnets: number
  boosts: number
  dailyCompleted: number
}

export interface Progress {
  best: number
  bestDistance: number
  bestMilestone: number
  bank: number
  skins: string[]
  skin: string
  /** selected playable character (cosmetic only) */
  character: string
  characterChosen: boolean
  achievements: string[]
  totals: Totals
  daily: { date: string; progress: number; done: boolean }
  tutorialSeen: boolean
  muted: boolean
}

// ---------------------------------------------------------------- skins
export interface Skin {
  id: string
  name: string
  blurb: string
  cost: number
  suit: number
  trim: number
  glow: number
  visor: number
}

export const SKINS: Skin[] = [
  { id: 'pulse', name: 'Signature', blurb: "Your runner's own colors.", cost: 0, suit: 0x1b2447, trim: 0x35f2ff, glow: 0x35f2ff, visor: 0xffffff },
  { id: 'ember', name: 'Ember', blurb: 'Forged in the Solar Bridge.', cost: 300, suit: 0xe8552e, trim: 0xffd08a, glow: 0xffa63d, visor: 0xfff1d0 },
  { id: 'mint', name: 'Mint', blurb: 'Quiet, fast, and always in sync.', cost: 800, suit: 0x1fb98a, trim: 0xd7fff0, glow: 0x3dffb0, visor: 0xeafff6 },
  { id: 'phantom', name: 'Phantom', blurb: 'Slips between blocks unseen.', cost: 1600, suit: 0x7a4dff, trim: 0xffb3f0, glow: 0xff3df0, visor: 0xf3e6ff },
  { id: 'aurum', name: 'Aurum', blurb: 'Solid gold finality.', cost: 3200, suit: 0xf5b021, trim: 0xfff3b0, glow: 0xffd54a, visor: 0xfffbe6 },
]
export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0]

// ---------------------------------------------------------------- achievements
export interface Achievement {
  id: string
  name: string
  desc: string
  icon: 'flag' | 'zap' | 'trophy' | 'shield' | 'magnet' | 'gauge' | 'calendar' | 'palette' | 'arrow-up' | 'arrow-down' | 'map'
  test: (p: Progress) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-run', name: 'First Block', desc: 'Finish your first run.', icon: 'flag', test: (p) => p.totals.runs >= 1 },
  { id: 'sprinter', name: 'Sprinter', desc: 'Run 1,000 m in one go.', icon: 'gauge', test: (p) => p.bestDistance >= 1000 },
  { id: 'four-zones', name: 'Zone Hopper', desc: 'Reach the fourth district (2,700 m).', icon: 'map', test: (p) => p.bestDistance >= 2700 },
  { id: 'marathon', name: 'Marathon', desc: 'Run 5,000 m in one go.', icon: 'trophy', test: (p) => p.bestDistance >= 5000 },
  { id: 'high-roller', name: 'High Roller', desc: 'Score 10,000 in one run.', icon: 'trophy', test: (p) => p.best >= 10000 },
  { id: 'hoarder', name: 'Energy Hoarder', desc: 'Collect 1,000 Arc Energy overall.', icon: 'zap', test: (p) => p.totals.energy >= 1000 },
  { id: 'acrobat', name: 'Acrobat', desc: 'Jump 100 times.', icon: 'arrow-up', test: (p) => p.totals.jumps >= 100 },
  { id: 'slider', name: 'Low Rider', desc: 'Slide 50 times.', icon: 'arrow-down', test: (p) => p.totals.slides >= 50 },
  { id: 'shield', name: 'Bulletproof', desc: 'Pick up 10 shields.', icon: 'shield', test: (p) => p.totals.shields >= 10 },
  { id: 'magnet', name: 'Polarity', desc: 'Pick up 10 magnets.', icon: 'magnet', test: (p) => p.totals.magnets >= 10 },
  { id: 'boost', name: 'Overclocked', desc: 'Pick up 10 speed boosts.', icon: 'gauge', test: (p) => p.totals.boosts >= 10 },
  { id: 'daily', name: 'Daily Driver', desc: 'Complete a daily challenge.', icon: 'calendar', test: (p) => p.totals.dailyCompleted >= 1 },
  { id: 'collector', name: 'Wardrobe', desc: 'Own three skins.', icon: 'palette', test: (p) => p.skins.length >= 3 },
]

// ---------------------------------------------------------------- daily challenge
export type DailyMetric = 'distance' | 'score' | 'energy' | 'jumps' | 'slides' | 'powerups'
export interface DailyDef {
  date: string
  metric: DailyMetric
  target: number
  reward: number
  label: string
  /** true when progress accumulates across runs today, false for single-run goals */
  cumulative: boolean
}

const DAILY_TEMPLATES: { metric: DailyMetric; targets: number[]; label: (n: number) => string; cumulative: boolean }[] = [
  { metric: 'distance', targets: [800, 1200, 1800], label: (n) => `Run ${n.toLocaleString()} m in a single run`, cumulative: false },
  { metric: 'score', targets: [2500, 4000, 6500], label: (n) => `Score ${n.toLocaleString()} in a single run`, cumulative: false },
  { metric: 'energy', targets: [60, 100, 150], label: (n) => `Collect ${n} Arc Energy today`, cumulative: true },
  { metric: 'jumps', targets: [25, 40, 60], label: (n) => `Jump ${n} times today`, cumulative: true },
  { metric: 'slides', targets: [15, 25, 35], label: (n) => `Slide ${n} times today`, cumulative: true },
  { metric: 'powerups', targets: [3, 5, 8], label: (n) => `Grab ${n} power-ups today`, cumulative: true },
]

export const todayKey = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dailyFor(date: string): DailyDef {
  let seed = 7
  for (let i = 0; i < date.length; i++) seed = (Math.imul(seed, 31) + date.charCodeAt(i)) >>> 0
  const rng = mulberry32(seed)
  const tpl = DAILY_TEMPLATES[Math.floor(rng() * DAILY_TEMPLATES.length)]
  const tier = Math.floor(rng() * tpl.targets.length)
  const target = tpl.targets[tier]
  return { date, metric: tpl.metric, target, reward: 100 + tier * 75, label: tpl.label(target), cumulative: tpl.cumulative }
}

// ---------------------------------------------------------------- store
const defaults = (): Progress => ({
  best: 0,
  bestDistance: 0,
  bestMilestone: 0,
  bank: 0,
  skins: ['pulse'],
  skin: 'pulse',
  character: 'kai',
  characterChosen: false,
  achievements: [],
  totals: { runs: 0, distance: 0, energy: 0, jumps: 0, slides: 0, shields: 0, magnets: 0, boosts: 0, dailyCompleted: 0 },
  daily: { date: '', progress: 0, done: false },
  tutorialSeen: false,
  muted: false,
})

function load(): Progress {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<Progress>
    const known = CHARACTERS.some((c) => c.id === parsed.character)
    return {
      ...base,
      ...parsed,
      character: known ? (parsed.character as string) : base.character,
      totals: { ...base.totals, ...(parsed.totals ?? {}) },
      daily: { ...base.daily, ...(parsed.daily ?? {}) },
      skins: Array.isArray(parsed.skins) && parsed.skins.length ? parsed.skins : base.skins,
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    }
  } catch {
    return base
  }
}

let state: Progress = load()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const getProgress = (): Progress => state
export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const useProgress = (): Progress => useSyncExternalStore(subscribe, getProgress, getProgress)

export function updateProgress(fn: (draft: Progress) => void): void {
  const draft: Progress = {
    ...state,
    skins: [...state.skins],
    achievements: [...state.achievements],
    totals: { ...state.totals },
    daily: { ...state.daily },
  }
  fn(draft)
  state = draft
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage may be unavailable (private mode); progress stays in memory */
  }
  emit()
}

/** The daily progress as it applies to today (resets automatically on a new date). */
export function dailyView(p: Progress): { def: DailyDef; progress: number; done: boolean } {
  const def = dailyFor(todayKey())
  const same = p.daily.date === def.date
  return { def, progress: same ? p.daily.progress : 0, done: same ? p.daily.done : false }
}

export interface RunOutcome {
  newBest: boolean
  unlocked: Achievement[]
  dailyJustDone: boolean
  dailyReward: number
}

export function applyRun(run: RunStats): RunOutcome {
  const outcome: RunOutcome = { newBest: false, unlocked: [], dailyJustDone: false, dailyReward: 0 }
  updateProgress((p) => {
    outcome.newBest = run.score > p.best
    p.best = Math.max(p.best, run.score)
    p.bestDistance = Math.max(p.bestDistance, Math.floor(run.distance))
    p.bestMilestone = Math.max(p.bestMilestone, Math.floor(run.distance / MILESTONE_STEP))
    p.bank += run.energy
    const t = p.totals
    t.runs += 1
    t.distance += Math.floor(run.distance)
    t.energy += run.energy
    t.jumps += run.jumps
    t.slides += run.slides
    t.shields += run.shields
    t.magnets += run.magnets
    t.boosts += run.boosts

    const def = dailyFor(todayKey())
    if (p.daily.date !== def.date) p.daily = { date: def.date, progress: 0, done: false }
    if (!p.daily.done) {
      const gain =
        def.metric === 'distance' ? Math.floor(run.distance)
        : def.metric === 'score' ? run.score
        : def.metric === 'energy' ? run.energy
        : def.metric === 'jumps' ? run.jumps
        : def.metric === 'slides' ? run.slides
        : run.shields + run.magnets + run.boosts
      p.daily.progress = def.cumulative ? p.daily.progress + gain : Math.max(p.daily.progress, gain)
      if (p.daily.progress >= def.target) {
        p.daily.done = true
        p.bank += def.reward
        t.dailyCompleted += 1
        outcome.dailyJustDone = true
        outcome.dailyReward = def.reward
      }
    }
    for (const a of ACHIEVEMENTS) {
      if (!p.achievements.includes(a.id) && a.test(p)) {
        p.achievements.push(a.id)
        p.bank += 25
        outcome.unlocked.push(a)
      }
    }
  })
  return outcome
}

export function buyOrSelectSkin(id: string): 'selected' | 'bought' | 'poor' {
  let result: 'selected' | 'bought' | 'poor' = 'poor'
  updateProgress((p) => {
    const skin = skinById(id)
    if (p.skins.includes(id)) {
      p.skin = id
      result = 'selected'
    } else if (p.bank >= skin.cost) {
      p.bank -= skin.cost
      p.skins.push(id)
      p.skin = id
      result = 'bought'
      const wardrobe = ACHIEVEMENTS.find((a) => a.id === 'collector')
      if (wardrobe && !p.achievements.includes('collector') && wardrobe.test(p)) {
        p.achievements.push('collector')
        p.bank += 25
      }
    }
  })
  return result
}

export function selectCharacter(id: string): void {
  if (!CHARACTERS.some((c) => c.id === id)) return
  updateProgress((p) => {
    p.character = id
  })
}

export function confirmCharacter(): void {
  updateProgress((p) => {
    p.characterChosen = true
  })
}
