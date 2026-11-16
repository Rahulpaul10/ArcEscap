import { AnimatePresence, motion } from 'framer-motion'
import { Award, CalendarCheck, ChevronDown, ChevronLeft, ChevronUp, Home, Play, RotateCcw, Trophy, Volume2, VolumeX, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import type { RunResult } from '@/game/useArcEscape'
import type { Progress } from '@/game/progress'
import { Btn, CountUp, Label, fmt } from './ui'

export function Tutorial({ open, onConfirm, onClose }: { open: boolean; onConfirm: () => void; onClose: () => void }) {
  const items: { icon: ReactNode; title: string; hint: string; anim: { x?: number[]; y?: number[] } }[] = [
    { icon: <ChevronLeft size={26} />, title: 'Swipe left or right', hint: 'Change lanes', anim: { x: [10, -10, 10] } },
    { icon: <ChevronUp size={26} />, title: 'Swipe up', hint: 'Jump barriers and gaps', anim: { y: [6, -8, 6] } },
    { icon: <ChevronDown size={26} />, title: 'Swipe down', hint: 'Slide under gates', anim: { y: [-6, 8, -6] } },
  ]
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-40 grid place-items-center px-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close tutorial" className="absolute inset-0 bg-[#03061a]/80" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-sm rounded-[28px] glass !bg-[#0b1233]/90 p-6"
            initial={{ y: 30, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          >
            <Label>How to play</Label>
            <h2 className="font-display text-[28px] font-bold tracking-tight mt-1 text-balance">Outrun the chain.</h2>
            <div className="mt-5 space-y-3">
              {items.map((it) => (
                <div key={it.title} className="flex items-center gap-4 rounded-2xl bg-white/5 p-3">
                  <motion.div
                    className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-[#35f2ff]/15 text-[#8ee6ff]"
                    animate={it.anim}
                    transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                  >
                    {it.icon}
                  </motion.div>
                  <div>
                    <div className="font-display font-semibold text-[15px]">{it.title}</div>
                    <div className="text-[13px] text-[#a9bddf]">{it.hint}</div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-3">
                <div className="h-12 w-12 shrink-0 grid place-items-center rounded-xl bg-[#ffc83d]/15 text-[#ffc83d]">
                  <Zap size={22} fill="currentColor" />
                </div>
                <div>
                  <div className="font-display font-semibold text-[15px]">Dodge toward Energy</div>
                  <div className="text-[13px] text-[#a9bddf]">Pale-blue Energy beside hazards is worth double. Close calls and pickups build a x2 to x5 score chain.</div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-[12px] text-[#8fa6cc]">On desktop use arrow keys or WASD, and P to pause.</p>
            <Btn variant="primary" className="w-full mt-5" onClick={onConfirm}>
              Got it, run
            </Btn>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PauseOverlay({ open, muted, onResume, onRestart, onMenu, onMute }: { open: boolean; muted: boolean; onResume: () => void; onRestart: () => void; onMenu: () => void; onMute: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-30 grid place-items-center px-5 bg-[#03061a]/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-xs flex flex-col items-center gap-3" initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}>
            <h2 className="font-display text-[34px] font-bold tracking-tight mb-2">Paused</h2>
            <Btn variant="primary" className="w-full" onClick={onResume}>
              <Play size={18} fill="currentColor" /> Resume
            </Btn>
            <div className="grid grid-cols-2 gap-2 w-full">
              <Btn onClick={onRestart}>
                <RotateCcw size={16} /> Restart
              </Btn>
              <Btn onClick={onMenu}>
                <Home size={16} /> Menu
              </Btn>
            </div>
            <Btn onClick={onMute} className="w-full">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />} Sound {muted ? 'off' : 'on'}
            </Btn>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function GameOver({ open, result, progress, onRestart, onMenu }: { open: boolean; result: RunResult | null; progress: Progress; onRestart: () => void; onMenu: () => void }) {
  return (
    <AnimatePresence>
      {open && result && (
        <motion.div className="absolute inset-0 z-30 flex flex-col justify-end items-center px-4 safe-bottom bg-gradient-to-t from-[#03061a]/90 via-[#03061a]/40 to-transparent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md rounded-[28px] glass !bg-[#0b1233]/85 p-5 overflow-y-auto max-h-[82dvh]" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 24, stiffness: 240, delay: 0.1 }}>
            <div className="flex items-center justify-between">
              <Label>Run over</Label>
              {result.outcome.newBest && (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.7, type: 'spring' }} className="flex items-center gap-1 h-7 px-3 rounded-full bg-[#ffc83d]/15 text-[#ffc83d] text-[12px] font-semibold">
                  <Trophy size={12} /> New best
                </motion.span>
              )}
            </div>
            <div className="font-display text-[56px] leading-none font-bold tracking-[-0.03em] tabular-nums mt-1.5">
              <CountUp value={result.stats.score} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Cell label="Distance" value={<><CountUp value={result.stats.distance} delay={150} /> m</>} />
              <Cell label="Energy" value={<><CountUp value={result.stats.energy} delay={250} /></>} tone="#ffc83d" icon={<Zap size={13} fill="currentColor" />} />
              <Cell label="Best" value={fmt(Math.max(progress.best, result.stats.score))} />
            </div>

            {(result.outcome.dailyJustDone || result.outcome.unlocked.length > 0) && (
              <div className="mt-3 space-y-2">
                {result.outcome.dailyJustDone && (
                  <Banner icon={<CalendarCheck size={16} />} title="Daily challenge complete" sub={`+${result.outcome.dailyReward} Arc Energy banked`} />
                )}
                {result.outcome.unlocked.map((a) => (
                  <Banner key={a.id} icon={<Award size={16} />} title={`Badge: ${a.name}`} sub="+25 Arc Energy" />
                ))}
              </div>
            )}

            <Btn variant="primary" className="w-full mt-5" onClick={onRestart}>
              <RotateCcw size={18} /> Run again
            </Btn>
            <Btn className="w-full mt-2" onClick={onMenu}>
              <Home size={16} /> Menu
            </Btn>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Cell({ label, value, tone, icon }: { label: string; value: ReactNode; tone?: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6cc]">{label}</div>
      <div className="flex items-center gap-1 font-display text-[19px] font-bold tabular-nums" style={{ color: tone }}>
        {icon}
        {value}
      </div>
    </div>
  )
}

function Banner({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex items-center gap-3 rounded-2xl bg-[#35f2ff]/10 px-3 py-2.5 text-[#8ee6ff]">
      <span className="h-8 w-8 grid place-items-center rounded-lg bg-[#35f2ff]/15">{icon}</span>
      <span>
        <span className="block font-display text-[14px] font-semibold text-white">{title}</span>
        <span className="block text-[12px] text-[#a9bddf]">{sub}</span>
      </span>
    </motion.div>
  )
}

