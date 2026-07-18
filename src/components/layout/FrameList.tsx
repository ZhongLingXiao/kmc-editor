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
} from '@/components/ui/context-menu'
import { Plus, Copy, Trash2, ImageUp, LayoutGrid, List, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export default function FrameList() {
  const animation = useEditorStore((s) => s.animation)
  // 播放时冻结为 -1：不高亮、不显示底部操作栏，且 currentFrameIndex 变化不触发 re-render
  const currentFrameIndex = useEditorStore((s) => (s.isPlaying ? -1 : s.currentFrameIndex))
  const setFrame = useEditorStore((s) => s.setFrame)
  const removeFrame = useEditorStore((s) => s.removeFrame)
  const duplicateFrame = useEditorStore((s) => s.duplicateFrame)
  const loadSprite = useEditorStore((s) => s.loadSprite)
  const addFrame = useEditorStore((s) => s.addFrame)
  const insertFrame = useEditorStore((s) => s.insertFrame)
  const moveFrame = useEditorStore((s) => s.moveFrame)
  const frameListMode = useEditorStore((s) => s.frameListMode)
  const setFrameListMode = useEditorStore((s) => s.setFrameListMode)

  const spriteInputRef = useRef<HTMLInputElement>(null)
  const pendingFrameIndex = useRef<number>(-1)

  const handleLoadSprite = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || pendingFrameIndex.current < 0) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        loadSprite(pendingFrameIndex.current, file.name, dataUrl, img.width, img.height)
      }
      img.onerror = () => toast.error('图片加载失败')
      img.src = dataUrl
    }
    reader.onerror = () => toast.error('图片读取失败')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const startLoadSprite = (index: number) => {
    pendingFrameIndex.current = index
    spriteInputRef.current?.click()
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
            <Button variant="ghost" size="icon-xs" onClick={addFrame}>
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
                  onClick={() => setFrame(i)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md hover:bg-accent',
                    frameListMode === 'detail' ? 'px-2 py-1.5' : 'px-2 py-1 text-xs',
                    i === currentFrameIndex && 'bg-accent'
                  )}
                >
                  {frameListMode === 'detail' ? (
                    <>
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{i}</span>
                      <div
                        className="size-9 shrink-0 rounded border bg-muted"
                        style={{
                          backgroundImage: elem.sprite.data ? `url(${elem.sprite.data})` : 'none',
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'center',
                        }}
                      />
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
      {currentFrameIndex >= 0 && (
        <>
          <Separator />
          <div className="flex shrink-0 gap-1 p-1.5">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => startLoadSprite(currentFrameIndex)}>
              载入图
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => duplicateFrame(currentFrameIndex)}>
                  <Copy />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制帧</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeFrame(currentFrameIndex)}
                  disabled={animation.elements.length <= 1}
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除帧</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  )
}
