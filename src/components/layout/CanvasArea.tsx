import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import EditorCanvas from '../canvas/EditorCanvas'

export default function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize)
  const scale = useEditorStore((s) => s.scale)
  const setScale = useEditorStore((s) => s.setScale)
  const setPan = useEditorStore((s) => s.setPan)
  const resetView = useEditorStore((s) => s.resetView)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)

  // 平移状态
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [cursor, setCursor] = useState<string>('default')

  // 自适应画布大小
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setCanvasSize(rect.width, rect.height)
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [setCanvasSize])

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(scale + delta * scale)
  }

  // 右键或中键开始平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      // 右键或中键拖拽平移
      e.preventDefault()
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY }
      setCursor('grabbing')
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan(panStart.current.panX + dx, panStart.current.panY + dy)
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      setCursor('default')
    }
  }

  // 右键菜单禁用（否则会弹出浏览器菜单）
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  // 双击重置视图
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (e.button === 0) {
      resetView()
    }
  }

  return (
    <div className="canvas-area">
      <div
        ref={containerRef}
        className="canvas-container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        style={{ cursor }}
      >
        <EditorCanvas />
      </div>
      {/* 缩放和平移提示 */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 11,
        color: '#666',
        pointerEvents: 'none',
        background: 'rgba(30,30,30,0.8)',
        padding: '4px 8px',
        borderRadius: 3,
      }}>
        缩放: {Math.round(scale * 100)}% | 右键拖拽平移 | 双击重置
      </div>
    </div>
  )
}
