import { useEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { FlipHorizontal, Grid3x3, Layers, Palette, SquareStack } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { toGame } from '../../utils/coordinate'
import { COLORS, type ShowLayers } from '../../types/animation'
import { cn } from '@/lib/utils'

type Facing = 'right' | 'left'

const PREV_COLORS = [
  { labelKey: 'preview.colorBlue', val: '#0096ff' },
  { labelKey: 'preview.colorCyan', val: '#00ffcc' },
  { labelKey: 'preview.colorGreen', val: '#22ff22' },
  { labelKey: 'preview.colorPurple', val: '#aa00ff' },
]
const NEXT_COLORS = [
  { labelKey: 'preview.colorRed', val: '#ff5050' },
  { labelKey: 'preview.colorOrange', val: '#ff8800' },
  { labelKey: 'preview.colorYellow', val: '#ffdd00' },
  { labelKey: 'preview.colorPink', val: '#ff00aa' },
]

// 碰撞框/发射点类型：用于整体开关与右键逐类选择
const BOX_KEYS: (keyof ShowLayers)[] = ['hurtbox', 'hitbox', 'jcbox', 'pushbox', 'spawnpoint']
const BOX_GROUPS: { key: keyof ShowLayers; labelKey: string; color: string }[] = [
  { key: 'hurtbox', labelKey: 'tool.hurtbox', color: COLORS.hurtboxBorder },
  { key: 'hitbox', labelKey: 'tool.hitbox', color: COLORS.hitboxBorder },
  { key: 'jcbox', labelKey: 'tool.jcbox', color: COLORS.jcboxBorder },
  { key: 'pushbox', labelKey: 'tool.pushbox', color: COLORS.pushboxBorder },
  { key: 'spawnpoint', labelKey: 'tool.spawnpoint', color: COLORS.spawnpoint },
]

const GRID_PRESETS = [8, 16, 20, 32, 64]

// 画布背景色预设：null = 跟随主题（bg-muted）
const BG_PRESETS: { labelKey: string; val: string | null }[] = [
  { labelKey: 'preview.bgDefault', val: null },
  { labelKey: 'preview.bgWhite', val: '#ffffff' },
  { labelKey: 'preview.bgLight', val: '#c8c8c8' },
  { labelKey: 'preview.bgGray', val: '#6e6e6e' },
  { labelKey: 'preview.bgDark', val: '#2a2a2a' },
  { labelKey: 'preview.bgBlack', val: '#000000' },
]

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-14 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/**
 * 画布预览工具架（左上角浮层）。
 * - 朝向预览：local state（不进 store），翻转时画布只读
 * - 网格：左键开关，右键设尺寸
 * - 碰撞框：左键全开/全关，右键逐类选择
 * - 洋葱皮：左键开关，右键设参数
 * - 光标坐标读数：监听画布容器 mousemove，转逻辑坐标显示
 *
 * Popover 锚点用 <span> 包裹 Tooltip+Button，避免 Popover.Anchor 与
 * Tooltip.Trigger 两个 asChild 抢同一个 DOM ref。
 */
export default function PreviewShelf({
  facing,
  onFacingChange,
  containerRef,
}: {
  facing: Facing
  onFacingChange: (f: Facing) => void
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation()
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const setLayers = useEditorStore((s) => s.setLayers)
  const onionSkin = useEditorStore((s) => s.onionSkin)
  const updateOnionSkin = useEditorStore((s) => s.updateOnionSkin)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const canvasBgColor = useEditorStore((s) => s.canvasBgColor)
  const setCanvasBgColor = useEditorStore((s) => s.setCanvasBgColor)
  const flipped = facing === 'left'

  const [coord, setCoord] = useState<{ x: number; y: number } | null>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const [boxesOpen, setBoxesOpen] = useState(false)
  const [onionOpen, setOnionOpen] = useState(false)
  const [bgOpen, setBgOpen] = useState(false)

  const allBoxesOn = BOX_KEYS.every((k) => showLayers[k])

  // 监听画布容器鼠标移动，实时换算逻辑坐标。容器是 Konva Stage 的父 div，
  // native mousemove 会穿透 Stage 冒泡上来，无需依赖 Konva 事件。
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) {
        setCoord(null)
        return
      }
      const [gx, gy] = toGame(sx, sy)
      setCoord({ x: Math.round(gx), y: Math.round(gy) })
    }
    const onLeave = () => setCoord(null)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [containerRef])

  return (
    <div
      className="absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-md border bg-card/80 p-1 shadow backdrop-blur-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 朝向预览 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(flipped && 'bg-accent text-accent-foreground')}
            onClick={() => onFacingChange(flipped ? 'right' : 'left')}
          >
            <FlipHorizontal />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('preview.facingLabel')}：{flipped ? t('preview.facingLeft') : t('preview.facingRight')}</TooltipContent>
      </Tooltip>

      {/* 网格：左键开关，右键设尺寸 */}
      <Popover open={gridOpen} onOpenChange={setGridOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(showLayers.grid && 'bg-accent text-accent-foreground')}
                  onClick={() => toggleLayer('grid')}
                  onContextMenu={(e) => { e.preventDefault(); setGridOpen(true) }}
                >
                  <Grid3x3 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('preview.grid', { size: gridSize })}</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-44" align="start">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">{t('preview.gridSize')}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={2}
                value={gridSize}
                onChange={(e) => setGridSize(Math.max(2, parseInt(e.target.value) || 2))}
                className="h-7 w-16"
              />
              <span className="text-xs text-muted-foreground">{t('preview.pxPerCell')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {GRID_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => setGridSize(s)}
                  className={cn(
                    'rounded border px-1.5 py-0.5 text-[11px]',
                    gridSize === s ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 碰撞框整体开关：左键全开/全关，右键逐类选择 */}
      <Popover open={boxesOpen} onOpenChange={setBoxesOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(allBoxesOn && 'bg-accent text-accent-foreground')}
                  onClick={() => setLayers(BOX_KEYS, !allBoxesOn)}
                  onContextMenu={(e) => { e.preventDefault(); setBoxesOpen(true) }}
                >
                  <SquareStack />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('preview.boxes')}</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-40" align="start">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t('preview.showTypes')}</span>
            {BOX_GROUPS.map(({ key, labelKey, color }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="size-2.5 rounded-sm" style={{ background: color }} />
                  {t(labelKey)}
                </span>
                <Switch checked={showLayers[key]} onCheckedChange={(v) => setLayers([key], v)} />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* 洋葱皮：左键开关，右键设参数 */}
      <Popover open={onionOpen} onOpenChange={setOnionOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(showLayers.onionSkin && 'bg-accent text-accent-foreground')}
                  onClick={() => toggleLayer('onionSkin')}
                  onContextMenu={(e) => { e.preventDefault(); setOnionOpen(true) }}
                >
                  <Layers />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('preview.onion')}</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-64" align="start">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium">{t('preview.onionSettings')}</span>
            <Row label={t('preview.prevFrames')}>
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.prevFrames}
                onChange={(e) => updateOnionSkin({ prevFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label={t('preview.nextFrames')}>
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.nextFrames}
                onChange={(e) => updateOnionSkin({ nextFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label={t('preview.opacity')}>
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.baseOpacity]} min={0.1} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ baseOpacity: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.baseOpacity * 100)}%</span>
              </div>
            </Row>
            <Row label={t('preview.decay')}>
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.decayRate]} min={0.2} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ decayRate: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.decayRate * 100)}%</span>
              </div>
            </Row>
            <Row label={t('preview.prevColor')}>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={onionSkin.prevColor.startsWith('rgba') ? '#0096ff' : onionSkin.prevColor}
                  onChange={(e) => updateOnionSkin({ prevColor: e.target.value })}
                  className="size-6 cursor-pointer rounded border bg-transparent"
                />
                {PREV_COLORS.map((c) => (
                  <button
                    key={c.val}
                    onClick={() => updateOnionSkin({ prevColor: c.val })}
                    className="size-5 rounded border"
                    style={{ background: c.val, borderColor: onionSkin.prevColor === c.val ? '#000' : 'var(--border)' }}
                    title={t(c.labelKey)}
                  />
                ))}
              </div>
            </Row>
            <Row label={t('preview.nextColor')}>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={onionSkin.nextColor.startsWith('rgba') ? '#ff5050' : onionSkin.nextColor}
                  onChange={(e) => updateOnionSkin({ nextColor: e.target.value })}
                  className="size-6 cursor-pointer rounded border bg-transparent"
                />
                {NEXT_COLORS.map((c) => (
                  <button
                    key={c.val}
                    onClick={() => updateOnionSkin({ nextColor: c.val })}
                    className="size-5 rounded border"
                    style={{ background: c.val, borderColor: onionSkin.nextColor === c.val ? '#000' : 'var(--border)' }}
                    title={t(c.labelKey)}
                  />
                ))}
              </div>
            </Row>
            <Separator className="my-0.5" />
            <Row label={t('preview.sprite')}>
              <Switch checked={onionSkin.showSprite} onCheckedChange={(v) => updateOnionSkin({ showSprite: v })} />
            </Row>
            <Row label={t('preview.boxesLabel')}>
              <Switch checked={onionSkin.showBoxes} onCheckedChange={(v) => updateOnionSkin({ showBoxes: v })} />
            </Row>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 !h-6 !bg-muted-foreground/40" />

      {/* 画布背景色：预设色板 + 自定义 */}
      <Popover open={bgOpen} onOpenChange={setBgOpen}>
        <PopoverAnchor asChild>
          <span className="inline-flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setBgOpen(true)}>
                  <Palette />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('preview.bgColor')}</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-44" align="start">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">{t('preview.bgColor')}</span>
            <div className="flex flex-wrap gap-1.5">
              {BG_PRESETS.map((c) => (
                <Tooltip key={c.labelKey}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setCanvasBgColor(c.val)}
                      className={cn(
                        'size-6 rounded border',
                        canvasBgColor === c.val ? 'border-primary ring-1 ring-primary' : 'border-border',
                        c.val === null && 'border-dashed bg-muted'
                      )}
                      style={c.val ? { background: c.val } : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{t(c.labelKey)}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Separator className="my-0.5" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('preview.bgCustom')}</span>
              <input
                type="color"
                value={canvasBgColor ?? '#808080'}
                onChange={(e) => setCanvasBgColor(e.target.value)}
                className="size-6 cursor-pointer rounded border bg-transparent"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 光标逻辑坐标读数：pointer-events-none 让鼠标事件穿透回画布容器，避免悬停读数区时坐标冻结 */}
      <div className="pointer-events-none flex h-7 min-w-[104px] items-center px-1.5 font-mono text-[11px] text-muted-foreground">
        {coord ? `x:${coord.x}  y:${coord.y}` : 'x:—  y:—'}
      </div>
    </div>
  )
}
