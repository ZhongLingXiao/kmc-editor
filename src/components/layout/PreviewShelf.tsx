import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { FlipHorizontal, Grid3x3, Layers } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { toGame } from '../../utils/coordinate'
import { cn } from '@/lib/utils'

type Facing = 'right' | 'left'

/**
 * 画布预览工具架（左上角浮层）。
 * - 朝向预览：local state（不进 store、不进撤销历史、不导出），翻转时画布只读
 * - 网格 / 洋葱皮：复用 store 的 showLayers（编辑器态，不进 animation 数据）
 * - 光标坐标读数：监听画布容器 mousemove，转逻辑坐标显示
 */
export default function PreviewShelf({
  facing,
  onFacingChange,
  containerRef,
}: {
  facing: Facing
  onFacingChange: (f: Facing) => void
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const flipped = facing === 'left'

  const [coord, setCoord] = useState<{ x: number; y: number } | null>(null)

  // 监听画布容器鼠标移动，实时换算逻辑坐标。容器是 Konva Stage 的父 div，
  // native mousemove 会穿透 Stage 冒泡上来，无需依赖 Konva 事件。
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) {
        setCoord(null)
        return
      }
      const [gx, gy] = toGame(sx, sy)
      setCoord({ x: Math.round(gx), y: Math.round(gy) })
    }
    const onLeave = () => setCoord(null)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [containerRef])

  return (
    <div className="absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-md border bg-card/80 p-1 shadow backdrop-blur-sm">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(flipped && 'bg-accent text-accent-foreground')}
            onClick={() => onFacingChange(flipped ? 'right' : 'left')}
          >
            <FlipHorizontal />
          </Button>
        </TooltipTrigger>
        <TooltipContent>朝向预览：{flipped ? '左（点击恢复右）' : '右（点击切换左）'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(showLayers.grid && 'bg-accent text-accent-foreground')}
            onClick={() => toggleLayer('grid')}
          >
            <Grid3x3 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>网格</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(showLayers.onionSkin && 'bg-accent text-accent-foreground')}
            onClick={() => toggleLayer('onionSkin')}
          >
            <Layers />
          </Button>
        </TooltipTrigger>
        <TooltipContent>洋葱皮</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* 光标逻辑坐标读数：pointer-events-none 让鼠标事件穿透回画布容器，避免悬停读数区时坐标冻结 */}
      <div className="pointer-events-none flex h-7 min-w-[104px] items-center px-1.5 font-mono text-[11px] text-muted-foreground">
        {coord ? `x:${coord.x}  y:${coord.y}` : 'x:—  y:—'}
      </div>
    </div>
  )
}
