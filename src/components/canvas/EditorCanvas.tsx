import { useEffect, useRef, useState, useMemo } from 'react'
import { Stage, Layer, Rect, Line, Image as KonvaImage, Group, Circle, Text, Transformer } from 'react-konva'
import { useEditorStore } from '../../store/editorStore'
import { COLORS, Box } from '../../types/animation'
import { toScreen, toGame, toScreenSize, toGameSize } from '../../utils/coordinate'
import Konva from 'konva'

/** 已加载的精灵图缓存（key 是 data URL） */
const spriteCache = new Map<string, HTMLImageElement>()

/** 同步获取缓存的精灵图，如果未加载则触发异步加载 */
function getSprite(data: string): HTMLImageElement | undefined {
  if (!data) return undefined
  const cached = spriteCache.get(data)
  if (cached) return cached
  // 未缓存，触发加载（下次渲染就能拿到）
  if (!spriteCache.has(data)) {
    spriteCache.set(data, undefined as any) // 标记为加载中
    const image = new Image()
    image.onload = () => {
      spriteCache.set(data, image)
      // 触发 React 重渲染（通过全局事件）
      window.dispatchEvent(new CustomEvent('sprite-loaded'))
    }
    image.src = data
  }
  return undefined
}

function useSprite(data: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!data) {
      setImg(undefined)
      return
    }
    const cached = spriteCache.get(data)
    if (cached && !(cached as any).__loading) {
      setImg(cached)
      return
    }
    const image = new Image()
    image.onload = () => {
      spriteCache.set(data, image)
      setImg(image)
    }
    image.src = data
  }, [data])

  // 监听其他地方加载完成的精灵图
  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1)
    window.addEventListener('sprite-loaded', handler)
    return () => window.removeEventListener('sprite-loaded', handler)
  }, [])

  return img
}

