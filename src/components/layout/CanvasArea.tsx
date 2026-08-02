import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import EditorCanvas from '../canvas/EditorCanvas'
import ShortcutsOverlay from './ShortcutsOverlay'
import PreviewShelf from './PreviewShelf'
import NewAnimationDialog from './NewAnimationDialog'
import SpriteSheetDialog, { type SpriteSheetResult } from './SpriteSheetDialog'
import { Badge } from '@/components/ui/badge'
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
import { spaceState } from '../../lib/space-pan'
import { importImageToProject, importSpritesBatch } from '../../lib/image'
import { MousePointer2, Move, Square, Swords, Diamond, Box, Crosshair } from 'lucide-react'
import { toast } from 'sonner'

export default function CanvasArea() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const setCanvasSize = useEditorStore((s) => s.setCanvasSize)
  const scale = useEditorStore((s) => s.scale)
  const setScale = useEditorStore((s) => s.setScale)
  const setPan = useEditorStore((s) => s.setPan)
  const resetView = useEditorStore((s) => s.resetView)
  const panX = useEditorStore((s) => s.panX)
  const panY = useEditorStore((s) => s.panY)
  const setTool = useEditorStore((s) => s.setTool)
  const setOffset = useEditorStore((s) => s.setOffset)
  const addFrame = useEditorStore((s) => s.addFrame)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const animation = useEditorStore((s) => s.animation)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const canvasBgColor = useEditorStore((s) => s.canvasBgColor)

  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [facing, setFacing] = useState<'right' | 'left'>('right')

  // 拖图到空场景时暂存待导入的文件，创建动画后导入
  const [pendingDropFiles, setPendingDropFiles] = useState<File[]>([])
  const [newAnimOpen, setNewAnimOpen] = useState(false)
  // 精灵图切分对话框
  const [spriteDialogFile, setSpriteDialogFile] = useState<File | null>(null)
  const [spriteDialogOpen, setSpriteDialogOpen] = useState(false)

  // 自适应画布大小
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setCanvasSize(rect.width, rect.height)
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setCanvasSize])

  // 跟踪空格按下（用于显示抓取光标）
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(true)
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(scale + delta * scale)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // 中键 或 按住空格 → 平移
    if (e.button === 1 || spaceState.held) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX, panY }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    if (spaceState.held) spaceState.panned = true
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan(panStart.current.panX + dx, panStart.current.panY + dy)
  }

  const handleMouseUp = () => {
    if (isPanning) setIsPanning(false)
  }

  // 决定第一帧索引：当前帧无图则复用当前帧，否则新建帧
  const acquireFirstFrameIndex = (): number => {
    const store = useEditorStore.getState()
    const cur = store.currentFrameIndex
    const curFrame = cur >= 0 ? store.animation.elements[cur] : null
    if (curFrame && curFrame.sprite.w === 0) return cur
    const lastIdx = store.animation.elements.length - 1
    addFrame(lastIdx)
    return useEditorStore.getState().currentFrameIndex
  }

  // 追加一帧到末尾并导入，返回新帧索引
  const appendFrameAndLoad = (src: string, x: number, y: number, w: number, h: number) => {
    const lastIdx = useEditorStore.getState().animation.elements.length - 1
    addFrame(lastIdx)
    const newIdx = useEditorStore.getState().currentFrameIndex
    useEditorStore.getState().loadSprite(newIdx, src, x, y, w, h)
  }

  // 批量导入多张图（每张一帧）：第一帧复用当前空帧或新建，其余追加末尾
  const importBatchToFrames = async (files: File[]) => {
    try {
      const results = await importSpritesBatch(files)
      if (results.length === 0) return
      const firstIdx = acquireFirstFrameIndex()
      const first = results[0]
      useEditorStore.getState().loadSprite(firstIdx, first.src, 0, 0, first.w, first.h)
      for (let k = 1; k < results.length; k++) {
        appendFrameAndLoad(results[k].src, 0, 0, results[k].w, results[k].h)
      }
      toast.success(t('toast.importedN', { count: results.length }))
    } catch (err) {
      toast.error((err as Error).message || t('toast.loadFailed'))
    }
  }

  // 拖拽图片到画布：没有动画在编辑 → 弹窗创建动画；单张 → 切分对话框；多张 → 批量导入
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const imgs = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    // 没有动画在编辑时提示并弹新建对话框（跨 session 重开后 currentAnimId 为 null）
    if (!useProjectStore.getState().currentAnimId) {
      toast.info(t('toast.needOpenAnim'))
      setPendingDropFiles(imgs)
      setNewAnimOpen(true)
      return
    }
    if (imgs.length === 1) {
      setSpriteDialogFile(imgs[0])
      setSpriteDialogOpen(true)
    } else {
      await importBatchToFrames(imgs)
    }
  }

  // 拖图触发的创建动画确认：创建动画后导入暂存的图片
  const handlePendingDropConfirm = async (name: string) => {
    await useProjectStore.getState().createAnimation(name)
      toast.success(t('toast.createdAnim', { name }))
    const files = pendingDropFiles
    setPendingDropFiles([])
    if (files.length === 0) return
    // 新建动画无帧，先创建第一帧再导入
    if (useEditorStore.getState().currentFrameIndex < 0) addFrame(-1)
    if (files.length === 1) {
      setSpriteDialogFile(files[0])
      setSpriteDialogOpen(true)
    } else {
      await importBatchToFrames(files)
    }
  }

  // SpriteSheetDialog 确认：单帧导入当前帧/新建帧；多帧第一帧同上，其余追加末尾
  const handleSpriteConfirm = async (result: SpriteSheetResult) => {
    const file = spriteDialogFile
    if (!file) return
    try {
      const info = await importImageToProject(file)
      const regions = result.regions
      const firstIdx = acquireFirstFrameIndex()
      const first = regions[0]
      useEditorStore.getState().loadSprite(firstIdx, info.src, first.x, first.y, first.w, first.h)
      for (let i = 1; i < regions.length; i++) {
        appendFrameAndLoad(info.src, regions[i].x, regions[i].y, regions[i].w, regions[i].h)
      }
      toast.success(result.mode === 'single' ? t('toast.imported') : t('toast.importedN', { count: regions.length }))
    } catch (err) {
      toast.error((err as Error).message || t('toast.loadFailed'))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null

  const cursor = isPanning ? 'grabbing' : spaceHeld ? 'grab' : 'default'

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-muted" style={canvasBgColor ? { backgroundColor: canvasBgColor } : undefined}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={containerRef}
            className="relative flex flex-1 items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={() => resetView()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{ cursor }}
          >
            <EditorCanvas facing={facing} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('canvas.tools')}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => setTool('select')}>
                <MousePointer2 /> {t('tool.select')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('anchor')}>
                <Move /> {t('tool.anchor')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setTool('hurtbox')}>
                <Square /> {t('tool.hurtbox')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('hitbox')}>
                <Swords /> {t('tool.hitbox')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('jcbox')}>
                <Diamond /> {t('tool.jcbox')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('pushbox')}>
                <Box /> {t('tool.pushbox')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setTool('spawnpoint')}>
                <Crosshair /> {t('tool.spawnpoint')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          {frame && frame.sprite.w > 0 && (
            <>
              <ContextMenuItem onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), frame.sprite.h)}>
                {t('canvas.footCenter')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), Math.round(frame.sprite.h / 2))}>
                {t('canvas.imageCenter')}
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => addFrame()}>{t('canvas.newFrame')}</ContextMenuItem>
          <ContextMenuItem onClick={() => resetView()}>{t('canvas.resetView')}</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>{t('canvas.layers')}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => toggleLayer('grid')}>
                {showLayers.grid ? '✓ ' : ''}{t('canvas.grid')}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => toggleLayer('onionSkin')}>
                {showLayers.onionSkin ? '✓ ' : ''}{t('canvas.onion')}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>

      <PreviewShelf facing={facing} onFacingChange={setFacing} containerRef={containerRef} />
      <ShortcutsOverlay />

      <Badge variant="secondary" className="pointer-events-none absolute bottom-2 right-3 font-normal">
        {t('canvas.scale')} {Math.round(scale * 100)}%
      </Badge>

      <NewAnimationDialog
        open={newAnimOpen}
        onOpenChange={setNewAnimOpen}
        onConfirm={handlePendingDropConfirm}
        onCancel={() => setPendingDropFiles([])}
      />
      <SpriteSheetDialog
        open={spriteDialogOpen}
        onOpenChange={setSpriteDialogOpen}
        file={spriteDialogFile}
        onConfirm={handleSpriteConfirm}
      />
    </div>
  )
}
