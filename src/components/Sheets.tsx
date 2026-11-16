import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, CalendarCheck, Check, Flag, Gauge, Lock, Magnet, Map as MapIcon, Palette, Shield, Trophy, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { MILESTONE_STEP } from '@/game/config'
import { ACHIEVEMENTS, SKINS, buyOrSelectSkin, dailyView, type Achievement, type Progress } from '@/game/progress'
import { audio } from '@/game/audio'
import { ArcMark, Sheet, fmt } from './ui'

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

const ICONS: Record<Achievement['icon'], ReactNode> = {
  flag: <Flag size={18} />,
  zap: <Zap size={18} />,
  trophy: <Trophy size={18} />,
  shield: <Shield size={18} />,
  magnet: <Magnet size={18} />,
  gauge: <Gauge size={18} />,
  calendar: <CalendarCheck size={18} />,
  palette: <Palette size={18} />,
  'arrow-up': <ArrowUp size={18} />,
  'arrow-down': <ArrowDown size={18} />,
  map: <MapIcon size={18} />,
}

export function SkinsSheet({ open, onClose, progress }: { open: boolean; onClose: () => void; progress: Progress }) {
  const [note, setNote] = useState('')
  const pick = (id: string) => {
    audio.unlock()
    const r = buyOrSelectSkin(id)
    if (r === 'poor') setNote('Not enough Arc Energy yet. Keep running!')
    else {
      setNote('')
      audio.play(r === 'bought' ? 'power' : 'click')
    }
  }
  return (
    <Sheet open={open} title="Colorways" onClose={onClose}>
      <div className="flex items-center gap-2 mb-4 text-[#ffc83d] font-display font-semibold">
        <ArcMark size={16} />
        <span className="tabular-nums">{fmt(progress.bank)}</span>
        <span className="text-[13px] font-normal text-[#8fa6cc]">Arc Energy banked</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {SKINS.map((s) => {
          const owned = progress.skins.includes(s.id)
          const active = progress.skin === s.id
          return (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              className={`relative text-left rounded-2xl p-3 glass active:scale-[0.98] transition-transform ${active ? 'ring-2 ring-[#acc6e9]' : ''}`}
            >
              <div
                className="h-20 rounded-xl mb-2.5 grid place-items-center"
                style={{ background: `linear-gradient(160deg, ${hex(s.suit)}, #0a0f2a)` }}
              >
                <div className="relative h-12 w-7 rounded-lg" style={{ background: hex(s.suit), boxShadow: `0 0 0 2px ${hex(s.trim)}, 0 0 22px ${hex(s.glow)}` }}>
                  <span className="absolute left-1 right-1 top-2 h-1.5 rounded-sm" style={{ background: hex(s.visor) }} />
                </div>
              </div>
              <div className="font-display font-semibold text-[15px]">{s.name}</div>
              <div className="text-[12px] text-[#8fa6cc] leading-snug text-pretty min-h-[32px]">{s.blurb}</div>
              <div className="mt-2 h-7 flex items-center text-[12px] font-semibold">
                {active ? (
                  <span className="flex items-center gap-1 text-[#8ee6ff]"><Check size={14} /> Equipped</span>
                ) : owned ? (
                  <span className="text-[#dbe8ff]">Tap to equip</span>
                ) : (
                  <span className={`flex items-center gap-1 tabular-nums ${progress.bank >= s.cost ? 'text-[#ffc83d]' : 'text-[#8fa6cc]'}`}>
                    <Lock size={12} />
                    <ArcMark size={12} />
                    {fmt(s.cost)}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {note && <p className="mt-4 text-[13px] text-[#ff9aa6]">{note}</p>}
    </Sheet>
  )
}

type Tab = 'daily' | 'badges' | 'milestones'

export function ProgressSheet({ open, onClose, progress }: { open: boolean; onClose: () => void; progress: Progress }) {
  const [tab, setTab] = useState<Tab>('daily')
  const daily = dailyView(progress)
  const pct = Math.min(1, daily.progress / daily.def.target)
  const tabs: [Tab, string][] = [
    ['daily', 'Daily'],
    ['badges', `Badges ${progress.achievements.length}/${ACHIEVEMENTS.length}`],
    ['milestones', 'Milestones'],
  ]
  return (
    <Sheet open={open} title="Progress" onClose={onClose}>
      <div className="flex gap-1 p-1 rounded-full glass mb-4">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 h-10 rounded-full text-[13px] font-semibold transition-colors ${tab === id ? 'bg-[#dbe8ff] text-[#0b1330]' : 'text-[#a9bddf]'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <div className="rounded-2xl glass p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6cc]">Today's challenge</span>
            <span className="flex items-center gap-1 text-[#ffc83d] text-[13px] font-semibold tabular-nums">
              <ArcMark size={13} />+{daily.def.reward}
            </span>
          </div>
          <p className="mt-2 font-display text-[19px] font-semibold tracking-tight text-balance">{daily.def.label}</p>
          <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-[#35f2ff] to-[#a56bff]" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6 }} />
          </div>
          <div className="mt-2 flex justify-between text-[12px] text-[#a9bddf] tabular-nums">
            <span>
              {fmt(Math.min(daily.progress, daily.def.target))} / {fmt(daily.def.target)}
            </span>
            <span>{daily.done ? 'Completed. Reward banked.' : 'Resets at midnight'}</span>
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const got = progress.achievements.includes(a.id)
            return (
              <div key={a.id} className={`rounded-2xl glass p-3 ${got ? '' : 'opacity-50'}`}>
                <div className={`h-9 w-9 rounded-xl grid place-items-center mb-2 ${got ? 'bg-[#35f2ff]/20 text-[#8ee6ff]' : 'bg-white/5 text-[#8fa6cc]'}`}>
                  {got ? ICONS[a.icon] : <Lock size={16} />}
                </div>
                <div className="font-display text-[14px] font-semibold">{a.name}</div>
                <div className="text-[12px] text-[#8fa6cc] leading-snug text-pretty">{a.desc}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'milestones' && (
        <div>
          <p className="text-[13px] text-[#a9bddf] mb-3 text-pretty">Reach each distance marker in a single run to light it up. Every marker you pass mid-run also pays bonus Arc Energy.</p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => {
              const lit = progress.bestMilestone >= i + 1
              return (
                <div key={i} className={`rounded-xl py-3 text-center glass ${lit ? 'ring-1 ring-[#35f2ff]/70' : 'opacity-50'}`}>
                  <div className={`mx-auto mb-1 h-2 w-2 rounded-full ${lit ? 'bg-[#35f2ff] shadow-[0_0_10px_#35f2ff]' : 'bg-white/20'}`} />
                  <div className="font-display text-[13px] font-semibold tabular-nums">{((i + 1) * MILESTONE_STEP) / 1000}k</div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
            <Stat label="Total runs" value={fmt(progress.totals.runs)} />
            <Stat label="Total distance" value={`${fmt(progress.totals.distance)} m`} />
            <Stat label="Energy collected" value={fmt(progress.totals.energy)} />
            <Stat label="Best score" value={fmt(progress.best)} />
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl glass px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#8fa6cc]">{label}</div>
      <div className="font-display text-[17px] font-semibold tabular-nums">{value}</div>
    </div>
  )
}