export default function EditorCanvas() {
  const canvasWidth = useEditorStore((s) => s.canvasWidth)
  const canvasHeight = useEditorStore((s) => s.canvasHeight)
  const originX = useEditorStore((s) => s.originX)
  const originY = useEditorStore((s) => s.originY)
  const scale = useEditorStore((s) => s.scale)
  const showLayers = useEditorStore((s) => s.showLayers)
  const onionSkin = useEditorStore((s) => s.onionSkin)
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const tool = useEditorStore((s) => s.tool)
  const selectedBoxId = useEditorStore((s) => s.selectedBoxId)
  const selectedBoxType = useEditorStore((s) => s.selectedBoxType)

  const frame = animation.elements[currentFrameIndex]

  const currentSprite = useSprite(frame?.sprite.data || '')

  const transformerRef = useRef<Konva.Transformer>(null)
  const isDrawing = useRef(false)
  const drawStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // 选中框的 ref
  const selectedNodeRef = useRef<Konva.Rect | null>(null)

  // 图片对齐拖拽：记录起点与 Shift 锁定的主轴向（'x'=水平 / 'y'=垂直）
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const lockedAxis = useRef<'x' | 'y' | null>(null)

  // 通用拖拽约束（Shift 锁主轴向），供精灵/框/发射点/推挤框等所有可拖拽对象复用。
  // 与精灵自带的拖拽逻辑共用上面两个 ref（同一时刻只拖一个对象）。
  const shiftDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    dragStartPos.current = { x: e.target.x(), y: e.target.y() }
    lockedAxis.current = null
  }
  const shiftDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const start = dragStartPos.current
    if (!start) return
    if (!e.evt.shiftKey) {
      lockedAxis.current = null
      return
    }
    const dx = e.target.x() - start.x
    const dy = e.target.y() - start.y
    if (!lockedAxis.current) {
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      lockedAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
    }
    if (lockedAxis.current === 'x') {
      e.target.y(start.y) // 冻结垂直，只允许水平移动
    } else {
      e.target.x(start.x) // 冻结水平，只允许垂直移动
    }
  }

  useEffect(() => {
    // 统一 Transformer：推挤框、受击框、攻击框在同一 Layer 中，
    // 选中哪个就绑定哪个节点。
    if (transformerRef.current && selectedNodeRef.current && selectedBoxId) {
      transformerRef.current.nodes([selectedNodeRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    } else if (transformerRef.current) {
      transformerRef.current.nodes([])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [selectedBoxId, selectedBoxType, frame, animation.pushbox.stand])

  type SelectableType = 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint'
  type SelectionCandidate = { type: SelectableType; id: string; priority: number }

  function containsBox(box: Box, gameX: number, gameY: number): boolean {
    return gameX >= box.x && gameX <= box.x + box.w && gameY >= box.y - box.h && gameY <= box.y
  }

  function selectionCandidates(screenX: number, screenY: number): SelectionCandidate[] {
    if (!frame) return []
    const [gameX, gameY] = toGame(screenX, screenY)
    const candidates: SelectionCandidate[] = []

    // 优先级：数字越小越优先选中（发射点 > 攻击框 > 受击框 > 推挤框）
    // 同类型中后创建的优先
    let p = 0
    for (const point of [...frame.spawnPoints].reverse()) {
      const radius = 8 / scale
      if ((point.x - gameX) ** 2 + (point.y - gameY) ** 2 <= radius ** 2) {
        candidates.push({ type: 'spawnpoint', id: point.id, priority: p++ })
      }
    }
    p = 100
    for (const box of [...frame.hitboxes].reverse()) {
      if (containsBox(box, gameX, gameY)) candidates.push({ type: 'hitbox', id: box.id, priority: p++ })
    }
    p = 150
    for (const box of [...frame.jcboxes].reverse()) {
      if (containsBox(box, gameX, gameY)) candidates.push({ type: 'jcbox', id: box.id, priority: p++ })
    }
    p = 200
    for (const box of [...frame.hurtboxes].reverse()) {
      if (containsBox(box, gameX, gameY)) candidates.push({ type: 'hurtbox', id: box.id, priority: p++ })
    }
    const pushbox = animation.pushbox.stand
    if (pushbox && containsBox(pushbox, gameX, gameY)) {
      candidates.push({ type: 'pushbox', id: pushbox.id, priority: 300 })
    }

    candidates.sort((a, b) => a.priority - b.priority)
    return candidates
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== 'select') return
    if (e.target.getParent()?.getClassName() === 'Transformer') return

    const stage = e.target.getStage()
    const pos = stage?.getPointerPosition()
    if (!pos) return

    const candidates = selectionCandidates(pos.x, pos.y)
    const store = useEditorStore.getState()

    if (candidates.length === 0) {
      store.selectBox(null, null)
      return
    }

    // 点击空白（事件冒泡到 Stage）：选择最高优先级候选
    store.selectBox(candidates[0].type, candidates[0].id)
  }

  // 鼠标按下：开始绘制（选择工具的点击在 Stage onClick 中处理）
  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === 'select') return
    if (tool === 'anchor') {
      // 图片对齐模式只允许直接拖拽当前精灵；Root (0,0) 始终固定。
      // 点击空白区域不改变轴点，避免意外导致图片跳动。
      return
    }

    // 绘制碰撞箱/发射点
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    if (tool === 'spawnpoint') {
      const [gx, gy] = toGame(pos.x, pos.y)
      const store = useEditorStore.getState()
      const id = store.addSpawnPoint({
        name: `point_${frame?.spawnPoints.length || 0}`,
        x: Math.round(gx),
        y: Math.round(gy),
      })
      // 创建后立即选中并切回选择工具，便于直接拖动或改名。
      store.selectBox('spawnpoint', id)
      store.setTool('select')
      return
    }

    // hurtbox / hitbox / pushbox: 开始拖拽拉选矩形
    isDrawing.current = true
    drawStart.current = pos
    setDrawPreview({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  // 鼠标移动：更新绘制预览
  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return

    const x = Math.min(pos.x, drawStart.current.x)
    const y = Math.min(pos.y, drawStart.current.y)
    const w = Math.abs(pos.x - drawStart.current.x)
    const h = Math.abs(pos.y - drawStart.current.y)
    setDrawPreview({ x, y, w, h })
  }

  // 鼠标松开：完成绘制
  const handleMouseUp = () => {
    if (!isDrawing.current || !drawPreview) {
      isDrawing.current = false
      setDrawPreview(null)
      return
    }
    isDrawing.current = false

    const { x, y, w, h } = drawPreview
    setDrawPreview(null)

    if (w < 4 || h < 4) return // 太小，忽略

    // 转换为逻辑坐标
    const [gx, gy] = toGame(x + w, y + h) // 右下角 → 逻辑坐标
    const gw = toGameSize(w)
    const gh = toGameSize(h)

    // Box 的 x,y 是左下角（逻辑坐标系中 y 向上）
    // 转换：左下角 x = gx - gw, y = gy
    const boxData = {
      x: Math.round(gx - gw),
      y: Math.round(gy),
      w: Math.round(gw),
      h: Math.round(gh),
    }

    const store = useEditorStore.getState()
    if (tool === 'hurtbox') {
      store.addBox('hurtbox', boxData)
    } else if (tool === 'hitbox') {
      store.addBox('hitbox', boxData)
    } else if (tool === 'jcbox') {
      store.addBox('jcbox', boxData)
    } else if (tool === 'pushbox') {
      store.setPushbox('stand', boxData)
      store.selectBox('pushbox', 'push_stand')
    }

    // 所有创建工具都在完成后自动切回选择模式，方便立即移动、缩放或编辑属性。
    store.setTool('select')
  }

  // 渲染碰撞箱
  function renderBox(
    box: Box,
    type: 'hurtbox' | 'hitbox' | 'jcbox',
    color: string,
    borderColor: string
  ) {
    const [sx, sy] = toScreen(box.x, box.y) // 左下角 → 屏幕
    const sw = toScreenSize(box.w)
    const sh = toScreenSize(box.h)
    const screenX = sx
    const screenY = sy - sh // Konva 的 y 是左上角

    const isSelected = selectedBoxId === box.id && selectedBoxType === type

    return (
      <Rect
        key={box.id}
        x={screenX}
        y={screenY}
        width={sw}
        height={sh}
        fill={color}
        stroke={borderColor}
        strokeWidth={isSelected ? 2 : 1}
        dash={isSelected ? [] : [4, 2]}
        // 所有框都可被点击选中；拖拽只允许已选中对象，避免误移动。
        listening={tool === 'select'}
        draggable={tool === 'select' && isSelected}
        onClick={(e) => { e.cancelBubble = true; useEditorStore.getState().selectBox(type, box.id) }}
        ref={isSelected ? (node) => { selectedNodeRef.current = node } : undefined}
        onDragStart={shiftDragStart}
        onDragMove={shiftDragMove}
        onDragEnd={(e) => {
          const newSx = e.target.x()
          const newSy = e.target.y() + sh
          const [gx, gy] = toGame(newSx, newSy)
          useEditorStore.getState().updateBox(type, box.id, {
            x: Math.round(gx),
            y: Math.round(gy),
          })
        }}
        onTransformEnd={() => {
          const node = selectedNodeRef.current
          if (!node) return
          const newW = toGameSize(node.width() * node.scaleX())
          const newH = toGameSize(node.height() * node.scaleY())
          // 位置可能也变了
          const newSx = node.x()
          const newSy = node.y() + newH * scale
          const [gx, gy] = toGame(newSx, newSy)
          useEditorStore.getState().updateBox(type, box.id, {
            x: Math.round(gx),
            y: Math.round(gy),
            w: Math.round(newW),
            h: Math.round(newH),
          })
          // 重置 scale（尺寸已写入 width/height）
          node.scaleX(1)
          node.scaleY(1)
        }}
      />
    )
  }

  // 渲染发射点
  function renderSpawnPoint(point: { id: string; name: string; x: number; y: number }) {
    const [sx, sy] = toScreen(point.x, point.y)
    const isSelected = selectedBoxId === point.id && selectedBoxType === 'spawnpoint'
    return (
      <Group key={point.id}>
        <Circle
          x={sx}
          y={sy}
          radius={6}
          fill={COLORS.spawnpoint}
          stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.5)'}
          strokeWidth={isSelected ? 2 : 1}
          listening={tool === 'select'}
          draggable={tool === 'select' && isSelected}
          onClick={(e) => { e.cancelBubble = true; useEditorStore.getState().selectBox('spawnpoint', point.id) }}
          onDragStart={shiftDragStart}
          onDragMove={shiftDragMove}
          onDragEnd={(e) => {
            const [gx, gy] = toGame(e.target.x(), e.target.y())
            useEditorStore.getState().updateSpawnPoint(point.id, {
              x: Math.round(gx),
              y: Math.round(gy),
            })
          }}
        />
        <Text
          x={sx + 10}
          y={sy - 8}
          text={point.name}
          fontSize={11}
          fill={COLORS.spawnpoint}
          listening={false}
        />
      </Group>
    )
  }

  // 渲染精灵图
  function renderSprite(
    img: HTMLImageElement | undefined,
    elem: typeof frame,
    opacity: number = 1,
    interactive: boolean = false
  ): React.ReactNode {
    if (!img || !elem) return null
    const x = originX - elem.offset.x * scale
    const y = originY - elem.offset.y * scale
    const canAlign = interactive && tool === 'anchor'

    return (
      <KonvaImage
        image={img}
        x={x}
        y={y}
        width={img.width * scale}
        height={img.height * scale}
        opacity={opacity}
        listening={canAlign}
        draggable={canAlign}
        onMouseEnter={(e) => {
          if (canAlign) e.target.getStage()?.container().style.setProperty('cursor', 'grab')
        }}
        onMouseLeave={(e) => {
          e.target.getStage()?.container().style.setProperty('cursor', 'default')
        }}
        onMouseDown={(e) => {
          // 防止 Stage 的空白画布事件接管本次拖拽。
          e.cancelBubble = true
        }}
        onDragStart={(e) => {
          e.target.getStage()?.container().style.setProperty('cursor', 'grabbing')
          // 记录拖拽起点，供 Shift 锁主轴向时计算偏移与约束
          dragStartPos.current = { x: e.target.x(), y: e.target.y() }
          lockedAxis.current = null
        }}
        onDragMove={(e) => {
          // Shift + 拖拽 = 锁定到主轴向（Figma 风格）：以移动量较大的轴为约束方向，
          // 松开 Shift 恢复自由拖拽。锁定一旦确定，本次拖拽内保持，避免对角线附近抖动。
          const start = dragStartPos.current
          if (!start) return
          const container = e.target.getStage()?.container()
          if (!e.evt.shiftKey) {
            if (lockedAxis.current !== null) {
              lockedAxis.current = null
              container?.style.setProperty('cursor', 'grabbing')
            }
            return
          }
          const dx = e.target.x() - start.x
          const dy = e.target.y() - start.y
          if (!lockedAxis.current) {
            // 需有可辨识位移才确定主轴，避免亚像素抖动误判
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
            // 横向占优 → 锁水平（冻结 Y）；纵向占优 → 锁垂直（冻结 X）
            lockedAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
            container?.style.setProperty(
              'cursor',
              lockedAxis.current === 'x' ? 'ew-resize' : 'ns-resize'
            )
          }
          if (lockedAxis.current === 'x') {
            e.target.y(start.y) // 冻结垂直，只允许水平移动
          } else {
            e.target.x(start.x) // 冻结水平，只允许垂直移动
          }
        }}
        onDragEnd={(e) => {
          e.target.getStage()?.container().style.setProperty('cursor', 'grab')
          // 直接拖动图片；反向换算为图片内部的 Sprite Pivot。
          const pivotX = (originX - e.target.x()) / scale
          const pivotY = (originY - e.target.y()) / scale
          useEditorStore.getState().setOffset(
            currentFrameIndex,
            Math.round(pivotX),
            Math.round(pivotY)
          )
        }}
      />
    )
  }

  // 渲染洋葱皮帧（精灵图 + 碰撞箱边框）
  function renderOnionSkinFrame(
    elem: typeof frame,
    opacity: number,
    color: string
  ): React.ReactNode {
    if (!elem) return null
    const nodes: React.ReactNode[] = []

    // 精灵图：先画原图，再叠一个设定颜色的半透明矩形做整体着色
    if (onionSkin.showSprite && elem.sprite.data) {
      const img = getSprite(elem.sprite.data)
      if (img) {
        const x = originX - elem.offset.x * scale
        const y = originY - elem.offset.y * scale
        const w = img.width * scale
        const h = img.height * scale
        nodes.push(
          <Group key="sprite-group" opacity={opacity} listening={false}>
            <KonvaImage
              key="sprite-img"
              image={img}
              x={x}
              y={y}
              width={w}
              height={h}
            />
            {/* 用 source-atop 混合模式叠色：只影响不透明像素 */}
            <Rect
              key="sprite-tint"
              x={x}
              y={y}
              width={w}
              height={h}
              fill={color}
              globalCompositeOperation="source-atop"
            />
          </Group>
        )
      }
    }

    // 碰撞箱边框（用设定颜色）
    if (onionSkin.showBoxes) {
      const allBoxes: Box[] = [
        ...elem.hurtboxes,
        ...elem.hitboxes,
        ...elem.jcboxes,
      ]
      allBoxes.forEach((box, i) => {
        const [sx, sy] = toScreen(box.x, box.y)
        const sw = toScreenSize(box.w)
        const sh = toScreenSize(box.h)
        nodes.push(
          <Rect
            key={`box-${i}`}
            x={sx}
            y={sy - sh}
            width={sw}
            height={sh}
            stroke={color}
            strokeWidth={1.5}
            opacity={opacity}
            listening={false}
          />
        )
      })

      // 发射点
      elem.spawnPoints.forEach((point, i) => {
        const [sx, sy] = toScreen(point.x, point.y)
        nodes.push(
          <Circle
            key={`spawn-${i}`}
            x={sx}
            y={sy}
            radius={4}
            stroke={color}
            strokeWidth={1.5}
            opacity={opacity}
            listening={false}
          />
        )
      })
    }

    return nodes.length > 0 ? <Group key={elem.index}>{nodes}</Group> : null
  }

  // 计算洋葱皮帧列表
  const onionPrevFrames = useMemo(() => {
    if (!showLayers.onionSkin || !frame) return []
    const result: { elem: typeof frame; opacity: number; color: string }[] = []
    for (let d = onionSkin.prevFrames; d >= 1; d--) {
      const idx = currentFrameIndex - d
      if (idx < 0) continue
      const elem = animation.elements[idx]
      if (!elem) continue
      const opacity = onionSkin.baseOpacity * Math.pow(onionSkin.decayRate, d - 1)
      result.push({ elem, opacity, color: onionSkin.prevColor })
    }
    return result
  }, [showLayers.onionSkin, frame, onionSkin, currentFrameIndex, animation.elements])

  const onionNextFrames = useMemo(() => {
    if (!showLayers.onionSkin || !frame) return []
    const result: { elem: typeof frame; opacity: number; color: string }[] = []
    for (let d = 1; d <= onionSkin.nextFrames; d++) {
      const idx = currentFrameIndex + d
      if (idx >= animation.elements.length) continue
      const elem = animation.elements[idx]
      if (!elem) continue
      const opacity = onionSkin.baseOpacity * Math.pow(onionSkin.decayRate, d - 1)
      result.push({ elem, opacity, color: onionSkin.nextColor })
    }
    return result
  }, [showLayers.onionSkin, frame, onionSkin, currentFrameIndex, animation.elements])

  // 渲染图片局部原点：固定为图片左上角 Image (0,0)，不可编辑。
  // 精灵轴点是图片内部坐标，经过对齐后始终与角色 Root (0,0) 重合，因此不单独画第二个标记。
  function renderImageOrigin() {
    if (!frame) return null
    const x = originX - frame.offset.x * scale
    const y = originY - frame.offset.y * scale
    return (
      <Group listening={false}>
        <Line points={[x - 12, y, x + 12, y]} stroke={COLORS.anchor} strokeWidth={2} />
        <Line points={[x, y - 12, x, y + 12]} stroke={COLORS.anchor} strokeWidth={2} />
        <Circle x={x} y={y} radius={3} fill={COLORS.anchor} />
        <Text x={x + 8} y={y - 20} text="Image (0,0)" fontSize={10} fill={COLORS.anchor} />
      </Group>
    )
  }

  function renderRootOrigin() {
    return (
      <Group listening={false}>
        {/* 固定角色坐标轴：水平线即地面 / X 轴，垂直线即 Root 的 Y 轴。 */}
        <Line points={[0, originY, canvasWidth, originY]} stroke={COLORS.origin} strokeWidth={1.5} opacity={0.8} />
        <Line points={[originX, 0, originX, canvasHeight]} stroke={COLORS.origin} strokeWidth={1.5} opacity={0.8} />
        <Circle x={originX} y={originY} radius={4} fill={COLORS.origin} />
        <Text x={8} y={originY - 16} text="Ground / X axis (Y=0)" fontSize={10} fill={COLORS.origin} />
        <Text x={originX + 8} y={originY + 4} text="Root (0,0)" fontSize={10} fill={COLORS.origin} />
      </Group>
    )
  }

  // 网格
  const gridLines = useMemo(() => {
    if (!showLayers.grid) return null
    const lines: React.ReactNode[] = []
    const gridSize = 20 * scale
    // 垂直线
    for (let x = originX % gridSize; x < canvasWidth; x += gridSize) {
      lines.push(
        <Line key={`v${x}`} points={[x, 0, x, canvasHeight]} stroke={COLORS.grid} strokeWidth={1} listening={false} />
      )
    }
    // 水平线
    for (let y = originY % gridSize; y < canvasHeight; y += gridSize) {
      lines.push(
        <Line key={`h${y}`} points={[0, y, canvasWidth, y]} stroke={COLORS.grid} strokeWidth={1} listening={false} />
      )
    }
    return lines
  }, [showLayers.grid, originX, originY, canvasWidth, canvasHeight, scale])

  if (!frame) {
    return (
      <Stage width={canvasWidth} height={canvasHeight}>
        <Layer>
          {gridLines}
          {renderRootOrigin()}
        </Layer>
      </Stage>
    )
  }

  return (
    <Stage
      width={canvasWidth}
      height={canvasHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleStageClick}
    >
      {/* 网格层 */}
      <Layer>{gridLines}</Layer>

      {/* 洋葱皮 - 前帧（从远到近，蓝色，透明度递增） */}
      {showLayers.onionSkin && onionPrevFrames.map(({ elem, opacity, color }) => (
        <Layer key={`prev-${elem.index}`}>
          {renderOnionSkinFrame(elem, opacity, color)}
        </Layer>
      ))}

      {/* 当前精灵：图片对齐模式下可直接拖拽，红色 Root (0,0) 始终固定 */}
      <Layer>
        {renderSprite(currentSprite, frame, 1, true)}
      </Layer>

      {/* 洋葱皮 - 后帧（从近到远，红色，透明度递减） */}
      {showLayers.onionSkin && onionNextFrames.map(({ elem, opacity, color }) => (
        <Layer key={`next-${elem.index}`}>
          {renderOnionSkinFrame(elem, opacity, color)}
        </Layer>
      ))}

      {/* 碰撞箱层：推挤框最先渲染（最底层），其次受击框，最后攻击框。
          全部在同一 Layer 中，Konva 按 zIndex/绘制顺序做命中检测，
          点到重叠区域时上层框先被命中；Alt+点击由 Stage onClick 循环。 */}
      <Layer>
        {/* 推挤框（最底层） */}
        {showLayers.pushbox && animation.pushbox.stand && (
          (() => {
            const pb = animation.pushbox.stand
            const [sx, sy] = toScreen(pb.x, pb.y)
            const sw = toScreenSize(pb.w)
            const sh = toScreenSize(pb.h)
            const isSelected = selectedBoxId === pb.id && selectedBoxType === 'pushbox'
            return (
              <Rect
                x={sx}
                y={sy - sh}
                width={sw}
                height={sh}
                fill={COLORS.pushbox}
                stroke={COLORS.pushboxBorder}
                strokeWidth={isSelected ? 2 : 1}
                dash={isSelected ? [] : [6, 3]}
                listening={tool === 'select'}
                draggable={tool === 'select' && isSelected}
                onClick={(e) => { e.cancelBubble = true; useEditorStore.getState().selectBox('pushbox', pb.id) }}
                ref={isSelected ? (node) => { selectedNodeRef.current = node } : undefined}
                onDragStart={shiftDragStart}
                onDragMove={shiftDragMove}
                onDragEnd={(e) => {
                  const [gx, gy] = toGame(e.target.x(), e.target.y() + sh)
                  useEditorStore.getState().updatePushbox('stand', {
                    x: Math.round(gx),
                    y: Math.round(gy),
                  })
                }}
                onTransformEnd={() => {
                  const node = selectedNodeRef.current
                  if (!node) return
                  const newW = toGameSize(node.width() * node.scaleX())
                  const newH = toGameSize(node.height() * node.scaleY())
                  const [gx, gy] = toGame(node.x(), node.y() + newH * scale)
                  useEditorStore.getState().updatePushbox('stand', {
                    x: Math.round(gx),
                    y: Math.round(gy),
                    w: Math.round(newW),
                    h: Math.round(newH),
                  })
                  node.scaleX(1)
                  node.scaleY(1)
                }}
              />
            )
          })()
        )}

        {/* 受击框 */}
        {showLayers.hurtbox && frame.hurtboxes.map((box) =>
          renderBox(box, 'hurtbox', COLORS.hurtbox, COLORS.hurtboxBorder)
        )}
        {/* 攻击框 */}
        {showLayers.hitbox && frame.hitboxes.map((box) =>
          renderBox(box, 'hitbox', COLORS.hitbox, COLORS.hitboxBorder)
        )}
        {/* JC框 */}
        {showLayers.jcbox && frame.jcboxes.map((box) =>
          renderBox(box, 'jcbox', COLORS.jcbox, COLORS.jcboxBorder)
        )}
        {/* 绘制预览 */}
        {drawPreview && (
          <Rect
            x={drawPreview.x}
            y={drawPreview.y}
            width={drawPreview.w}
            height={drawPreview.h}
            fill={tool === 'hurtbox' ? COLORS.hurtbox : tool === 'hitbox' ? COLORS.hitbox : tool === 'jcbox' ? COLORS.jcbox : COLORS.pushbox}
            stroke={tool === 'hurtbox' ? COLORS.hurtboxBorder : tool === 'hitbox' ? COLORS.hitboxBorder : tool === 'jcbox' ? COLORS.jcboxBorder : COLORS.pushboxBorder}
            strokeWidth={1}
            dash={[4, 2]}
            listening={false}
          />
        )}
        {/* Transformer */}
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          keepRatio={false}
          borderStroke="#4a9eff"
          anchorStroke="#4a9eff"
          anchorFill="#fff"
          anchorSize={6}
        />
      </Layer>

      {/* 发射点层 */}
      {showLayers.spawnpoint && (
        <Layer>
          {frame.spawnPoints.map((p) => renderSpawnPoint(p))}
        </Layer>
      )}

      {/* 坐标参考层（最顶层）：黄色是图片局部原点，红色是固定角色根点 */}
      <Layer>
        {renderImageOrigin()}
        {renderRootOrigin()}
      </Layer>
    </Stage>
  )
}
