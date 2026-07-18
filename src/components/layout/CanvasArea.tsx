import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import EditorCanvas from '../canvas/EditorCanvas'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu'
import { spaceState } from '../../lib/space-pan'
import { MousePointer2, Move, Square, Swords, Diamond, Box, Crosshair } from 'lucide-react'

export default function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize)
  const scale = useEditorStore((s) => s.scale)
  const setScale = useEditorStore((s) => s.setScale)
  const setPan = useEditorStore((s) => s.setPan)
  const resetView = useEditorStore((s) => s.resetView)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const setTool = useEditorStore((s) => s.setTool)
  const setOffset = useEditorStore((s) => s.setOffset)
  const addFrame = useEditorStore((s) => s.addFrame)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const animation = useEditorStore((s) => s.animation)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)

  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)

  // 自适应画布大小
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize(rect.width, rect.height)
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setCanvasSize])

  // 跟踪空格按下（用于显示抓取光标）
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(scale + delta * scale)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // 中键 或 按住空格 → 平移
    if (e.button === 1 || spaceState.held) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    if (spaceState.held) spaceState.panned = true
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan(panStart.current.panX + dx, panStart.current.panY + dy)
  }

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false)
  }

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null

  const cursor = isPanning ? 'grabbing' : spaceHeld ? 'grab' : 'default'

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-muted">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => resetView()}
            style={{ cursor }}
          >
            <EditorCanvas />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>切换工具</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => setTool('select')}>
                <MousePointer2 /> 选择
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('anchor')}>
                <Move /> 精灵对齐
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setTool('hurtbox')}>
                <Square /> 受击框
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('hitbox')}>
                <Swords /> 攻击框
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('jcbox')}>
                <Diamond /> JC框
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('pushbox')}>
                <Box /> 推挤框
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('spawnpoint')}>
                <Crosshair /> 发射点
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          {frame && frame.sprite.w > 0 && (
            <>
              <ContextMenuItem onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), frame.sprite.h)}>
                设为脚底中心
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), Math.round(frame.sprite.h / 2))}>
                设为图片中心
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => addFrame()}>新建帧</ContextMenuItem>
          <ContextMenuItem onClick={() => resetView()}>重置视图</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>切换图层</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => toggleLayer('grid')}>
                {showLayers.grid ? '✓ ' : ''}网格
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toggleLayer('onionSkin')}>
                {showLayers.onionSkin ? '✓ ' : ''}洋葱皮
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>

      <Badge variant="secondary" className="pointer-events-none absolute bottom-2 right-3 font-normal">
        缩放 {Math.round(scale * 100)}%
      </Badge>
    </div>
  )
}
