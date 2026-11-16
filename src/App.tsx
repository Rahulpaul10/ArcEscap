import { useEffect, useState } from 'react'
import { CharacterSelect } from '@/components/CharacterSelect'
import { Hud } from '@/components/Hud'
import { GameOver, PauseOverlay, Tutorial } from '@/components/Overlays'
import { ProgressSheet, SkinsSheet } from '@/components/Sheets'
import { StartScreen } from '@/components/StartScreen'
import { confirmCharacter, selectCharacter } from '@/game/progress'
import { useArcEscape } from '@/game/useArcEscape'

export default function App() {
  const [hostRef, g] = useArcEscape()
  const [sheet, setSheet] = useState<'skins' | 'progress' | null>(null)
  const [select, setSelect] = useState<null | 'menu' | 'beforeRun'>(null)
  const { setPreview } = g
  useEffect(() => {
    setPreview(select !== null)
  }, [select, setPreview])
  const confirm = () => {
    g.click()
    confirmCharacter()
    const wasBeforeRun = select === 'beforeRun'
    setSelect(null)
    if (wasBeforeRun) g.play()
  }
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
        visible={g.phase === 'menu' && !g.tutorial && select === null}
        progress={g.progress}
        onPlay={() => (g.progress.characterChosen ? g.play() : (g.click(), setSelect('beforeRun')))}
        onCharacter={() => (g.click(), setSelect('menu'))}
        onSkins={() => open('skins')}
        onProgress={() => open('progress')}
        onHelp={g.showTutorial}
        onMute={g.toggleMute}
      />

      <CharacterSelect
        open={select !== null && g.phase === 'menu'}
        mode={select === 'beforeRun' ? 'beforeRun' : 'menu'}
        selectedId={g.progress.character}
        onPick={selectCharacter}
        onConfirm={confirm}
        onClose={() => setSelect(null)}
      />

      <PauseOverlay open={g.phase === 'paused'} muted={g.progress.muted} onResume={g.resume} onRestart={g.restart} onMenu={g.toMenu} onMute={g.toggleMute} />
      <GameOver open={g.phase === 'over'} result={g.result} progress={g.progress} onRestart={g.restart} onMenu={g.toMenu} />
      <Tutorial open={g.tutorial} onConfirm={g.confirmTutorial} onClose={g.closeTutorial} />

      <SkinsSheet open={sheet === 'skins' && g.phase === 'menu'} onClose={() => setSheet(null)} progress={g.progress} />
      <ProgressSheet open={sheet === 'progress' && g.phase === 'menu'} onClose={() => setSheet(null)} progress={g.progress} />
    </div>
  )
}
