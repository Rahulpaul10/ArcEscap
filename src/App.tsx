import { useState } from 'react'
import { Hud } from '@/components/Hud'
import { GameOver, PauseOverlay, Tutorial } from '@/components/Overlays'
import { ProgressSheet, SkinsSheet } from '@/components/Sheets'
import { StartScreen } from '@/components/StartScreen'
import { useArcEscape } from '@/game/useArcEscape'

export default function App() {
  const [hostRef, g] = useArcEscape()
  const [sheet, setSheet] = useState<'skins' | 'progress' | null>(null)
  const open = (s: 'skins' | 'progress') => {
    g.click()
    setSheet(s)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#070a1f] font-body text-[#e8f1ff]">
      <div ref={hostRef} className="absolute inset-0 touch-none" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(3,6,26,0.55)_100%)]" />

      <Hud hud={g.hud} toast={g.toast} visible={g.phase === 'playing' || g.phase === 'paused'} onPause={g.pause} />

      <StartScreen
        visible={g.phase === 'menu' && !g.tutorial}
        progress={g.progress}
        onPlay={g.play}
        onSkins={() => open('skins')}
        onProgress={() => open('progress')}
        onHelp={g.showTutorial}
        onMute={g.toggleMute}
      />

      <PauseOverlay open={g.phase === 'paused'} muted={g.progress.muted} onResume={g.resume} onRestart={g.restart} onMenu={g.toMenu} onMute={g.toggleMute} />
      <GameOver open={g.phase === 'over'} result={g.result} progress={g.progress} onRestart={g.restart} onMenu={g.toMenu} />
      <Tutorial open={g.tutorial} onConfirm={g.confirmTutorial} onClose={g.closeTutorial} />

      <SkinsSheet open={sheet === 'skins' && g.phase === 'menu'} onClose={() => setSheet(null)} progress={g.progress} />
      <ProgressSheet open={sheet === 'progress' && g.phase === 'menu'} onClose={() => setSheet(null)} progress={g.progress} />
    </div>
  )
}
