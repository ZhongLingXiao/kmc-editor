import { useRef, useEffect, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
import { Plus, Copy, CopyPlus, Trash2, ImageUp, LayoutGrid, List, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { importImageToProject, importSpritesBatch } from '../../lib/image'
import { useSprite } from '../../lib/spriteResolver'
import type { SpriteSource } from '../../types/animation'
import SpriteSheetDialog, { type SpriteSheetResult } from './SpriteSheetDialog'

export default function FrameList() {
  const animation = useEditorStore((s) => s.animation)
  // 播放时冻结为 -1：不高亮、不显示底部操作栏，且 currentFrameIndex 变化不触发 re-render
  const currentFrameIndex = useEditorStore((s) => (s.isPlaying ? -1 : s.currentFrameIndex))
  const setFrame = useEditorStore((s) => s.setFrame)
  const selectedFrameIndices = useEditorStore((s) => (s.isPlaying ? [] : s.selectedFrameIndices))
  const toggleFrameSelection = useEditorStore((s) => s.toggleFrameSelection)
  const selectFrameRange = useEditorStore((s) => s.selectFrameRange)
  const removeFrame = useEditorStore((s) => s.removeFrame)
  const duplicateFrame = useEditorStore((s) => s.duplicateFrame)
  const loadSprite = useEditorStore((s) => s.loadSprite)
  const addFrame = useEditorStore((s) => s.addFrame)
  const insertFrame = useEditorStore((s) => s.insertFrame)
  const moveFrame = useEditorStore((s) => s.moveFrame)
  const applyFrameToFrames = useEditorStore((s) => s.applyFrameToFrames)
  const frameListMode = useEditorStore((s) => s.frameListMode)
  const setFrameListMode = useEditorStore((s) => s.setFrameListMode)

  const spriteInputRef = useRef<HTMLInputElement>(null)
  const pendingFrameIndex = useRef<number>(-1)
  const [spriteDialogFile, setSpriteDialogFile] = useState<File | null>(null)
  const [spriteDialogOpen, setSpriteDialogOpen] = useState(false)

  const handleLoadSprite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || pendingFrameIndex.current < 0) return
    e.target.value = ''
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    if (imgs.length === 1) {
      // 单张 → 弹切分对话框（单帧/多帧切分）
      setSpriteDialogFile(imgs[0])
      setSpriteDialogOpen(true)
      return
    }
    // 多张 → 批量导入（每张一帧）
    await importBatchToFrames(imgs, pendingFrameIndex.current)
  }

  const startLoadSprite = (index: number) => {
    pendingFrameIndex.current = index
    spriteInputRef.current?.click()
  }

  // SpriteSheetDialog 确认：单帧替换当前帧；多帧第一帧替换当前帧，其余追加末尾
  const handleSpriteConfirm = async (result: SpriteSheetResult) => {
    const file = spriteDialogFile
    const idx = pendingFrameIndex.current
    if (!file || idx < 0) return
    try {
      const info = await importImageToProject(file)
      const regions = result.regions
      const first = regions[0]
      loadSprite(idx, info.src, first.x, first.y, first.w, first.h)
      for (let i = 1; i < regions.length; i++) {
        const lastIdx = useEditorStore.getState().animation.elements.length - 1
        addFrame(lastIdx)
        const newIdx = useEditorStore.getState().currentFrameIndex
        loadSprite(newIdx, info.src, regions[i].x, regions[i].y, regions[i].w, regions[i].h)
      }
      toast.success(result.mode === 'single' ? '已导入图片' : `已导入 ${regions.length} 帧`)
    } catch (err) {
      toast.error((err as Error).message || '图片加载失败')
    }
  }

  // 批量导入多张图（每张一帧）：第一帧导入到 firstIdx，其余追加末尾
  const importBatchToFrames = async (files: File[], firstIdx: number) => {
    try {
      const results = await importSpritesBatch(files)
      if (results.length === 0) return
      const first = results[0]
      loadSprite(firstIdx, first.src, 0, 0, first.w, first.h)
      for (let k = 1; k < results.length; k++) {
        const lastIdx = useEditorStore.getState().animation.elements.length - 1
        addFrame(lastIdx)
        const newIdx = useEditorStore.getState().currentFrameIndex
        loadSprite(newIdx, results[k].src, 0, 0, results[k].w, results[k].h)
      }
      toast.success(`已导入 ${results.length} 帧`)
    } catch (err) {
      toast.error((err as Error).message || '图片加载失败')
    }
  }

  const handleFrameClick = (i: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleFrameSelection(i)
    } else if (e.shiftKey) {
      const anchor = useEditorStore.getState().currentFrameIndex
      if (anchor >= 0) {
        const [from, to] = anchor <= i ? [anchor, i] : [i, anchor]
        const indices: number[] = []
        for (let f = from; f <= to; f++) indices.push(f)
        selectFrameRange(indices)
      } else {
        setFrame(i)
      }
    } else {
      setFrame(i)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">帧列表</span>
          <ToggleGroup
            type="single"
            value={frameListMode}
            onValueChange={(v) => { if (v) setFrameListMode(v as 'detail' | 'compact') }}
          >
            <ToggleGroupItem value="detail" className="h-6 w-6 p-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex"><LayoutGrid className="size-3.5" /></span>
                </TooltipTrigger>
                <TooltipContent>详细视图</TooltipContent>
              </Tooltip>
            </ToggleGroupItem>
            <ToggleGroupItem value="compact" className="h-6 w-6 p-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex"><List className="size-3.5" /></span>
                </TooltipTrigger>
                <TooltipContent>紧凑视图</TooltipContent>
              </Tooltip>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" onClick={() => addFrame()}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加帧</TooltipContent>
        </Tooltip>
      </div>
      <Separator />
      <input
        ref={spriteInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleLoadSprite}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1.5">
          {animation.elements.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              没有帧
              <br />
              点击上方 + 添加帧
            </div>
          )}
          {animation.elements.map((elem, i) => (
            <ContextMenu key={i}>
              <ContextMenuTrigger asChild>
                <div
                  onClick={(e) => handleFrameClick(i, e)}
                  onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault() }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const imgs = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
                    if (imgs.length === 0) return
                    pendingFrameIndex.current = i
                    if (imgs.length === 1) {
                      setSpriteDialogFile(imgs[0])
                      setSpriteDialogOpen(true)
                    } else {
                      await importBatchToFrames(imgs, i)
                    }
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy' }}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 rounded-md',
                    frameListMode === 'detail' ? 'px-2 py-1.5' : 'px-2 py-1 text-xs',
                    selectedFrameIndices.includes(i) ? 'bg-accent' : 'hover:bg-accent/60',
                    i === currentFrameIndex && 'font-medium'
                  )}
                >
                  {frameListMode === 'detail' ? (
                    <>
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i}</span>
                      <SpriteThumb sprite={elem.sprite} />
                      <div className="min-w-0 flex-1 text-xs">
                        <div>{elem.duration} Tick</div>
                        <div className="text-muted-foreground">
                          {elem.sprite.w > 0 ? `${elem.sprite.w}×${elem.sprite.h}` : '无图片'}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="w-5 shrink-0 text-muted-foreground">{i}</span>
                      <span>{elem.duration}t</span>
                      <span className="text-muted-foreground">
                        {elem.sprite.w > 0 ? `${elem.sprite.w}×${elem.sprite.h}` : '无图'}
                      </span>
                    </>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => startLoadSprite(i)}>
                  <ImageUp /> 载入图
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => insertFrame(i, i)}>
                  <Plus /> 在前面插入帧
                </ContextMenuItem>
                <ContextMenuItem onClick={() => insertFrame(i + 1, i)}>
                  <Plus /> 在后面插入帧
                </ContextMenuItem>
                <ContextMenuItem onClick={() => duplicateFrame(i)}>
                  <Copy /> 复制帧
                </ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <CopyPlus /> 应用此帧信息到…
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    <ContextMenuItem
                      onClick={() => {
                        const targets = selectedFrameIndices.filter((idx) => idx !== i)
                        if (targets.length === 0) {
                          toast.warning('请先按住 Ctrl/Shift 多选其他帧')
                          return
                        }
                        applyFrameToFrames(i, targets)
                        toast.success(`已应用到 ${targets.length} 个选中帧`)
                      }}
                      disabled={selectedFrameIndices.filter((idx) => idx !== i).length === 0}
                    >
                      选中帧
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        const targets = animation.elements.map((_, idx) => idx).filter((idx) => idx !== i)
                        applyFrameToFrames(i, targets)
                        toast.success(`已应用到所有其他帧（${targets.length}）`)
                      }}
                      disabled={animation.elements.length <= 1}
                    >
                      所有其他帧
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        const targets = animation.elements.map((_, idx) => idx).filter((idx) => idx > i)
                        if (targets.length === 0) return
                        applyFrameToFrames(i, targets)
                        toast.success(`已应用到 ${targets.length} 个后续帧`)
                      }}
                      disabled={i >= animation.elements.length - 1}
                    >
                      所有后续帧
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => moveFrame(i, i - 1)} disabled={i === 0}>
                  <ArrowUp /> 上移帧
                </ContextMenuItem>
                <ContextMenuItem onClick={() => moveFrame(i, i + 1)} disabled={i === animation.elements.length - 1}>
                  <ArrowDown /> 下移帧
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => removeFrame(i)}
                  disabled={animation.elements.length <= 1}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 /> 删除帧
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>
      <SpriteSheetDialog
        open={spriteDialogOpen}
        onOpenChange={setSpriteDialogOpen}
        file={spriteDialogFile}
        onConfirm={handleSpriteConfirm}
      />
    </div>
  )
}

/** 帧缩略图：按 src 从工程目录解析出 blobURL 显示。未加载时显示占位。 */
function SpriteThumb({ sprite }: { sprite: SpriteSource }) {
  const img = useSprite(sprite.src)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 36, 36)
    if (!img || !sprite.w || !sprite.h) return
    const scale = Math.min(36 / sprite.w, 36 / sprite.h)
    const dw = sprite.w * scale
    const dh = sprite.h * scale
    ctx.drawImage(img, sprite.x, sprite.y, sprite.w, sprite.h, (36 - dw) / 2, (36 - dh) / 2, dw, dh)
  }, [img, sprite.src, sprite.x, sprite.y, sprite.w, sprite.h])
  return <canvas ref={canvasRef} width={36} height={36} className="size-9 shrink-0 rounded border bg-muted" />
}
