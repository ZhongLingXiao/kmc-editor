import { useEffect, useRef } from 'react'
import { useEditorStore } from './store/editorStore'
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SlidersHorizontal, Settings } from 'lucide-react'
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
  const elemCount = useEditorStore((s) => s.animation.elements.length)

  // 播放预览：rAF 驱动 + 时间累积，保证 1x=60tick/秒 准确
  // （setTimeout 链式会因 re-render 调度开销累积延迟，实际帧率偏低）
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const accRef = useRef(0)

  useEffect(() => {
    if (!isPlaying || elemCount === 0) return

    lastTimeRef.current = null
    accRef.current = 0
    let frameCount = 0
    let fpsLastUpdate = 0
    const tickTime = (1000 / 60) / playSpeed

    const loop = (now: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = now
        fpsLastUpdate = now
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now
      accRef.current += delta

      // 按累积真实时间推进 tick，一帧内可推进多个（避免后台回来跳变）
      const state = useEditorStore.getState()
      while (accRef.current >= tickTime) {
        accRef.current -= tickTime
        let next = state.currentTick + 1
        if (next >= state.animation.totalTicks) {
          if (state.previewLoop) {
            next = 0
          } else {
            state.setPlaying(false)
            state.setFps(0)
            return
          }
        }
        state.setCurrentTick(next)
      }

      // 每 500ms 更新一次实时帧率显示
      frameCount++
      if (now - fpsLastUpdate >= 500) {
        state.setFps(Math.round((frameCount * 1000) / (now - fpsLastUpdate)))
        fpsLastUpdate = now
        frameCount = 0
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      useEditorStore.getState().setFps(0)
    }
  }, [isPlaying, playSpeed, elemCount])

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
        <Tabs defaultValue="inspect" className="flex w-[320px] min-w-0 flex-col border-l bg-card">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inspect">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex"><SlidersHorizontal /></span>
                </TooltipTrigger>
                <TooltipContent>检视</TooltipContent>
              </Tooltip>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex"><Settings /></span>
                </TooltipTrigger>
                <TooltipContent>设置</TooltipContent>
              </Tooltip>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inspect" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Inspector />
          </TabsContent>
          <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
        </div>
        <TimelineBar />
      </div>
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  )
}
