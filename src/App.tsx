import { useEffect, useRef } from 'react'
import { useEditorStore } from './store/editorStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { spaceState } from './lib/space-pan'
import MenuBar from './components/layout/MenuBar'
import ToolRail from './components/layout/ToolRail'
import FrameList from './components/layout/FrameList'
import Outline from './components/layout/Outline'
import CanvasArea from './components/layout/CanvasArea'
import Inspector from './components/layout/Inspector'
import SettingsPanel from './components/layout/SettingsPanel'
import TimelineBar from './components/layout/TimelineBar'

export default function App() {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const playSpeed = useEditorStore((s) => s.playSpeed)
  const currentTick = useEditorStore((s) => s.currentTick)
  const totalTicks = useEditorStore((s) => s.animation.totalTicks)
  const elemCount = useEditorStore((s) => s.animation.elements.length)
  const loop = useEditorStore((s) => s.previewLoop)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  const setCurrentTick = useEditorStore((s) => s.setCurrentTick)

  // 播放预览：按 tick 推进（1x = 每 1/60 秒一个 tick）
  const playTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying || elemCount === 0) return

    const tickTime = (1000 / 60) / playSpeed

    playTimerRef.current = window.setTimeout(() => {
      let next = currentTick + 1
      if (next >= totalTicks) {
        if (loop) {
          next = 0
        } else {
          setPlaying(false)
          return
        }
      }
      setCurrentTick(next)
    }, tickTime)

    return () => {
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current)
      }
    }
  }, [isPlaying, currentTick, playSpeed, totalTicks, elemCount, loop, setCurrentTick, setPlaying])

  // 键盘快捷键
  useEffect(() => {
    const isInput = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (isInput(e.target)) return
      const ctrl = e.ctrlKey || e.metaKey

      // 空格：按住用于平移，轻点用于播放/暂停（播放判断放在 keyup）
      if (e.code === 'Space') {
        if (!spaceState.held) {
          spaceState.held = true
          spaceState.panned = false
          spaceState.downAt = Date.now()
        }
        e.preventDefault()
        return
      }

      // Esc 取消选中
      if (e.key === 'Escape') {
        const { selectedBoxId, selectBox } = useEditorStore.getState()
        if (selectedBoxId) {
          e.preventDefault()
          selectBox(null, null)
        }
        return
      }

      // 文件操作
      if (ctrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        document.getElementById('menu-save')?.click()
        return
      }
      if (ctrl && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault()
        document.getElementById('menu-saveas')?.click()
        return
      }
      if (ctrl && e.key === 'o') {
        e.preventDefault()
        document.getElementById('menu-open')?.click()
        return
      }
      if (ctrl && e.key === 'n') {
        e.preventDefault()
        document.getElementById('menu-new')?.click()
        return
      }

      // 删除选中对象
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState()
        const { selectedBoxType, selectedBoxId } = state
        if (!selectedBoxType || !selectedBoxId) return
        e.preventDefault()
        if (selectedBoxType === 'hurtbox' || selectedBoxType === 'hitbox' || selectedBoxType === 'jcbox') {
          state.removeBox(selectedBoxType, selectedBoxId)
        } else if (selectedBoxType === 'pushbox') {
          state.setPushbox('stand', null)
        } else if (selectedBoxType === 'spawnpoint') {
          state.removeSpawnPoint(selectedBoxId)
        }
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const state = useEditorStore.getState()
        const step = e.shiftKey ? 10 : 1
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = step
        if (e.key === 'ArrowDown') dy = -step

        if (state.tool === 'anchor' && state.currentFrameIndex >= 0) {
          e.preventDefault()
          const frame = state.animation.elements[state.currentFrameIndex]
          if (!frame) return
          state.setOffset(state.currentFrameIndex, frame.offset.x - dx, frame.offset.y + dy)
        } else if (state.tool === 'select' && state.selectedBoxType && state.selectedBoxId) {
          e.preventDefault()
          const { selectedBoxType: t, selectedBoxId: id } = state
          if (t === 'hurtbox' || t === 'hitbox' || t === 'jcbox') {
            const frame = state.animation.elements[state.currentFrameIndex]
            if (!frame) return
            const list = t === 'hurtbox' ? frame.hurtboxes : t === 'hitbox' ? frame.hitboxes : frame.jcboxes
            const box = list.find((b) => b.id === id)
            if (!box) return
            state.updateBox(t, id, { x: box.x + dx, y: box.y + dy })
          } else if (t === 'spawnpoint') {
            const frame = state.animation.elements[state.currentFrameIndex]
            if (!frame) return
            const p = frame.spawnPoints.find((sp) => sp.id === id)
            if (!p) return
            state.updateSpawnPoint(id, { x: p.x + dx, y: p.y + dy })
          } else if (t === 'pushbox') {
            const pb = state.animation.pushbox.stand
            if (!pb) return
            state.updatePushbox('stand', { x: pb.x + dx, y: pb.y + dy })
          }
        } else if (e.key === 'ArrowLeft') {
          if (state.currentFrameIndex > 0) state.setFrame(state.currentFrameIndex - 1)
        } else if (e.key === 'ArrowRight') {
          if (state.currentFrameIndex < state.animation.elements.length - 1) {
            state.setFrame(state.currentFrameIndex + 1)
          }
        }
      } else if (ctrl && e.key === 'z') {
        e.preventDefault()
        useEditorStore.temporal.getState().undo()
      } else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        useEditorStore.temporal.getState().redo()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const wasHeld = spaceState.held
        spaceState.held = false
        // 轻点（短按且未发生平移）= 播放/暂停
        if (wasHeld && !spaceState.panned && Date.now() - spaceState.downAt < 300) {
          const { isPlaying, setPlaying, animation } = useEditorStore.getState()
          if (animation.elements.length > 0) setPlaying(!isPlaying)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
        <MenuBar />
        <div className="flex min-h-0 flex-1">
          <ToolRail />
          <div className="flex w-[220px] min-w-0 flex-col border-r bg-card">
            <FrameList />
            <Outline />
          </div>
          <CanvasArea />
          <div className="flex w-[320px] min-w-0 flex-col border-l bg-card">
            <Inspector />
            <SettingsPanel />
          </div>
        </div>
        <TimelineBar />
      </div>
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  )
}
