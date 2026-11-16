import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CHARACTERS, characterById, type Character } from '@/game/characters'
import { Btn } from './ui'

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

interface Props {
  open: boolean
  /** 'beforeRun' is shown the first time you press Run */
  mode: 'menu' | 'beforeRun'
  selectedId: string
  onPick: (id: string) => void
  onConfirm: () => void
  onClose: () => void
}

function Swatch({ c, size = 44 }: { c: Character; size?: number }) {
  const p = c.palette
  return (
    <span
      className="relative rounded-full shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(180deg, ${hex(c.hair)} 0 38%, ${hex(c.skin)} 38% 100%)`,
        boxShadow: `inset 0 0 0 3px ${hex(p.suit)}, 0 0 14px ${hex(p.glow)}55`,
      }}
    >
      <span className="absolute rounded-full" style={{ left: '30%', top: '52%', width: '11%', height: '17%', background: '#14102a' }} />
      <span className="absolute rounded-full" style={{ left: '59%', top: '52%', width: '11%', height: '17%', background: '#14102a' }} />
      <span className="absolute rounded-b-full" style={{ left: '38%', top: '74%', width: '24%', height: '10%', background: '#5a1020' }} />
    </span>
  )
}

export function CharacterSelect({ open, mode, selectedId, onPick, onConfirm, onClose }: Props) {
  const [filter, setFilter] = useState<'all' | 'female' | 'male'>('all')
  const current = characterById(selectedId)
  const list = CHARACTERS.filter((c) => filter === 'all' || c.gender === filter)
  const idx = list.findIndex((c) => c.id === selectedId)
  const step = (d: number) => onPick(list[(Math.max(0, idx) + (idx < 0 ? 0 : d) + list.length) % list.length].id)
  const shuffle = () => {
    const others = list.filter((c) => c.id !== selectedId)
    onPick(others[Math.floor(Math.random() * others.length)].id)
  }

  useEffect(() => {
    if (open) document.getElementById(`chip-${selectedId}`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [open, selectedId, filter])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-20 flex flex-col pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <div className="safe-top px-4 pointer-events-auto">
            <div className="mx-auto max-w-md flex items-center gap-3">
              <Btn variant="icon" aria-label="Back" onClick={onClose}>
                <ChevronLeft size={20} />
              </Btn>
              <div>
                <h2 className="font-display text-[22px] font-bold tracking-tight leading-tight">Choose your runner</h2>
                <p className="text-[12px] text-[#a9bddf]">Every runner has the same speed and moves.</p>
              </div>
            </div>
          </div>

          {/* swipe zone over the 3D preview */}
          <motion.div
            className="relative flex-1 pointer-events-auto touch-pan-y"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              if (info.offset.x < -40) step(1)
              else if (info.offset.x > 40) step(-1)
            }}
          >
            <button aria-label="Previous runner" onClick={() => step(-1)} className="absolute left-3 top-1/3 h-12 w-12 grid place-items-center rounded-full glass active:scale-95">
              <ChevronLeft size={22} />
            </button>
            <button aria-label="Next runner" onClick={() => step(1)} className="absolute right-3 top-1/3 h-12 w-12 grid place-items-center rounded-full glass active:scale-95">
              <ChevronRight size={22} />
            </button>
          </motion.div>

          <motion.div
            className="pointer-events-auto mx-auto w-full max-w-md px-4 safe-bottom"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          >
            <div className="rounded-[26px] glass !bg-[#0b1233]/80 p-4">
              <div className="flex items-start justify-between gap-3 min-h-[64px]">
                <AnimatePresence mode="wait">
                  <motion.div key={current.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.18 }}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-[28px] font-bold tracking-tight leading-none">{current.name}</h3>
                      <span className="flex items-center gap-1 h-6 px-2 rounded-full bg-white/10 text-[11px] font-semibold text-[#cfe0ff]">
                        {current.gender === 'female' ? 'Female' : 'Male'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="h-6 px-2 rounded-full bg-[#35f2ff]/15 text-[11px] font-semibold text-[#8ee6ff] flex items-center">{current.style}</span>
                      <span className="h-6 px-2 rounded-full bg-white/10 text-[11px] font-semibold text-[#cfe0ff] flex items-center capitalize">{current.mood}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-[#a9bddf] text-pretty">{current.tagline}</p>
                  </motion.div>
                </AnimatePresence>
                <div className="flex gap-1.5 pt-1.5">
                  {[current.palette.suit, current.palette.trim, current.palette.glow].map((c, i) => (
                    <motion.span key={`${current.id}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05, type: 'spring' }} className="h-4 w-4 rounded-full ring-1 ring-white/30" style={{ background: hex(c) }} />
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 gap-1 p-1 rounded-full bg-white/5">
                  {(['all', 'female', 'male'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 h-8 rounded-full text-[12px] font-semibold capitalize transition-colors ${filter === f ? 'bg-[#dbe8ff] text-[#0b1330]' : 'text-[#a9bddf]'}`}
                    >
                      {f === 'all' ? `All ${CHARACTERS.length}` : f}
                    </button>
                  ))}
                </div>
                <button aria-label="Random runner" onClick={shuffle} className="h-10 w-10 grid place-items-center rounded-full bg-white/10 text-[#dbe8ff] active:scale-95">
                  <Shuffle size={16} />
                </button>
              </div>

              <div className="mt-3 flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 snap-x [scrollbar-width:none]">
                {list.map((c) => {
                  const active = c.id === selectedId
                  return (
                    <button key={c.id} id={`chip-${c.id}`} onClick={() => onPick(c.id)} aria-label={`Select ${c.name}`} aria-pressed={active} className="relative snap-center shrink-0 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-2xl active:scale-95 transition-transform">
                      {active && <motion.span layoutId="char-ring" className="absolute inset-0 rounded-2xl bg-white/10 ring-1 ring-[#acc6e9]" transition={{ type: 'spring', damping: 24, stiffness: 340 }} />}
                      <motion.span className="relative" animate={{ scale: active ? 1.12 : 1, y: active ? -2 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 20 }}>
                        <Swatch c={c} />
                      </motion.span>
                      <span className={`relative text-[11px] font-semibold ${active ? 'text-white' : 'text-[#8fa6cc]'}`}>{c.name}</span>
                    </button>
                  )
                })}
              </div>

              <Btn variant="primary" className="w-full mt-3" onClick={onConfirm}>
                {mode === 'beforeRun' ? (
                  <>
                    <Play size={18} fill="currentColor" /> Run as {current.name}
                  </>
                ) : (
                  'Confirm'
                )}
              </Btn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
