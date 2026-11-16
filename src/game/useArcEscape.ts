import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from './audio'
import { Engine } from './engine'
import { applyRun, getProgress, skinById, updateProgress, useProgress, type RunOutcome } from './progress'
import { characterById } from './characters'
import { emptyHud, type HudState, type Phase, type RunStats } from './types'

export interface ToastMsg {
  id: number
  text: string
  tone: 'energy' | 'power' | 'info' | 'danger'
}

export interface RunResult {
  stats: RunStats
  outcome: RunOutcome
  prevBest: number
  prevBestDistance: number
}

export function useArcEscape() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const toastId = useRef(0)
  const progress = useProgress()
  const [phase, setPhase] = useState<Phase>('menu')
  const [hud, setHud] = useState<HudState>(emptyHud())
  const [result, setResult] = useState<RunResult | null>(null)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [tutorial, setTutorial] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const p = getProgress()
    const engine = new Engine(
      host,
      {
        onPhase: setPhase,
        onHud: setHud,
        onToast: (text, tone) => setToast({ id: ++toastId.current, text, tone }),
        onGameOver: (stats) => {
          const before = getProgress()
          const outcome = applyRun(stats)
          setResult({ stats, outcome, prevBest: before.best, prevBestDistance: before.bestDistance })
        },
      },
      characterById(p.character),
      skinById(p.skin),
      p.muted,
    )
    engineRef.current = engine
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setLook(characterById(progress.character), skinById(progress.skin))
  }, [progress.skin, progress.character])

  const setPreview = useCallback((on: boolean) => engineRef.current?.setPreview(on), [])

  useEffect(() => {
    engineRef.current?.setMuted(progress.muted)
  }, [progress.muted])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 1700)
    return () => window.clearTimeout(t)
  }, [toast])

  const click = useCallback(() => {
    audio.unlock()
    audio.play('click')
  }, [])

  const begin = useCallback(() => {
    setResult(null)
    setToast(null)
    engineRef.current?.start()
  }, [])

  const play = useCallback(() => {
    click()
    if (!getProgress().tutorialSeen) setTutorial(true)
    else begin()
  }, [begin, click])

  const confirmTutorial = useCallback(() => {
    click()
    updateProgress((p) => {
      p.tutorialSeen = true
    })
    setTutorial(false)
    begin()
  }, [begin, click])

  const api = {
    progress,
    phase,
    hud,
    result,
    toast,
    tutorial,
    showTutorial: () => {
      click()
      setTutorial(true)
    },
    closeTutorial: () => setTutorial(false),
    confirmTutorial,
    play,
    restart: () => {
      click()
      begin()
    },
    toMenu: () => {
      click()
      setResult(null)
      engineRef.current?.toMenu()
    },
    setPreview,
    pause: () => engineRef.current?.pause(),
    resume: () => engineRef.current?.resume(),
    click,
    toggleMute: () => {
      audio.unlock()
      updateProgress((p) => {
        p.muted = !p.muted
      })
    },
  }
  return [hostRef, api] as const
}
