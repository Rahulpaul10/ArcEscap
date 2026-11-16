import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, HelpCircle, Palette, Play, Trophy, Volume2, VolumeX, Zap } from 'lucide-react'
import { dailyView, type Progress } from '@/game/progress'
import { Btn, fmt } from './ui'

interface Props {
  visible: boolean
  progress: Progress
  onPlay: () => void
  onSkins: () => void
  onProgress: () => void
  onHelp: () => void
  onMute: () => void
}

export function StartScreen({ visible, progress, onPlay, onSkins, onProgress, onHelp, onMute }: Props) {
  const daily = dailyView(progress)
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-20 flex flex-col items-center justify-between safe-top safe-bottom px-5 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          <div className="w-full max-w-md flex items-start justify-between">
            <div className="flex items-center gap-1.5 h-11 pl-3 pr-4 rounded-full glass text-[#ffc83d] font-display font-semibold tabular-nums">
              <Zap size={17} fill="currentColor" />
              {fmt(progress.bank)}
            </div>
            <div className="flex gap-2 pointer-events-auto">
              <Btn variant="icon" aria-label="How to play" onClick={onHelp}>
                <HelpCircle size={19} />
              </Btn>
              <Btn variant="icon" aria-label={progress.muted ? 'Turn sound on' : 'Turn sound off'} onClick={onMute}>
                {progress.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </Btn>
            </div>
          </div>

          <motion.div className="text-center -mt-24" initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', damping: 22 }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8ee6ff]">Arc endless runner</div>
            <h1 className="font-display font-bold text-[52px] leading-[0.95] tracking-[-0.04em] mt-2 bg-gradient-to-b from-white to-[#9fc4ff] bg-clip-text text-transparent drop-shadow-[0_4px_30px_rgba(53,242,255,0.35)]">
              ARC
              <br />
              ESCAPE
            </h1>
          </motion.div>

          <div className="w-full max-w-md flex flex-col items-center gap-3 pointer-events-auto">
            <div className="grid grid-cols-2 gap-2 w-full">
              <div className="rounded-2xl glass px-4 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6cc]">
                  <Trophy size={12} /> Best
                </div>
                <div className="font-display text-[22px] font-bold tabular-nums leading-tight">{fmt(progress.best)}</div>
                <div className="text-[12px] text-[#a9bddf] tabular-nums">{fmt(progress.bestDistance)} m</div>
              </div>
              <button onClick={onProgress} className="text-left rounded-2xl glass px-4 py-2.5 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6cc]">
                  <CalendarCheck size={12} /> Daily
                </div>
                <div className="text-[13px] font-medium leading-snug mt-0.5 line-clamp-2 text-pretty">{daily.done ? 'Completed today' : daily.def.label}</div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#35f2ff] to-[#a56bff]" style={{ width: `${Math.min(100, (daily.progress / daily.def.target) * 100)}%` }} />
                </div>
              </button>
            </div>
            <Btn variant="primary" className="w-full" onClick={onPlay}>
              <Play size={18} fill="currentColor" /> Run
            </Btn>
            <div className="flex gap-2">
              <Btn onClick={onSkins}>
                <Palette size={16} /> Skins
              </Btn>
              <Btn onClick={onProgress}>
                <Trophy size={16} /> Progress
              </Btn>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
