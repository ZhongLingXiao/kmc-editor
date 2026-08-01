import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Image as ImageIcon, LayoutGrid } from 'lucide-react'

/** 切分后的单个区域（sheet 内像素坐标） */
export interface SpriteRegion {
  x: number
  y: number
  w: number
  h: number
}

/** SpriteSheetDialog 的确认结果 */
export interface SpriteSheetResult {
  mode: 'single' | 'grid'
  regions: SpriteRegion[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 待导入的图片文件；为 null 时不渲染内容 */
  file: File | null
  /** 确认回调，返回切分结果 */
  onConfirm: (result: SpriteSheetResult) => void | Promise<void>
  onCancel?: () => void
}

export default function SpriteSheetDialog({ open, onOpenChange, file, onConfirm, onCancel }: Props) {
  const [imgUrl, setImgUrl] = useState('')
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [mode, setMode] = useState<'single' | 'grid'>('single')
  const [cols, setCols] = useState(2)
  const [rows, setRows] = useState(1)

  // 读取图片预览 + 自然尺寸
  useEffect(() => {
    if (!open || !file) {
      setImgUrl('')
      setImgSize(null)
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [open, file])

  // 重置状态
  useEffect(() => {
    if (open) {
      setMode('single')
      setCols(2)
      setRows(1)
    }
  }, [open])

  const regions = useMemo<SpriteRegion[]>(() => {
    if (!imgSize) return []
    if (mode === 'single') return [{ x: 0, y: 0, w: imgSize.w, h: imgSize.h }]
    const fw = Math.floor(imgSize.w / cols)
    const fh = Math.floor(imgSize.h / rows)
    if (fw <= 0 || fh <= 0) return []
    const list: SpriteRegion[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({ x: c * fw, y: r * fh, w: fw, h: fh })
      }
    }
    return list
  }, [imgSize, mode, cols, rows])

  const frameW = imgSize && mode === 'grid' ? Math.floor(imgSize.w / cols) : imgSize?.w ?? 0
  const frameH = imgSize && mode === 'grid' ? Math.floor(imgSize.h / rows) : imgSize?.h ?? 0

  const handleConfirm = async () => {
    if (!imgSize || regions.length === 0) return
    await onConfirm({ mode, regions })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && onCancel) onCancel()
      onOpenChange(v)
    }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>导入精灵图</DialogTitle>
          <DialogDescription>
            选择单帧导入整图，或多帧切分将一张图按网格切成多帧。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {/* 模式选择 */}
          <div className="flex flex-col gap-1.5">
            <Label>导入模式</Label>
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as 'single' | 'grid')}>
              <ToggleGroupItem value="single" aria-label="单帧">
                <ImageIcon className="size-4 mr-1.5" />
                单帧（整图作为一帧）
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="多帧切分">
                <LayoutGrid className="size-4 mr-1.5" />
                多帧切分（网格）
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* 预览图 + 网格线 */}
          {imgUrl && (
            <div className="flex justify-center rounded-md border bg-muted/30 p-2">
              <div className="relative inline-block">
                <img
                  src={imgUrl}
                  alt="预览"
                  className="block max-w-full max-h-[50vh] w-auto h-auto"
                />
                {mode === 'grid' && imgSize && cols > 0 && rows > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: cols - 1 }, (_, i) => (
                      <div
                        key={`v${i}`}
                        className="absolute top-0 bottom-0 border-l border-primary/70"
                        style={{ left: `${((i + 1) / cols) * 100}%` }}
                      />
                    ))}
                    {Array.from({ length: rows - 1 }, (_, i) => (
                      <div
                        key={`h${i}`}
                        className="absolute left-0 right-0 border-t border-primary/70"
                        style={{ top: `${((i + 1) / rows) * 100}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 多帧参数 */}
          {mode === 'grid' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ss-cols">列数</Label>
                  <Input
                    id="ss-cols"
                    type="number"
                    min={1}
                    max={64}
                    value={cols}
                    onChange={(e) => setCols(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ss-rows">行数</Label>
                  <Input
                    id="ss-rows"
                    type="number"
                    min={1}
                    max={64}
                    value={rows}
                    onChange={(e) => setRows(Math.max(1, Math.min(64, Number(e.target.value) || 1)))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                帧尺寸 <span className="font-mono">{frameW}×{frameH}</span>，将生成{' '}
                <span className="font-medium text-foreground">{regions.length}</span> 帧
                {imgSize && (frameW * cols < imgSize.w || frameH * rows < imgSize.h) && (
                  <span className="text-amber-600">（整除有余，右侧/下侧余数像素将被裁掉）</span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            if (onCancel) onCancel()
            onOpenChange(false)
          }}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!imgSize || regions.length === 0}>
            {mode === 'single' ? '导入' : `导入 ${regions.length} 帧`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
