import { useEffect, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { FlipHorizontal, Grid3x3, Layers, SquareStack } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { toGame } from '../../utils/coordinate'
import { COLORS, type ShowLayers } from '../../types/animation'
import { cn } from '@/lib/utils'

type Facing = 'right' | 'left'

const PREV_COLORS = [
  { label: '蓝', val: '#0096ff' },
  { label: '青', val: '#00ffcc' },
  { label: '绿', val: '#22ff22' },
  { label: '紫', val: '#aa00ff' },
]
const NEXT_COLORS = [
  { label: '红', val: '#ff5050' },
  { label: '橙', val: '#ff8800' },
  { label: '黄', val: '#ffdd00' },
  { label: '粉', val: '#ff00aa' },
]

// 碰撞框/发射点类型：用于整体开关与右键逐类选择
const BOX_KEYS: (keyof ShowLayers)[] = ['hurtbox', 'hitbox', 'jcbox', 'pushbox', 'spawnpoint']
const BOX_GROUPS: { key: keyof ShowLayers; label: string; color: string }[] = [
  { key: 'hurtbox', label: '受击框', color: COLORS.hurtboxBorder },
  { key: 'hitbox', label: '攻击框', color: COLORS.hitboxBorder },
  { key: 'jcbox', label: 'JC框', color: COLORS.jcboxBorder },
  { key: 'pushbox', label: '推挤框', color: COLORS.pushboxBorder },
  { key: 'spawnpoint', label: '发射点', color: COLORS.spawnpoint },
]

const GRID_PRESETS = [8, 16, 20, 32, 64]

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
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const setLayers = useEditorStore((s) => s.setLayers)
  const onionSkin = useEditorStore((s) => s.onionSkin)
  const updateOnionSkin = useEditorStore((s) => s.updateOnionSkin)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const flipped = facing === 'left'

  const [coord, setCoord] = useState<{ x: number; y: number } | null>(null)
  const [gridOpen, setGridOpen] = useState(false)
  const [boxesOpen, setBoxesOpen] = useState(false)
  const [onionOpen, setOnionOpen] = useState(false)

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
        <TooltipContent>朝向预览：{flipped ? '左（点击恢复右）' : '右（点击切换左）'}</TooltipContent>
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
              <TooltipContent>网格 {gridSize}px（左键开关 · 右键尺寸）</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-44" align="start">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium">网格尺寸</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={2}
                value={gridSize}
                onChange={(e) => setGridSize(Math.max(2, parseInt(e.target.value) || 2))}
                className="h-7 w-16"
              />
              <span className="text-xs text-muted-foreground">px/格</span>
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
              <TooltipContent>碰撞框（左键全开关 · 右键逐类）</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-40" align="start">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">显隐类型</span>
            {BOX_GROUPS.map(({ key, label, color }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="size-2.5 rounded-sm" style={{ background: color }} />
                  {label}
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
              <TooltipContent>洋葱皮（左键开关 · 右键设置）</TooltipContent>
            </Tooltip>
          </span>
        </PopoverAnchor>
        <PopoverContent className="w-64" align="start">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-medium">洋葱皮设置</span>
            <Row label="前帧">
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.prevFrames}
                onChange={(e) => updateOnionSkin({ prevFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label="后帧">
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.nextFrames}
                onChange={(e) => updateOnionSkin({ nextFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label="透明度">
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.baseOpacity]} min={0.1} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ baseOpacity: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.baseOpacity * 100)}%</span>
              </div>
            </Row>
            <Row label="衰减率">
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.decayRate]} min={0.2} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ decayRate: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.decayRate * 100)}%</span>
              </div>
            </Row>
            <Row label="前帧色">
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
                    title={c.label}
                  />
                ))}
              </div>
            </Row>
            <Row label="后帧色">
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
                    title={c.label}
                  />
                ))}
              </div>
            </Row>
            <Separator className="my-0.5" />
            <Row label="精灵图">
              <Switch checked={onionSkin.showSprite} onCheckedChange={(v) => updateOnionSkin({ showSprite: v })} />
            </Row>
            <Row label="碰撞框">
              <Switch checked={onionSkin.showBoxes} onCheckedChange={(v) => updateOnionSkin({ showBoxes: v })} />
            </Row>
          </div>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* 光标逻辑坐标读数：pointer-events-none 让鼠标事件穿透回画布容器，避免悬停读数区时坐标冻结 */}
      <div className="pointer-events-none flex h-7 min-w-[104px] items-center px-1.5 font-mono text-[11px] text-muted-foreground">
        {coord ? `x:${coord.x}  y:${coord.y}` : 'x:—  y:—'}
      </div>
    </div>
  )
}
