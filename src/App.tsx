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
import StatusBar from './components/layout/StatusBar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

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
        const { selectedBoxId, selectBox, selectedPhase, clearPhaseSelection } = useEditorStore.getState()
        if (selectedBoxId) {
          e.preventDefault()
          selectBox(null, null)
        } else if (selectedPhase) {
          e.preventDefault()
          clearPhaseSelection()
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
        document.getElementById('menu-open-project')?.click()
        return
      }
      if (ctrl && e.key === 'n') {
        e.preventDefault()
        document.getElementById('menu-new-project')?.click()
        return
      }

      // 工具切换（无修饰键）
      if (!ctrl) {
        const k = e.key.toLowerCase()
        if (k === 'q') {
          e.preventDefault()
          useEditorStore.getState().setTool('select')
          return
        }
        if (k === 'w') {
          e.preventDefault()
          useEditorStore.getState().setTool('anchor')
          return
        }
      }

      // 删除优先级：选中对象 → 删对象；多帧选中 → 删选中帧；否则删当前帧
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState()
        if (state.selectedIds.length > 0) {
          e.preventDefault()
          state.removeSelected()
        } else if (state.selectedFrameIndices.length > 1) {
          e.preventDefault()
          state.removeSelectedFrames()
        } else if (state.currentFrameIndex >= 0 && state.animation.elements.length > 1) {
          e.preventDefault()
          state.removeFrame(state.currentFrameIndex)
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
        } else if (state.tool === 'select' && state.selectedIds.length > 0) {
          // 有选中对象（单/多）→ 整体微调
          e.preventDefault()
          state.moveSelected(dx, dy)
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
          <div className="flex w-[220px] shrink-0 flex-col border-r bg-card">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize="67%" minSize="20%" className="flex h-full flex-col">
                <FrameList />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize="33%" minSize="20%" className="flex h-full flex-col">
                <Outline />
              </ResizablePanel>
            </ResizablePanelGroup>
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
        <StatusBar />
      </div>
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  )
}
