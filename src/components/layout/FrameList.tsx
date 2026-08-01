import { useRef } from 'react'
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
import { importImageToProject } from '../../lib/image'
import { useSpriteBlobUrl } from '../../lib/spriteResolver'

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

  const handleLoadSprite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || pendingFrameIndex.current < 0) return
    e.target.value = ''
    try {
      const info = await importImageToProject(file)
      loadSprite(pendingFrameIndex.current, info.src, info.w, info.h)
    } catch (err) {
      toast.error((err as Error).message || '图片加载失败')
    }
  }

  const startLoadSprite = (index: number) => {
    pendingFrameIndex.current = index
    spriteInputRef.current?.click()
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
                    const file = e.dataTransfer.files[0]
                    if (!file || !file.type.startsWith('image/')) return
                    try {
                      const info = await importImageToProject(file)
                      useEditorStore.getState().loadSprite(i, info.src, info.w, info.h)
                      toast.success(`已替换帧 ${i} 的图片`)
                    } catch (err) {
                      toast.error((err as Error).message || '图片加载失败')
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
                      <SpriteThumb src={elem.sprite.src} />
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
    </div>
  )
}

/** 帧缩略图：按 src 从工程目录解析出 blobURL 显示。未加载时显示占位。 */
function SpriteThumb({ src }: { src: string }) {
  const blobUrl = useSpriteBlobUrl(src)
  return (
    <div
      className="size-9 shrink-0 rounded border bg-muted"
      style={{
        backgroundImage: blobUrl ? `url(${blobUrl})` : 'none',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    />
  )
}
