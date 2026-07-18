import { useRef, useState, useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'

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
  const updateAnimationMeta = useEditorStore((s) => s.updateAnimationMeta)
  const updateFrame = useEditorStore((s) => s.updateFrame)

  const hasFrames = animation.elements.length > 0
  const isLastFrame = currentFrameIndex === animation.elements.length - 1
  const isFirstFrame = currentFrameIndex <= 0

  // 时间轴缩放：每个 tick 占多少像素
  const [pxPerTick, setPxPerTick] = useState(12) // 默认 12px/tick
  const minPxPerTick = 2
  const maxPxPerTick = 40

  // 计算每帧的起始 tick
  const frameStartTicks = useMemo(() => {
    const result: number[] = []
    let acc = 0
    for (const elem of animation.elements) {
      result.push(acc)
      acc += elem.duration
    }
    return result
  }, [animation.elements])

  // 拖拽调整 duration
  const dragRef = useRef<{ frameIndex: number; startX: number; startDur: number; pxPerTick: number } | null>(null)
  const [draggingFrame, setDraggingFrame] = useState<number | null>(null)

  // 拖拽播放头
  const playheadDragRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 缩放滑拽（按住中间数值按钮左右拖动）
  const zoomDragRef = useRef<{ startX: number; startPx: number; moved: boolean } | null>(null)

  const handleZoomMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    zoomDragRef.current = { startX: e.clientX, startPx: pxPerTick, moved: false }

    const onMove = (ev: MouseEvent) => {
      const z = zoomDragRef.current
      if (!z) return
      const delta = ev.clientX - z.startX
      if (Math.abs(delta) > 3) z.moved = true
      // 往右拖放大、往左拖缩小，每 2px 调整 1 个单位
      const newPx = Math.max(minPxPerTick, Math.min(maxPxPerTick, Math.round(z.startPx + delta * 0.5)))
      setPxPerTick(newPx)
    }
    const onUp = () => {
      const z = zoomDragRef.current
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // 没有显著位移视为单击：恢复默认缩放
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

  // 由鼠标 clientX 计算对应 tick
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
    // 点击标尺直接把播放头跳到该 tick
    e.preventDefault()
    setPlaying(false)
    setCurrentTick(tickFromClientX(e.clientX))
    playheadDragRef.current = true
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const { frameIndex, startX, startDur, pxPerTick: pt } = dragRef.current
      const deltaPx = e.clientX - startX
      const deltaTicks = Math.round(deltaPx / pt)
      const newDur = Math.max(1, startDur + deltaTicks)
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

  // 时间轴总宽度
  const timelineWidth = animation.totalTicks * pxPerTick

  // 标尺刻度间隔：选择合适的步长
  const tickStep = useMemo(() => {
    const minLabelSpacing = 40 // 标签最小间距 40px
    const minStep = Math.ceil(minLabelSpacing / pxPerTick)
    // 取整到 1, 2, 5, 10, 20, 50...
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500]
    for (const s of steps) {
      if (s >= minStep) return s
    }
    return 500
  }, [pxPerTick])

  // 标尺刻度
  const rulerTicks = useMemo(() => {
    const ticks: number[] = []
    for (let t = 0; t <= animation.totalTicks; t += tickStep) {
      ticks.push(t)
    }
    return ticks
  }, [animation.totalTicks, tickStep])

  // 滚轮缩放时间轴
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -2 : 2
    setPxPerTick((prev) => Math.max(minPxPerTick, Math.min(maxPxPerTick, prev + delta)))
  }

  return (
    <div className="timeline-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* 顶部：控制按钮 */}
      <div className="timeline-controls">
        <button onClick={() => { setPlaying(false); setFrame(0) }} disabled={!hasFrames} title="回到第一帧">⏮</button>
        <button onClick={() => { setPlaying(false); if (currentFrameIndex > 0) setFrame(currentFrameIndex - 1) }} disabled={!hasFrames || isFirstFrame} title="上一帧 (←)">◀</button>
        {isPlaying ? (
          <button onClick={() => setPlaying(false)} disabled={!hasFrames} title="暂停 (空格)" style={{ minWidth: 56 }}>⏸ 暂停</button>
        ) : (
          <button onClick={handlePlay} disabled={!hasFrames} title="播放 (空格)" style={{ minWidth: 56 }}>▶ 播放</button>
        )}
        <button onClick={() => { setPlaying(false); if (!isLastFrame) setFrame(currentFrameIndex + 1) }} disabled={!hasFrames || isLastFrame} title="下一帧 (→)">▶</button>
        <button onClick={() => { setPlaying(false); setFrame(animation.elements.length - 1) }} disabled={!hasFrames} title="跳到最后一帧">⏭</button>

        <div className="toolbar-separator" />

        <button className={animation.loop ? 'active' : ''} onClick={() => updateAnimationMeta({ loop: !animation.loop })} disabled={!hasFrames} title="循环播放" style={{ minWidth: 36 }}>🔁</button>

        <div className="toolbar-separator" />

        <span className="toolbar-label">速度</span>
        <select value={playSpeed} onChange={(e) => setPlaySpeed(parseFloat(e.target.value))} style={{ background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#ddd', padding: '3px 4px', borderRadius: 3, fontSize: 11 }}>
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x (60fps)</option>
          <option value={2}>2x</option>
        </select>

        <div className="toolbar-separator" />

        <span className="toolbar-label" style={{ fontSize: 11 }}>
          帧 {currentFrameIndex >= 0 ? currentFrameIndex : '-'}/{hasFrames ? animation.elements.length - 1 : 0}
        </span>
        <span className="toolbar-label" style={{ fontSize: 11, color: '#ff8866' }}>
          Tick {currentTick}/{animation.totalTicks}
        </span>

        <div style={{ flex: 1 }} />

        {/* 时间轴缩放 */}
        <span className="toolbar-label" style={{ fontSize: 11 }}>缩放</span>
        <button onClick={() => setPxPerTick((p) => Math.max(minPxPerTick, p - 2))} title="缩小时间轴" style={{ minWidth: 28, padding: '2px 4px' }}>−</button>
        <button onMouseDown={handleZoomMouseDown} title="左右拖动调节缩放，单击恢复默认" style={{ minWidth: 36, padding: '2px 4px', cursor: 'ew-resize', userSelect: 'none' }}>{pxPerTick}px</button>
        <button onClick={() => setPxPerTick((p) => Math.min(maxPxPerTick, p + 2))} title="放大时间轴" style={{ minWidth: 28, padding: '2px 4px' }}>+</button>
      </div>

      {/* 底部：标尺 + 帧时间轴 */}
      <div className="timeline-scroll" ref={scrollRef} onWheel={handleWheel} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ width: Math.max(timelineWidth, 100), position: 'relative' }}>
          {/* 标尺：点击/拖拽可移动播放头 */}
          <div className="timeline-ruler" onMouseDown={handleRulerMouseDown} style={{ cursor: 'pointer' }}>
            {rulerTicks.map((tick) => (
              <div key={tick} className="timeline-ruler-tick" style={{ left: tick * pxPerTick }}>
                <div className="timeline-ruler-line" />
                <span className="timeline-ruler-label">{tick}</span>
              </div>
            ))}
          </div>

          {/* 帧条 */}
          <div className="timeline-frames-row">
            {animation.elements.map((elem, i) => {
              const width = elem.duration * pxPerTick
              const left = frameStartTicks[i] * pxPerTick
              return (
                <div
                  key={i}
                  className={`timeline-frame ${i === currentFrameIndex ? 'active' : ''} ${draggingFrame === i ? 'dragging' : ''}`}
                  style={{ width, minWidth: 1, position: 'absolute', left }}
                  onClick={() => setFrame(i)}
                >
                  {width >= 30 && <div className="timeline-frame-elem">F{i}</div>}
                  {width >= 50 && <div className="timeline-frame-dur">{elem.duration}t</div>}
                  {/* 拖拽手柄 */}
                  <div
                    className="timeline-frame-handle"
                    onMouseDown={(e) => handleDurMouseDown(e, i)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )
            })}
          </div>

          {/* 播放头：按 tick 定位，可拖拽，不限制在帧之间；跨越标尺与帧条 */}
          {hasFrames && (
            <div
              className="timeline-playhead"
              style={{ left: currentTick * pxPerTick }}
            >
              {/* 透明宽抓取区，方便拖拽 */}
              <div className="timeline-playhead-grip" onMouseDown={handlePlayheadMouseDown} />
              <div className="timeline-playhead-line" />
              <div className="timeline-playhead-head" />
              <div className="timeline-playhead-label">{currentTick}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
