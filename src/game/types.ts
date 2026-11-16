export type Phase = 'menu' | 'playing' | 'paused' | 'dying' | 'over'
export type PowerType = 'shield' | 'magnet' | 'boost'
export type Action = 'left' | 'right' | 'jump' | 'slide' | 'pause'

export interface HudState {
  score: number
  distance: number
  energy: number
  speed: number
  /** remaining fraction 0..1 for each power-up, 0 when inactive */
  powers: Record<PowerType, number>
  section: string
  /** score multiplier 1..5 */
  mult: number
  /** remaining fraction of the chain timer 0..1 */
  chain: number
  surge: boolean
}

export interface RunStats {
  score: number
  distance: number
  energy: number
  dodges: number
  jumps: number
  slides: number
  shields: number
  magnets: number
  boosts: number
  milestones: number
}

import type { Character } from './characters'
import type { Skin } from './progress'

export interface EngineEvents {
  /** Single source of truth for who is running: the saved selection, read live (never cached by the engine). */
  getLook: () => { character: Character; skin: Skin }
  onPhase: (phase: Phase) => void
  onHud: (hud: HudState) => void
  onToast: (text: string, tone: 'energy' | 'power' | 'info' | 'danger') => void
  onGameOver: (stats: RunStats) => void
}

export const emptyHud = (): HudState => ({
  score: 0,
  distance: 0,
  energy: 0,
  speed: 0,
  powers: { shield: 0, magnet: 0, boost: 0 },
  section: 'Neon Core',
  mult: 1,
  chain: 0,
  surge: false,
})
