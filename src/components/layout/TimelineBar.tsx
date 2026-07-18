import { useRef, useState, useMemo } from 'react'
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
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, Repeat, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const zoomDragRef = useRef<{ startX: number; startPx: number; moved: boolean } | null>(null)

  const handleZoomMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    zoomDragRef.current = { startX: e.clientX, startPx: pxPerTick, moved: false }
    const onMove = (ev: MouseEvent) => {
      const z = zoomDragRef.current
      if (!z) return
      const delta = ev.clientX - z.startX
      if (Math.abs(delta) > 3) z.moved = true
      setPxPerTick(Math.max(minPxPerTick, Math.min(maxPxPerTick, Math.round(z.startPx + delta * 0.5))))
    }
    const onUp = () => {
      const z = zoomDragRef.current
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (z && !z.moved) setPxPerTick(12)
      zoomDragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

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

  const tickStep = useMemo(() => {
    const minStep = Math.ceil(40 / pxPerTick)
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500]
    for (const s of steps) if (s >= minStep) return s
    return 500
  }, [pxPerTick])

  const rulerTicks = useMemo(() => {
    const ticks: number[] = []
    for (let t = 0; t <= animation.totalTicks; t += tickStep) ticks.push(t)
    return ticks
  }, [animation.totalTicks, tickStep])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -2 : 2
    setPxPerTick((prev) => Math.max(minPxPerTick, Math.min(maxPxPerTick, prev + delta)))
  }

  return (
    <div className="flex shrink-0 flex-col border-t bg-card" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="flex h-[38px] items-center gap-1 border-b px-2">
        <TBtn title="第一帧" onClick={() => { setPlaying(false); setFrame(0) }} disabled={!hasFrames}><SkipBack /></TBtn>
        <TBtn title="上一帧 (←)" onClick={() => { setPlaying(false); if (currentFrameIndex > 0) setFrame(currentFrameIndex - 1) }} disabled={!hasFrames || isFirstFrame}><ChevronLeft /></TBtn>
        <TBtn title={isPlaying ? '暂停 (空格)' : '播放 (空格)'} onClick={() => isPlaying ? setPlaying(false) : handlePlay()} disabled={!hasFrames}>
          {isPlaying ? <Pause /> : <Play />}
        </TBtn>
        <TBtn title="下一帧 (→)" onClick={() => { setPlaying(false); if (!isLastFrame) setFrame(currentFrameIndex + 1) }} disabled={!hasFrames || isLastFrame}><ChevronRight /></TBtn>
        <TBtn title="最后帧" onClick={() => { setPlaying(false); setFrame(animation.elements.length - 1) }} disabled={!hasFrames}><SkipForward /></TBtn>

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
          <TooltipContent>循环播放</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Select value={String(playSpeed)} onValueChange={(v) => setPlaySpeed(parseFloat(v))}>
          <SelectTrigger className="h-7 w-[88px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0.25">0.25x</SelectItem>
            <SelectItem value="0.5">0.5x</SelectItem>
            <SelectItem value="1">1x (60fps)</SelectItem>
            <SelectItem value="2">2x</SelectItem>
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Badge variant="secondary" className="font-normal">
          帧 {currentFrameIndex >= 0 ? currentFrameIndex : '-'}/{hasFrames ? animation.elements.length - 1 : 0}
        </Badge>
        <Badge variant="secondary" className="font-normal text-orange-600">
          Tick {currentTick}/{animation.totalTicks}
        </Badge>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">缩放</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" onClick={() => setPxPerTick((p) => Math.max(minPxPerTick, p - 2))}><Minus /></Button>
          </TooltipTrigger>
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 cursor-ew-resize px-2" onMouseDown={handleZoomMouseDown}>{pxPerTick}px</Button>
          </TooltipTrigger>
          <TooltipContent>左右拖动调节，单击恢复</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" onClick={() => setPxPerTick((p) => Math.min(maxPxPerTick, p + 2))}><Plus /></Button>
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>
      </div>

      <div ref={scrollRef} className="relative h-[54px] overflow-x-auto overflow-y-hidden" onWheel={handleWheel}>
        <div className="relative" style={{ width: Math.max(timelineWidth, 100) }}>
          <div className="relative h-[18px] cursor-pointer border-b bg-card" onMouseDown={handleRulerMouseDown}>
            {rulerTicks.map((tick) => (
              <div key={tick} className="absolute bottom-0 top-0" style={{ left: tick * pxPerTick }}>
                <div className="mx-auto h-2 w-px bg-muted-foreground/40" />
                <span className="absolute left-0.5 top-2 whitespace-nowrap text-[9px] text-muted-foreground">{tick}</span>
              </div>
            ))}
          </div>

          <div className="relative h-[36px]">
            {animation.elements.map((elem, i) => {
              const width = elem.duration * pxPerTick
              const left = frameStartTicks[i] * pxPerTick
              return (
                <div
                  key={i}
                  className={cn(
                    'absolute flex h-full cursor-pointer flex-col justify-center overflow-hidden border-l border-r border-transparent px-1 select-none hover:bg-accent',
                    i === currentFrameIndex && 'bg-accent border-l-primary',
                    draggingFrame === i && 'border-r-2 border-r-primary'
                  )}
                  style={{ width, minWidth: 1, left }}
                  onClick={() => setFrame(i)}
                >
                  {width >= 30 && <div className="whitespace-nowrap text-[10px] text-muted-foreground">F{i}</div>}
                  {width >= 50 && <div className="whitespace-nowrap text-[10px] text-muted-foreground">{elem.duration}t</div>}
                  <div
                    className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/30"
                    onMouseDown={(e) => handleDurMouseDown(e, i)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )
            })}
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
