import { useEffect, useRef } from 'react'
import { useEditorStore } from './store/editorStore'
import MenuBar from './components/layout/MenuBar'
import FrameList from './components/layout/FrameList'
import CanvasArea from './components/layout/CanvasArea'
import PropertyPanel from './components/layout/PropertyPanel'
import TimelineBar from './components/layout/TimelineBar'

export default function App() {
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const playSpeed = useEditorStore((s) => s.playSpeed)
  const currentTick = useEditorStore((s) => s.currentTick)
  const totalTicks = useEditorStore((s) => s.animation.totalTicks)
  const elemCount = useEditorStore((s) => s.animation.elements.length)
  const loop = useEditorStore((s) => s.animation.loop)
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const ctrl = e.ctrlKey || e.metaKey

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
      } else if (e.key === ' ') {
        e.preventDefault()
        const { isPlaying, setPlaying, animation } = useEditorStore.getState()
        if (animation.elements.length > 0) setPlaying(!isPlaying)
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const state = useEditorStore.getState()

        if (state.tool === 'anchor' && state.currentFrameIndex >= 0) {
          e.preventDefault()
          const frame = state.animation.elements[state.currentFrameIndex]
          if (!frame) return
          const step = e.shiftKey ? 10 : 1
          let { x, y } = frame.offset
          if (e.key === 'ArrowLeft') x += step
          if (e.key === 'ArrowRight') x -= step
          if (e.key === 'ArrowUp') y += step
          if (e.key === 'ArrowDown') y -= step
          state.setOffset(state.currentFrameIndex, x, y)
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
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="app-layout">
      <MenuBar />
      <div className="app-body">
        <FrameList />
        <CanvasArea />
        <PropertyPanel />
      </div>
      <TimelineBar />
    </div>
  )
}
