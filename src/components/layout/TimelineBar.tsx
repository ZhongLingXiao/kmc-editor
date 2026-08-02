import { useRef, useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

function TBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}

export default function TimelineBar() {
  const { t } = useTranslation()
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const currentTick = useEditorStore((s) => s.currentTick)
  const setFrame = useEditorStore((s) => s.setFrame)
  const setCurrentTick = useEditorStore((s) => s.setCurrentTick)
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  const playSpeed = useEditorStore((s) => s.playSpeed)
  const setPlaySpeed = useEditorStore((s) => s.setPlaySpeed)
  const updateFrame = useEditorStore((s) => s.updateFrame)
  const previewLoop = useEditorStore((s) => s.previewLoop)
  const togglePreviewLoop = useEditorStore((s) => s.togglePreviewLoop)
  const fps = useEditorStore((s) => s.fps)

  const hasFrames = animation.elements.length > 0
  const isLastFrame = currentFrameIndex === animation.elements.length - 1
  const isFirstFrame = currentFrameIndex <= 0

  const [pxPerTick, setPxPerTick] = useState(12)
  const minPxPerTick = 2
  const maxPxPerTick = 40

  const frameStartTicks = useMemo(() => {
    const result: number[] = []
    let acc = 0
    for (const elem of animation.elements) {
      result.push(acc)
      acc += elem.duration
    }
    return result
  }, [animation.elements])

  const dragRef = useRef<{ frameIndex: number; startX: number; startDur: number; pxPerTick: number } | null>(null)
  const [draggingFrame, setDraggingFrame] = useState<number | null>(null)
  const playheadDragRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 测量滚动容器可视宽度，用于标尺铺满（即使无帧也有完整刻度尺）
  const [viewWidth, setViewWidth] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setViewWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleDurMouseDown = (e: React.MouseEvent, frameIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const elem = animation.elements[frameIndex]
    if (!elem) return
    dragRef.current = { frameIndex, startX: e.clientX, startDur: elem.duration, pxPerTick }
    setDraggingFrame(frameIndex)
  }

  const tickFromClientX = (clientX: number): number => {
    const scroll = scrollRef.current
    if (!scroll) return 0
    const rect = scroll.getBoundingClientRect()
    const x = clientX - rect.left + scroll.scrollLeft
    return Math.max(0, Math.min(animation.totalTicks, Math.round(x / pxPerTick)))
  }

  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    playheadDragRef.current = true
    setPlaying(false)
  }

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setPlaying(false)
    setCurrentTick(tickFromClientX(e.clientX))
    playheadDragRef.current = true
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const { frameIndex, startX, startDur, pxPerTick: pt } = dragRef.current
      const deltaPx = e.clientX - startX
      const newDur = Math.max(1, startDur + Math.round(deltaPx / pt))
      if (animation.elements[frameIndex]?.duration !== newDur) {
        updateFrame(frameIndex, { duration: newDur })
      }
      return
    }
    if (playheadDragRef.current) {
      setCurrentTick(tickFromClientX(e.clientX))
    }
  }

  const handleMouseUp = () => {
    dragRef.current = null
    setDraggingFrame(null)
    playheadDragRef.current = false
  }

  const handlePlay = () => {
    if (isLastFrame) setCurrentTick(0)
    setPlaying(true)
  }

  const timelineWidth = animation.totalTicks * pxPerTick
  // 内容宽度：至少铺满可视区，避免空场景标尺缩成一团
  const contentWidth = Math.max(timelineWidth, viewWidth, 100)
  // 仅当内容真的超出可视区时才允许横向滚动，否则 hidden 避免空场景误出滚动条
  const canScroll = viewWidth > 0 && timelineWidth > viewWidth

  const tickStep = useMemo(() => {
    const minStep = Math.ceil(40 / pxPerTick)
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500]
    for (const s of steps) if (s >= minStep) return s
    return 500
  }, [pxPerTick])

  // 刻度铺满整个内容宽度（超出 totalTicks 的部分也画刻度，仅作标尺参考）
  const rulerTicks = useMemo(() => {
    const ticks: number[] = []
    const maxTick = Math.ceil(contentWidth / pxPerTick)
    for (let t = 0; t <= maxTick; t += tickStep) ticks.push(t)
    return ticks
  }, [contentWidth, pxPerTick, tickStep])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -2 : 2
    setPxPerTick((prev) => Math.max(minPxPerTick, Math.min(maxPxPerTick, prev + delta)))
  }

  return (
    <div className="flex shrink-0 flex-col border-t bg-card" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex h-[38px] items-center gap-1 border-b px-2">
        <TBtn title={t('timeline.first')} onClick={() => { setPlaying(false); setFrame(0) }} disabled={!hasFrames}><SkipBack /></TBtn>
        <TBtn title={t('timeline.prev')} onClick={() => { setPlaying(false); if (currentFrameIndex > 0) setFrame(currentFrameIndex - 1) }} disabled={!hasFrames || isFirstFrame}><ChevronLeft /></TBtn>
        <TBtn title={isPlaying ? t('timeline.pause') : t('timeline.play')} onClick={() => isPlaying ? setPlaying(false) : handlePlay()} disabled={!hasFrames}>
          {isPlaying ? <Pause /> : <Play />}
        </TBtn>
        <TBtn title={t('timeline.next')} onClick={() => { setPlaying(false); if (!isLastFrame) setFrame(currentFrameIndex + 1) }} disabled={!hasFrames || isLastFrame}><ChevronRight /></TBtn>
        <TBtn title={t('timeline.last')} onClick={() => { setPlaying(false); setFrame(animation.elements.length - 1) }} disabled={!hasFrames}><SkipForward /></TBtn>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={togglePreviewLoop}
              disabled={!hasFrames}
              className={cn(previewLoop && 'bg-accent text-accent-foreground')}
            >
              <Repeat className={cn(previewLoop && 'text-primary')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('timeline.loop')}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Select value={String(playSpeed)} onValueChange={(v) => setPlaySpeed(parseFloat(v))}>
          <SelectTrigger className="h-7 w-[108px] border-0 bg-transparent px-2 shadow-none hover:bg-accent focus-visible:ring-0 focus-visible:border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.25">0.25x</SelectItem>
            <SelectItem value="0.5">0.5x</SelectItem>
            <SelectItem value="1">{t('timeline.speed60')}</SelectItem>
            <SelectItem value="2">2x</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Badge variant="secondary" className="font-normal">
          {t('timeline.frameBadge', { cur: currentFrameIndex >= 0 ? currentFrameIndex : '-', total: hasFrames ? animation.elements.length - 1 : 0 })}
        </Badge>
        <Badge variant="secondary" className="font-normal text-orange-600">
          Tick {currentTick}/{animation.totalTicks}
        </Badge>
        {isPlaying && fps > 0 && (
          <Badge variant="secondary" className="font-normal text-emerald-600">
            {fps} fps
          </Badge>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Kbd className="px-1.5 py-0 text-[10px]">{t('common.wheel')}</Kbd>
          <span>{t('timeline.zoomTimeline')}</span>
        </div>
      </div>

      <div ref={scrollRef} className={cn("relative h-[54px] overflow-y-hidden", canScroll ? "overflow-x-auto" : "overflow-x-hidden")} onWheel={handleWheel}>
        <div className="relative w-full" style={{ minWidth: timelineWidth }}>
          {/* 标尺：刻度铺满，数字在顶部、刻度线在底部 */}
          <div className="relative h-[18px] cursor-pointer border-b bg-card" onMouseDown={handleRulerMouseDown}>
            {rulerTicks.map((tick) => (
              <div key={tick} className="absolute bottom-0 top-0" style={{ left: tick * pxPerTick }}>
                <span className="absolute left-1 top-0.5 whitespace-nowrap text-[9px] leading-none text-muted-foreground">{tick}</span>
                <div className="absolute bottom-0 h-2 w-px bg-muted-foreground/40" />
              </div>
            ))}
          </div>

          {/* 帧条区：浅灰底与标尺分区；无帧时显示提示 */}
          <div className="relative h-[36px] bg-muted/30">
            {hasFrames ? (
              animation.elements.map((elem, i) => {
                const width = elem.duration * pxPerTick
                const left = frameStartTicks[i] * pxPerTick
                return (
                  <div
                    key={i}
                    className={cn(
                      'absolute flex h-full cursor-pointer flex-col justify-center overflow-hidden px-1 select-none bg-background hover:bg-accent',
                      i === currentFrameIndex && 'bg-accent'
                    )}
                    style={{ width, minWidth: 1, left }}
                    onClick={() => setFrame(i)}
                  >
                    {width >= 30 && (
                      <div className={cn('whitespace-nowrap text-[10px]', i === currentFrameIndex ? 'font-medium text-foreground' : 'text-muted-foreground')}>F{i}</div>
                    )}
                    {width >= 50 && <div className="whitespace-nowrap text-[10px] text-muted-foreground">{elem.duration}t</div>}
                    {/* 帧尾拖拽手柄：8px 透明命中区 + 1px 可见细线，hover/拖拽中变主色 */}
                    <div
                      className="group absolute right-[-4px] top-0 bottom-0 w-2 cursor-ew-resize"
                      onMouseDown={(e) => handleDurMouseDown(e, i)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={cn(
                          'absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary',
                          draggingFrame === i && 'bg-primary'
                        )}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                {t('timeline.importToCreate')}
              </div>
            )}
          </div>

          {hasFrames && (
            <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5" style={{ left: currentTick * pxPerTick }}>
              <div className="pointer-events-auto absolute left-[-5px] bottom-0 top-0 w-3 cursor-ew-resize" onMouseDown={handlePlayheadMouseDown} />
              <div className="mx-auto h-full w-0.5 bg-red-500" />
              <div className="absolute left-[-5px] top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
              <div className="absolute left-1.5 top-2 whitespace-nowrap rounded bg-background px-1 text-[9px] text-red-500">{currentTick}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
