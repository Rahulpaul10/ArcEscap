import { AnimatePresence, motion } from 'framer-motion'
import { Gauge, Magnet, Pause, Shield, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ToastMsg } from '@/game/useArcEscape'
import type { HudState, PowerType } from '@/game/types'
import { fmt } from './ui'

const POWER_META: Record<PowerType, { color: string; icon: ReactNode; label: string }> = {
  shield: { color: '#4da3ff', icon: <Shield size={16} />, label: 'Shield' },
  magnet: { color: '#ff4d6d', icon: <Magnet size={16} />, label: 'Magnet' },
  boost: { color: '#3dff8a', icon: <Gauge size={16} />, label: 'Boost' },
}

const TOAST_COLOR: Record<ToastMsg['tone'], string> = {
  energy: '#ffc83d',
  power: '#8ee6ff',
  info: '#dbe8ff',
  danger: '#ff7a88',
}

function PowerChip({ type, value }: { type: PowerType; value: number }) {
  const m = POWER_META[type]
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7 }}
      className="relative flex items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-full glass overflow-hidden text-[12px] font-semibold"
      style={{ color: m.color }}
    >
      <span className="absolute inset-y-0 left-0 opacity-25" style={{ background: m.color, width: `${Math.round(value * 100)}%` }} />
      <span className="relative flex items-center gap-1.5">
        {m.icon}
        {m.label}
      </span>
    </motion.div>
  )
}

export function Hud({ hud, toast, onPause, visible }: { hud: HudState; toast: ToastMsg | null; onPause: () => void; visible: boolean }) {
  const powers = (Object.keys(hud.powers) as PowerType[]).filter((k) => hud.powers[k] > 0)
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none safe-top px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="mx-auto max-w-md flex items-start justify-between">
            <div>
              <div className="font-display text-[40px] leading-none font-bold tracking-tight tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">{fmt(hud.score)}</div>
              <div className="mt-1 text-[13px] font-medium text-[#b5c8e8] tabular-nums">{fmt(hud.distance)} m</div>
              <AnimatePresence>
                {hud.mult > 1 && (
                  <motion.div
                    key="mult"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="mt-2 w-28"
                  >
                    <div className="flex items-center gap-1.5 font-display font-bold text-[20px] leading-none text-[#9ff6ff] drop-shadow-[0_0_12px_rgba(159,246,255,0.7)]">
                      <motion.span key={hud.mult} initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                        x{hud.mult}
                      </motion.span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8fa6cc]">chain</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${hud.surge ? 'bg-white' : 'bg-[#9ff6ff]'}`} style={{ width: `${Math.round(hud.chain * 100)}%` }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="flex items-center gap-1.5 h-11 pl-3 pr-4 rounded-full glass text-[#ffc83d] font-display font-semibold tabular-nums">
                <Zap size={17} fill="currentColor" />
                {fmt(hud.energy)}
              </div>
              <button aria-label="Pause" onClick={onPause} className="h-11 w-11 grid place-items-center rounded-full glass text-[#dbe8ff] active:scale-95">
                <Pause size={18} fill="currentColor" />
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-md mt-3 flex flex-wrap gap-2">
            <AnimatePresence>{powers.map((k) => <PowerChip key={k} type={k} value={hud.powers[k]} />)}</AnimatePresence>
          </div>
          <div className="absolute left-0 right-0 top-[132px] flex justify-center">
            <AnimatePresence mode="wait">
              {toast && (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: -10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="px-4 h-9 flex items-center rounded-full glass font-display text-[13px] font-semibold tracking-wide"
                  style={{ color: TOAST_COLOR[toast.tone] }}
                >
                  {toast.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
