import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'

export const fmt = (n: number) => Math.floor(n).toLocaleString('en-US')

type Variant = 'primary' | 'ghost' | 'icon'

export function Btn({
  variant = 'ghost',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-display font-semibold select-none transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#acc6e9]'
  const styles: Record<Variant, string> = {
    primary:
      'h-14 px-8 rounded-full text-[17px] tracking-tight text-[#0b1330] bg-gradient-to-b from-[#f2f7ff] to-[#b9d2f2] shadow-[0_0_32px_rgba(120,190,255,0.35),inset_0_1px_0_rgba(255,255,255,0.9)]',
    ghost: 'h-12 px-5 rounded-full text-[14px] text-[#dbe8ff] glass hover:bg-white/10',
    icon: 'h-11 w-11 rounded-full text-[#dbe8ff] glass hover:bg-white/10',
  }
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-30 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" className="absolute inset-0 bg-[#03061a]/70" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-md max-h-[86dvh] flex flex-col rounded-t-[28px] glass !bg-[#0b1233]/95 overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="h-[3px] w-full bg-gradient-to-r from-[#35f2ff] via-[#a56bff] to-[#ff3df0] opacity-80" />
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="h-11 w-11 -mr-2 grid place-items-center rounded-full text-[#9fb4d8] hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-24 pt-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Counts up to `value` for result screens. */
export function CountUp({ value, duration = 900, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const raf = { id: 0 }
    const t0 = performance.now() + delay
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / duration))
      setV(Math.round(value * (1 - Math.pow(1 - k, 3))))
      if (k < 1) raf.id = requestAnimationFrame(tick)
    }
    raf.id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.id)
  }, [value, duration, delay])
  return <>{fmt(v)}</>
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8fa6cc]">{children}</span>
}
