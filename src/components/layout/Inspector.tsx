import { useEditorStore } from '../../store/editorStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, Footprints, AlignCenter } from 'lucide-react'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-12 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="h-7"
    />
  )
}

function GroupLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex w-fit cursor-help items-center gap-1 text-xs font-medium text-muted-foreground">
          {children}
          <Info className="size-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px]">{hint}</TooltipContent>
    </Tooltip>
  )
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-muted-foreground" title={typeof value === 'string' ? value : undefined}>{value}</span>
    </div>
  )
}

export default function Inspector() {
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const selectedBoxId = useEditorStore((s) => s.selectedBoxId)
  const selectedBoxType = useEditorStore((s) => s.selectedBoxType)
  const updateBox = useEditorStore((s) => s.updateBox)
  const updatePushbox = useEditorStore((s) => s.updatePushbox)
  const updateSpawnPoint = useEditorStore((s) => s.updateSpawnPoint)
  const updateFrame = useEditorStore((s) => s.updateFrame)
  const setOffset = useEditorStore((s) => s.setOffset)

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null

  const selected =
    selectedBoxId && selectedBoxType
      ? (() => {
          if (!frame) return null
          if (selectedBoxType === 'hurtbox') return { type: 'hurtbox' as const, data: frame.hurtboxes.find((b) => b.id === selectedBoxId) }
          if (selectedBoxType === 'hitbox') return { type: 'hitbox' as const, data: frame.hitboxes.find((b) => b.id === selectedBoxId) }
          if (selectedBoxType === 'jcbox') return { type: 'jcbox' as const, data: frame.jcboxes.find((b) => b.id === selectedBoxId) }
          if (selectedBoxType === 'pushbox') return { type: 'pushbox' as const, data: animation.pushbox.stand?.id === selectedBoxId ? animation.pushbox.stand : undefined }
          if (selectedBoxType === 'spawnpoint') return { type: 'spawnpoint' as const, data: frame.spawnPoints.find((p) => p.id === selectedBoxId) }
          return null
        })()
      : null

  let title = '检视器'
  if (selected?.data) {
    title = selected.type === 'hurtbox' ? '受击框' : selected.type === 'hitbox' ? '攻击框' : selected.type === 'jcbox' ? 'JC框' : selected.type === 'pushbox' ? '推挤框（站立）' : '发射点'
  } else if (frame) {
    title = `帧 ${currentFrameIndex}`
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      <Separator />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3">
        {/* 选中对象属性 */}
        {selected?.data && (selected.type === 'hurtbox' || selected.type === 'hitbox' || selected.type === 'jcbox') && (
          <>
            <Row label="X"><NumInput value={selected.data.x} onChange={(v) => updateBox(selected.type, selectedBoxId!, { x: v })} /></Row>
            <Row label="Y"><NumInput value={selected.data.y} onChange={(v) => updateBox(selected.type, selectedBoxId!, { y: v })} /></Row>
            <Row label="宽"><NumInput value={selected.data.w} onChange={(v) => updateBox(selected.type, selectedBoxId!, { w: v })} /></Row>
            <Row label="高"><NumInput value={selected.data.h} onChange={(v) => updateBox(selected.type, selectedBoxId!, { h: v })} /></Row>
          </>
        )}

        {selected?.type === 'pushbox' && selected.data && (
          <>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              推挤框是角色物理占位，坐标相对固定 Root (0,0)。可拖拽、缩放或直接输入数值。
            </p>
            {(['x', 'y', 'w', 'h'] as const).map((k) => (
              <Row key={k} label={{ x: 'X', y: 'Y', w: '宽', h: '高' }[k]}>
                <NumInput value={selected.data![k]} onChange={(v) => updatePushbox('stand', { [k]: v })} />
              </Row>
            ))}
          </>
        )}

        {selected?.type === 'spawnpoint' && selected.data && (
          <>
            <Row label="名称">
              <Input value={selected.data.name} onChange={(e) => updateSpawnPoint(selectedBoxId!, { name: e.target.value })} className="h-7" />
            </Row>
            <Row label="X"><NumInput value={selected.data.x} onChange={(v) => updateSpawnPoint(selectedBoxId!, { x: v })} /></Row>
            <Row label="Y"><NumInput value={selected.data.y} onChange={(v) => updateSpawnPoint(selectedBoxId!, { y: v })} /></Row>
          </>
        )}

        {/* 无选中对象：显示帧属性 */}
        {frame && !selected?.data && (
          <>
            <Row label="时长">
              <div className="flex items-center gap-2">
                <NumInput value={frame.duration} onChange={(v) => updateFrame(currentFrameIndex, { duration: v })} />
                <span className="text-xs text-muted-foreground">Tick</span>
              </div>
            </Row>
            {frame.sprite.w > 0 ? (
              <>
                <GroupLabel hint="图片对齐到角色根点 Root(0,0) 的像素坐标">轴点</GroupLabel>
                <Row label="X"><NumInput value={frame.offset.x} onChange={(v) => setOffset(currentFrameIndex, v, frame.offset.y)} /></Row>
                <Row label="Y"><NumInput value={frame.offset.y} onChange={(v) => setOffset(currentFrameIndex, frame.offset.x, v)} /></Row>
                <GroupLabel hint="脚底中心=站立着地；图片中心=几何中心">快速设置</GroupLabel>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), frame.sprite.h)}>
                    <Footprints /> 脚底中心
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), Math.round(frame.sprite.h / 2))}>
                    <AlignCenter /> 图片中心
                  </Button>
                </div>
                <Separator className="my-1" />
                <span className="text-xs font-medium text-muted-foreground">信息</span>
                <div className="flex flex-col gap-1">
                  <StatRow label="文件名" value={frame.sprite.path || '—'} />
                  <StatRow label="尺寸" value={`${frame.sprite.w}×${frame.sprite.h}`} />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">尚未载入精灵图。</p>
            )}
          </>
        )}

        {!frame && <p className="text-xs text-muted-foreground">无当前帧</p>}
      </div>
    </div>
  )
}
