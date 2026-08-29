import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { SkipBack, ChevronLeft, Play, Pause, ChevronRight, SkipForward, Repeat, ChevronDown, Check, Flag, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'
import { COLORS, type PhaseMarkers, type PhaseName } from '../../types/animation'
import { getPhaseRanges, phaseAtTick } from '../../utils/phases'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'

const PRESET_SPEEDS = [0.25, 0.5, 1, 2]

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
  const phases = useEditorStore((s) => s.animation.phases)
  const selectedPhase = useEditorStore((s) => s.selectedPhase)
  const setPhaseMarkers = useEditorStore((s) => s.setPhaseMarkers)
  const clearPhaseMarkers = useEditorStore((s) => s.clearPhaseMarkers)
  const selectPhase = useEditorStore((s) => s.selectPhase)
  const clearPhaseSelection = useEditorStore((s) => s.clearPhaseSelection)
  const pxPerTick = useEditorStore((s) => s.timelinePxPerTick)
  const setTimelinePxPerTick = useEditorStore((s) => s.setTimelinePxPerTick)
  const setTimelineViewportWidth = useEditorStore((s) => s.setTimelineViewportWidth)

  const [speedPopoverOpen, setSpeedPopoverOpen] = useState(false)
  const [customSpeedInput, setCustomSpeedInput] = useState('')
  const [phasePopoverOpen, setPhasePopoverOpen] = useState(false)
  const [phaseStartInput, setPhaseStartInput] = useState('')
  const [phaseEndInput, setPhaseEndInput] = useState('')
  const [phaseContextTick, setPhaseContextTick] = useState(0)

  const hasFrames = animation.elements.length > 0
  const isLastFrame = currentFrameIndex === animation.elements.length - 1
  const isFirstFrame = currentFrameIndex <= 0

  const speedLabel = playSpeed === 1 ? t('timeline.speed60') : `${playSpeed}x`

  const applyCustomSpeed = () => {
    const v = parseFloat(customSpeedInput)
    if (!isNaN(v) && v > 0) {
      setPlaySpeed(v)
      setSpeedPopoverOpen(false)
      setCustomSpeedInput('')
    }
  }

  useEffect(() => {
    if (!phasePopoverOpen) return
    setPhaseStartInput(`${phases?.activeStartTick ?? 0}`)
    setPhaseEndInput(`${phases?.activeEndTick ?? animation.totalTicks}`)
  }, [phasePopoverOpen, phases?.activeStartTick, phases?.activeEndTick, animation.totalTicks])

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
  const phaseDragRef = useRef<{
    boundary: 'start' | 'end'
    startX: number
    markers: PhaseMarkers
    pxPerTick: number
  } | null>(null)
  const phasePreviewRef = useRef<PhaseMarkers | null>(null)
  const [phasePreview, setPhasePreview] = useState<PhaseMarkers | null>(null)
  const playheadDragRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollbarTrackRef = useRef<HTMLDivElement>(null)
  const scrollbarDragRef = useRef<{
    startX: number
    startScrollLeft: number
    trackWidth: number
    thumbWidth: number
    maxScrollLeft: number
  } | null>(null)
  const [draggingScrollbar, setDraggingScrollbar] = useState(false)
  const [scrollLeft, setScrollLeft] = useState(0)

  // 测量滚动容器可视宽度，用于标尺铺满（即使无帧也有完整刻度尺）
  const [viewWidth, setViewWidth] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setViewWidth(el.clientWidth)
      setTimelineViewportWidth(el.clientWidth)
      setScrollLeft(el.scrollLeft)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    el.addEventListener('scroll', update)
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', update)
    }
  }, [setTimelineViewportWidth])

  const handleDurMouseDown = useCallback((e: React.PointerEvent, frameIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const elem = animation.elements[frameIndex]
    if (!elem) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { frameIndex, startX: e.clientX, startDur: elem.duration, pxPerTick }
    setDraggingFrame(frameIndex)
  }, [animation.elements, pxPerTick])

  const tickFromClientX = useCallback((clientX: number): number => {
    const scroll = scrollRef.current
    if (!scroll) return 0
    const rect = scroll.getBoundingClientRect()
    const x = clientX - rect.left + scroll.scrollLeft
    return Math.max(0, Math.min(animation.totalTicks, Math.round(x / pxPerTick)))
  }, [animation.totalTicks, pxPerTick])

  const displayedPhases = phasePreview ?? phases
  const phaseRanges = useMemo(
    () => getPhaseRanges(displayedPhases, animation.totalTicks),
    [displayedPhases, animation.totalTicks]
  )

  const phaseSegments = useMemo(() => {
    if (!phaseRanges) return []
    const definitions: Array<{
      name: PhaseName
      label: string
      color: string
      borderColor: string
    }> = [
      {
        name: 'startup',
        label: t('timeline.startup'),
        color: COLORS.phaseStartup,
        borderColor: COLORS.phaseStartupBorder,
      },
      {
        name: 'active',
        label: t('timeline.active'),
        color: COLORS.phaseActive,
        borderColor: COLORS.phaseActiveBorder,
      },
      {
        name: 'recovery',
        label: t('timeline.recovery'),
        color: COLORS.phaseRecovery,
        borderColor: COLORS.phaseRecoveryBorder,
      },
    ]
    return definitions.map((definition) => ({
      ...definition,
      range: phaseRanges[definition.name],
    }))
  }, [phaseRanges, t])

  const selectedPhaseRange = selectedPhase && phaseRanges ? phaseRanges[selectedPhase] : null
  const selectedPhaseLabel =
    selectedPhase === 'startup'
      ? t('timeline.startup')
      : selectedPhase === 'active'
      ? t('timeline.active')
      : selectedPhase === 'recovery'
      ? t('timeline.recovery')
      : null
  const phaseBoundaries = useMemo<Array<{ boundary: 'start' | 'end'; tick: number }>>(() => {
    if (!selectedPhase || !displayedPhases) return []
    if (selectedPhase === 'startup') {
      return [{ boundary: 'start', tick: displayedPhases.activeStartTick }]
    }
    if (selectedPhase === 'recovery') {
      return [{ boundary: 'end', tick: displayedPhases.activeEndTick }]
    }
    return [
      { boundary: 'start', tick: displayedPhases.activeStartTick },
      { boundary: 'end', tick: displayedPhases.activeEndTick },
    ]
  }, [selectedPhase, displayedPhases])

  const applyPhaseInputs = () => {
    const start = Number.parseInt(phaseStartInput, 10)
    const end = Number.parseInt(phaseEndInput, 10)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return
    setPhaseMarkers(start, end)
    if (!phases) selectPhase('active')
  }

  const contextPhase = phaseAtTick(phases, phaseContextTick, animation.totalTicks)
  const contextPhaseLabel =
    contextPhase === 'startup'
      ? t('timeline.startup')
      : contextPhase === 'active'
      ? t('timeline.active')
      : contextPhase === 'recovery'
      ? t('timeline.recovery')
      : null

  const startPhaseFromContext = useCallback(() => {
    if (!hasFrames || animation.totalTicks <= 0) return
    setPhaseMarkers(phases?.activeStartTick ?? 0, phases?.activeEndTick ?? animation.totalTicks)
    selectPhase('active')
  }, [animation.totalTicks, hasFrames, phases, selectPhase, setPhaseMarkers])

  const setContextActiveStart = useCallback(() => {
    if (!hasFrames || animation.totalTicks <= 0) return
    const activeEndTick = phases?.activeEndTick ?? animation.totalTicks
    setPhaseMarkers(Math.min(phaseContextTick, activeEndTick), activeEndTick)
    selectPhase('active')
  }, [animation.totalTicks, hasFrames, phaseContextTick, phases, selectPhase, setPhaseMarkers])

  const setContextActiveEnd = useCallback(() => {
    if (!hasFrames || animation.totalTicks <= 0) return
    const activeStartTick = phases?.activeStartTick ?? 0
    setPhaseMarkers(activeStartTick, Math.max(phaseContextTick, activeStartTick))
    selectPhase('active')
  }, [animation.totalTicks, hasFrames, phaseContextTick, phases, selectPhase, setPhaseMarkers])

  const openPhaseSettings = useCallback(() => {
    setPhasePopoverOpen(true)
  }, [])

  const handlePlayheadMouseDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    playheadDragRef.current = true
    setPlaying(false)
  }

  const handlePhaseTrackMouseDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    clearPhaseSelection()
  }, [clearPhaseSelection])

  const handlePhaseContextMenu = useCallback(() => {
    // 右键菜单的标定位置取打开菜单瞬间的播放头，而不是鼠标横坐标。
    setPhaseContextTick(useEditorStore.getState().currentTick)
  }, [])

  const handlePhaseBoundaryMouseDown = useCallback((
    e: React.PointerEvent,
    boundary: 'start' | 'end'
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!phases) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setPlaying(false)
    const markers = { ...phases }
    phaseDragRef.current = {
      boundary,
      startX: e.clientX,
      markers,
      pxPerTick,
    }
    phasePreviewRef.current = markers
    setPhasePreview(markers)
  }, [phases, pxPerTick, setPlaying])

  const handleRulerMouseDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setPlaying(false)
    clearPhaseSelection()
    setCurrentTick(tickFromClientX(e.clientX))
    playheadDragRef.current = true
  }, [clearPhaseSelection, tickFromClientX, setCurrentTick, setPlaying])

  const handleMouseMove = (e: React.PointerEvent) => {
    if (scrollbarDragRef.current) {
      const { startX, startScrollLeft, trackWidth, thumbWidth, maxScrollLeft: dragMaxScrollLeft } = scrollbarDragRef.current
      const available = trackWidth - thumbWidth
      if (available > 0) {
        setScrollPosition(startScrollLeft + ((e.clientX - startX) / available) * dragMaxScrollLeft)
      }
      return
    }
    if (phaseDragRef.current) {
      const { boundary, startX, markers, pxPerTick: pt } = phaseDragRef.current
      const deltaTick = Math.round((e.clientX - startX) / pt)
      const nextTick = Math.max(0, Math.min(animation.totalTicks, (
        boundary === 'start' ? markers.activeStartTick : markers.activeEndTick
      ) + deltaTick))
      const nextMarkers =
        boundary === 'start'
          ? { activeStartTick: Math.min(nextTick, markers.activeEndTick), activeEndTick: markers.activeEndTick }
          : { activeStartTick: markers.activeStartTick, activeEndTick: Math.max(nextTick, markers.activeStartTick) }
      const previous = phasePreviewRef.current
      if (
        !previous ||
        previous.activeStartTick !== nextMarkers.activeStartTick ||
        previous.activeEndTick !== nextMarkers.activeEndTick
      ) {
        phasePreviewRef.current = nextMarkers
        setPhasePreview(nextMarkers)
      }
      return
    }
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
    scrollbarDragRef.current = null
    setDraggingScrollbar(false)
    if (phaseDragRef.current) {
      const initial = phaseDragRef.current.markers
      const preview = phasePreviewRef.current
      if (
        preview &&
        (preview.activeStartTick !== initial.activeStartTick ||
          preview.activeEndTick !== initial.activeEndTick)
      ) {
        setPhaseMarkers(preview.activeStartTick, preview.activeEndTick)
      }
      phaseDragRef.current = null
      phasePreviewRef.current = null
      setPhasePreview(null)
    }
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

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setScrollLeft(el.scrollLeft)
  }, [timelineWidth, viewWidth])

  const maxScrollLeft = Math.max(0, timelineWidth - viewWidth)
  const scrollbarThumbPercent = canScroll
    ? Math.max(8, Math.min(100, (viewWidth / timelineWidth) * 100))
    : 100
  const scrollbarThumbLeftPercent = canScroll && maxScrollLeft > 0
    ? (scrollLeft / maxScrollLeft) * (100 - scrollbarThumbPercent)
    : 0

  const setScrollPosition = useCallback((value: number) => {
    const el = scrollRef.current
    if (!el) return
    const next = Math.max(0, Math.min(maxScrollLeft, value))
    el.scrollLeft = next
    setScrollLeft(next)
  }, [maxScrollLeft])

  const handleScrollbarTrackMouseDown = (e: React.PointerEvent) => {
    e.preventDefault()
    if (!canScroll) return
    const rect = e.currentTarget.getBoundingClientRect()
    const thumbWidth = rect.width * scrollbarThumbPercent / 100
    const available = rect.width - thumbWidth
    if (available <= 0) return
    const target = (e.clientX - rect.left - thumbWidth / 2) / available
    setScrollPosition(target * maxScrollLeft)
  }

  const handleScrollbarThumbMouseDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canScroll) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const track = scrollbarTrackRef.current
    if (!track) return
    const trackWidth = track.getBoundingClientRect().width
    const thumbWidth = trackWidth * scrollbarThumbPercent / 100
    scrollbarDragRef.current = {
      startX: e.clientX,
      startScrollLeft: scrollLeft,
      trackWidth,
      thumbWidth,
      maxScrollLeft,
    }
    setDraggingScrollbar(true)
  }

  const handleScrollbarKeyDown = (e: React.KeyboardEvent) => {
    if (!canScroll) return
    const step = Math.max(1, Math.round(viewWidth / pxPerTick / 2))
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = scrollLeft - step
    if (e.key === 'ArrowRight') next = scrollLeft + step
    if (e.key === 'PageUp') next = scrollLeft - viewWidth
    if (e.key === 'PageDown') next = scrollLeft + viewWidth
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = maxScrollLeft
    if (next === null) return
    e.preventDefault()
    setScrollPosition(next)
  }

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
    setTimelinePxPerTick(Math.max(minPxPerTick, Math.min(maxPxPerTick, pxPerTick + delta)))
  }

  // 播放时冻结帧条高亮：避免每帧 currentFrameIndex 变化触发帧条重渲染
  const highlightFrame = isPlaying ? -1 : currentFrameIndex

  // 标尺 + 帧条：依赖项排除 currentTick，播放时 useMemo 命中后 React 跳过该子树
  // reconcile，避免每 tick 重建所有帧 div（帧数多时的主要开销）。
  const trackContent = useMemo(() => (
    <>
      {/* 标尺：刻度铺满，数字在顶部、刻度线在底部 */}
      <div className="relative h-[18px] cursor-pointer border-b bg-card" onPointerDown={handleRulerMouseDown}>
        {rulerTicks.map((tick) => (
          <div key={tick} className="absolute bottom-0 top-0" style={{ left: tick * pxPerTick }}>
            <span className="absolute left-1 top-0.5 whitespace-nowrap text-[9px] leading-none text-muted-foreground">{tick}</span>
            <div className="absolute bottom-0 h-2 w-px bg-muted-foreground/40" />
          </div>
        ))}
      </div>

      {/* 阶段条：两个边界分别控制攻击判定的开始与结束 */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="relative h-[22px] cursor-pointer border-b bg-card/60"
            onPointerDown={handlePhaseTrackMouseDown}
            onContextMenu={handlePhaseContextMenu}
          >
        {phaseSegments.length > 0 ? (
          phaseSegments.map((segment) => {
            const width = (segment.range.endTick - segment.range.startTick) * pxPerTick
            const duration = segment.range.endTick - segment.range.startTick
            const phaseText = width >= 76
              ? `${segment.label} ${duration}t`
              : width >= 44
              ? segment.label
              : null
            if (width <= 0) return null
            return (
              <Tooltip key={segment.name}>
                <TooltipTrigger asChild>
                  <div
                className={cn(
                  'absolute bottom-0 top-0 flex items-center justify-center overflow-hidden border-x px-1 text-[10px] font-medium',
                  selectedPhase === segment.name
                    ? 'z-10'
                    : 'opacity-90'
                )}
                style={{
                  left: segment.range.startTick * pxPerTick,
                  width,
                  backgroundColor: segment.color,
                  borderLeftColor: segment.borderColor,
                  borderRightColor: segment.borderColor,
                  boxShadow: selectedPhase === segment.name
                    ? `inset 0 2px 0 ${segment.borderColor}, inset 0 -1px 0 ${segment.borderColor}`
                    : undefined,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setPlaying(false)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  selectPhase(segment.name)
                }}
              >
                {phaseText && <span className="whitespace-nowrap">{phaseText}</span>}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4} className="px-2 py-1.5">
                  <div className="flex flex-col gap-0.5 text-[11px]">
                    <span className="font-medium">{segment.label}</span>
                    <span>{duration} Tick · {segment.range.startTick}–{segment.range.endTick}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })
        ) : (
          <div className="flex h-full items-center px-2 text-[10px] text-muted-foreground">
            {t('timeline.phaseUnset')}
          </div>
        )}

        {phaseBoundaries.map(({ boundary, tick }) => (
          <Tooltip key={boundary}>
            <TooltipTrigger asChild>
            <div
              className="absolute bottom-0 top-0 z-20 w-2 cursor-ew-resize"
              style={{ left: tick * pxPerTick - 4 }}
              onPointerDown={(e) => handlePhaseBoundaryMouseDown(e, boundary)}
            >
              <div
                className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
                style={{ backgroundColor: boundary === 'start' ? COLORS.phaseActiveBorder : COLORS.phaseRecoveryBorder }}
              />
              <div
                className="absolute left-1/2 top-1 size-2 -translate-x-1/2 rotate-45 border bg-background"
                style={{ borderColor: boundary === 'start' ? COLORS.phaseActiveBorder : COLORS.phaseRecoveryBorder }}
              />
            </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {boundary === 'start' ? t('timeline.activeStart') : t('timeline.activeEnd')} · Tick {tick}
            </TooltipContent>
          </Tooltip>
        ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {!phases && (
            <ContextMenuItem onClick={startPhaseFromContext} disabled={!hasFrames}>
              <Flag /> {t('timeline.contextStart')}
            </ContextMenuItem>
          )}
          {contextPhaseLabel && (
            <ContextMenuItem onClick={() => selectPhase(contextPhase)}>
              <Flag /> {t('timeline.contextSelect', { phase: contextPhaseLabel })}
            </ContextMenuItem>
          )}
          {(phases || hasFrames) && <ContextMenuSeparator />}
          <ContextMenuItem onClick={setContextActiveStart} disabled={!hasFrames}>
            {t('timeline.contextSetStart', { tick: phaseContextTick })}
          </ContextMenuItem>
          <ContextMenuItem onClick={setContextActiveEnd} disabled={!hasFrames}>
            {t('timeline.contextSetEnd', { tick: phaseContextTick })}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={openPhaseSettings} disabled={!hasFrames}>
            {t('timeline.contextOpenSettings')}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={clearPhaseMarkers}
            disabled={!phases}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 /> {t('timeline.clearPhase')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* 帧条区：浅灰底与标尺分区；无帧时显示提示 */}
      <div className="relative h-[36px] bg-muted/30">
        {hasFrames ? (
          animation.elements.map((elem, i) => {
            const width = elem.duration * pxPerTick
            const left = frameStartTicks[i] * pxPerTick
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                  'absolute flex h-full cursor-pointer flex-col justify-center overflow-hidden px-1 select-none bg-background hover:bg-accent',
                  i === highlightFrame && 'bg-accent'
                    )}
                    style={{ width, minWidth: 1, left }}
                    onClick={() => setFrame(i)}
                  >
                {width >= 52 && (
                  <div className={cn('whitespace-nowrap text-[10px]', i === highlightFrame ? 'font-medium text-foreground' : 'text-muted-foreground')}>F{i}</div>
                )}
                {width >= 52 && <div className="whitespace-nowrap text-[10px] text-muted-foreground">{elem.duration}t</div>}
                {width >= 28 && width < 52 && (
                  <div className={cn('whitespace-nowrap text-[10px]', i === highlightFrame ? 'font-medium text-foreground' : 'text-muted-foreground')}>F{i}</div>
                )}
                {/* 帧尾拖拽手柄：8px 透明命中区 + 1px 可见细线，hover/拖拽中变主色 */}
                <div
                  className="group absolute right-[-4px] top-0 bottom-0 w-2 cursor-ew-resize"
                  onPointerDown={(e) => handleDurMouseDown(e, i)}
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
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>
                  F{i} · {elem.duration} Tick
                </TooltipContent>
              </Tooltip>
            )
          })
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            {t('timeline.importToCreate')}
          </div>
        )}
      </div>
    </>
  ), [animation.elements, pxPerTick, viewWidth, highlightFrame, draggingFrame, t, rulerTicks, frameStartTicks, timelineWidth, hasFrames, phases, selectedPhase, displayedPhases, phaseSegments, phaseBoundaries, phaseContextTick, contextPhase, contextPhaseLabel, handleDurMouseDown, handleRulerMouseDown, handlePhaseTrackMouseDown, handlePhaseBoundaryMouseDown, handlePhaseContextMenu, startPhaseFromContext, setContextActiveStart, setContextActiveEnd, openPhaseSettings, clearPhaseMarkers, setFrame, selectPhase, setPlaying])

  return (
    <div
      className="flex shrink-0 flex-col border-t bg-card"
      onPointerMove={handleMouseMove}
      onPointerUp={handleMouseUp}
      onPointerCancel={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
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

        <Popover open={phasePopoverOpen} onOpenChange={setPhasePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasFrames}
              className={cn(
                'h-7 justify-between gap-1 border-0 bg-transparent px-2 shadow-none hover:bg-accent focus-visible:ring-0',
                phases && 'text-foreground'
              )}
            >
              <Flag className="size-3.5" />
              <span>{t('timeline.phase')}</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-3" align="start" sideOffset={4}>
            <div className="mb-2">
              <div className="text-xs font-medium">{t('timeline.phaseTitle')}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t('timeline.phaseHint')}
              </div>
            </div>
            {selectedPhaseRange && selectedPhaseLabel ? (
              <div className="mb-2 flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-[11px]">
                <span className="text-muted-foreground">{t('timeline.selectedPhase')}</span>
                <span className="font-medium">
                  {selectedPhaseLabel} {selectedPhaseRange.startTick}–{selectedPhaseRange.endTick} (
                  {selectedPhaseRange.endTick - selectedPhaseRange.startTick}t)
                </span>
              </div>
            ) : (
              <div className="mb-2 text-[11px] text-muted-foreground">
                {t('timeline.selectPhase')}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <label className="w-[84px] shrink-0 text-xs text-muted-foreground">{t('timeline.activeStart')}</label>
                <Input
                  type="number"
                  min="0"
                  max={animation.totalTicks}
                  value={phaseStartInput}
                  onChange={(e) => setPhaseStartInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyPhaseInputs() }}
                  className="h-7 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-[84px] shrink-0 text-xs text-muted-foreground">{t('timeline.activeEnd')}</label>
                <Input
                  type="number"
                  min="0"
                  max={animation.totalTicks}
                  value={phaseEndInput}
                  onChange={(e) => setPhaseEndInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyPhaseInputs() }}
                  className="h-7 text-sm"
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-md bg-muted/50 px-2 py-1.5 text-center text-[10px]">
              <div>
                <div className="text-muted-foreground">{t('timeline.startup')}</div>
                <div className="font-mono">{phaseRanges?.startup.endTick ?? 0}t</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('timeline.active')}</div>
                <div className="font-mono">
                  {phaseRanges ? phaseRanges.active.endTick - phaseRanges.active.startTick : 0}t
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('timeline.recovery')}</div>
                <div className="font-mono">
                  {phaseRanges ? phaseRanges.recovery.endTick - phaseRanges.recovery.startTick : 0}t
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1">
              <Button variant="secondary" size="sm" className="h-7 flex-1" onClick={applyPhaseInputs}>
                <Check className="size-3" />
                {phases ? t('timeline.applyPhase') : t('timeline.enablePhase')}
              </Button>
              {phases && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon-sm" className="h-7 w-7" onClick={clearPhaseMarkers}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('timeline.clearPhase')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Popover open={speedPopoverOpen} onOpenChange={setSpeedPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-[108px] justify-between border-0 bg-transparent px-2 shadow-none hover:bg-accent focus-visible:ring-0"
            >
              <span>{speedLabel}</span>
              <ChevronDown className="size-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[160px] p-1" align="start" sideOffset={4}>
            {PRESET_SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => { setPlaySpeed(s); setSpeedPopoverOpen(false) }}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1 text-sm hover:bg-accent',
                  playSpeed === s && 'bg-accent',
                )}
              >
                <span>{s === 1 ? t('timeline.speed60') : `${s}x`}</span>
                {playSpeed === s && <Check className="size-3" />}
              </button>
            ))}
            <Separator className="my-1" />
            <div className="px-1.5 py-1">
              <div className="mb-1 text-[11px] text-muted-foreground">{t('timeline.customSpeed')}</div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={customSpeedInput}
                  onChange={(e) => setCustomSpeedInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyCustomSpeed() }}
                  placeholder={`${playSpeed}`}
                  className="h-7 text-sm"
                />
                <Button variant="secondary" size="sm" className="h-7 px-2" onClick={applyCustomSpeed}>
                  <Check className="size-3" />
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Kbd className="px-1.5 py-0 text-[10px]">{t('common.wheel')}</Kbd>
          <span>{t('timeline.zoomTimeline')}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'timeline-scroll-hidden relative h-[76px] overflow-y-hidden',
          canScroll ? 'overflow-x-auto' : 'overflow-x-hidden'
        )}
        onWheel={handleWheel}
      >
        <div className="relative w-full" style={{ minWidth: timelineWidth }}>
          {trackContent}

          {hasFrames && (
            <div className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5" style={{ left: currentTick * pxPerTick }}>
              <div className="pointer-events-auto absolute left-[-5px] bottom-0 top-0 w-3 cursor-ew-resize" onPointerDown={handlePlayheadMouseDown} />
              <div className="mx-auto h-full w-0.5 bg-red-500" />
              <div className="absolute left-[-5px] top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
              <div className="absolute left-1.5 top-2 whitespace-nowrap rounded bg-background px-1 text-[9px] text-red-500">{currentTick}</div>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollbarTrackRef}
        className="relative h-[12px] shrink-0 cursor-pointer border-t bg-card/80"
        onPointerDown={handleScrollbarTrackMouseDown}
        aria-label={t('timeline.horizontalScroll')}
      >
        <div className="absolute inset-x-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted">
          <div
            role="scrollbar"
            tabIndex={canScroll ? 0 : -1}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={Math.round(maxScrollLeft)}
            aria-valuenow={Math.round(scrollLeft)}
            aria-label={t('timeline.horizontalScroll')}
            className={cn(
              'absolute bottom-0 top-0 min-w-[28px] rounded-full transition-colors',
              canScroll
                ? draggingScrollbar
                  ? 'bg-muted-foreground'
                  : 'bg-muted-foreground/60 hover:bg-muted-foreground'
                : 'bg-border/70'
            )}
            style={{
              left: `${scrollbarThumbLeftPercent}%`,
              width: `${scrollbarThumbPercent}%`,
            }}
            onPointerDown={handleScrollbarThumbMouseDown}
            onKeyDown={handleScrollbarKeyDown}
          />
        </div>
      </div>
    </div>
  )
}
