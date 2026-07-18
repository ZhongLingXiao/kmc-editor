import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { COLORS, Box, SpawnPoint, ShowLayers } from '../../types/animation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu'
import { ChevronRight, Eye, EyeOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type BoxType = 'hurtbox' | 'hitbox' | 'jcbox'
type GroupKey = BoxType | 'pushbox' | 'spawnpoint'

const GROUPS: { key: GroupKey; label: string; color: string; border: string }[] = [
  { key: 'hurtbox', label: '受击框', color: COLORS.hurtbox, border: COLORS.hurtboxBorder },
  { key: 'hitbox', label: '攻击框', color: COLORS.hitbox, border: COLORS.hitboxBorder },
  { key: 'jcbox', label: 'JC框', color: COLORS.jcbox, border: COLORS.jcboxBorder },
  { key: 'pushbox', label: '推挤框', color: COLORS.pushbox, border: COLORS.pushboxBorder },
  { key: 'spawnpoint', label: '发射点', color: COLORS.spawnpoint, border: COLORS.spawnpoint },
]

export default function Outline() {
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const selectedBoxId = useEditorStore((s) => s.selectedBoxId)
  const selectedBoxType = useEditorStore((s) => s.selectedBoxType)
  const removeBox = useEditorStore((s) => s.removeBox)
  const removeSpawnPoint = useEditorStore((s) => s.removeSpawnPoint)
  const setPushbox = useEditorStore((s) => s.setPushbox)

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map((g) => [g.key, true]))
  )

  const getItems = (key: GroupKey): { id: string; label: string; meta: string }[] => {
    if (!frame) return []
    if (key === 'hurtbox') return frame.hurtboxes.map((b, i) => ({ id: b.id, label: `受击框 ${i + 1}`, meta: `X:${b.x} Y:${b.y} W:${b.w} H:${b.h}` }))
    if (key === 'hitbox') return frame.hitboxes.map((b, i) => ({ id: b.id, label: `攻击框 ${i + 1}`, meta: `X:${b.x} Y:${b.y} W:${b.w} H:${b.h}` }))
    if (key === 'jcbox') return frame.jcboxes.map((b, i) => ({ id: b.id, label: `JC框 ${i + 1}`, meta: `X:${b.x} Y:${b.y} W:${b.w} H:${b.h}` }))
    if (key === 'pushbox') return animation.pushbox.stand ? [{ id: animation.pushbox.stand.id, label: '推挤框（站立）', meta: `X:${animation.pushbox.stand.x} Y:${animation.pushbox.stand.y} W:${animation.pushbox.stand.w} H:${animation.pushbox.stand.h}` }] : []
    return frame.spawnPoints.map((p) => ({ id: p.id, label: p.name, meta: `X:${p.x} Y:${p.y}` }))
  }

  const handleDelete = (key: GroupKey, id: string) => {
    if (key === 'hurtbox' || key === 'hitbox' || key === 'jcbox') removeBox(key, id)
    else if (key === 'pushbox') setPushbox('stand', null)
    else removeSpawnPoint(id)
  }

  const totalObjects = frame
    ? frame.hurtboxes.length + frame.hitboxes.length + frame.jcboxes.length + frame.spawnPoints.length + (animation.pushbox.stand ? 1 : 0)
    : 0

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t">
      <div className="flex shrink-0 items-center justify-between bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">场景大纲</span>
        {frame && <Badge variant="secondary" className="font-normal">{totalObjects}</Badge>}
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1.5">
          {!frame && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">无当前帧</div>
          )}
          {frame && totalObjects === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">当前帧无对象</div>
          )}
          {GROUPS.map((g) => {
            const items = getItems(g.key)
            if (items.length === 0) return null
            const layerKey = g.key as keyof ShowLayers
            const visible = showLayers[layerKey]
            const isOpen = open[g.key]
            return (
              <Collapsible key={g.key} open={isOpen} onOpenChange={(v) => setOpen((p) => ({ ...p, [g.key]: v }))}>
                <div className="flex items-center gap-1 rounded-md px-1 py-1">
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium">
                    <ChevronRight className={cn('size-3.5 transition-transform', isOpen && 'rotate-90')} />
                    {g.label}
                  </CollapsibleTrigger>
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">{items.length}</Badge>
                  <div className="flex-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => toggleLayer(layerKey)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent"
                      >
                        {visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{visible ? '隐藏' : '显示'}</TooltipContent>
                  </Tooltip>
                </div>
                <CollapsibleContent>
                  <div className="ml-2 border-l pl-1">
                    {items.map((it) => {
                      const isSelected = selectedBoxId === it.id && selectedBoxType === g.key
                      return (
                        <ContextMenu key={it.id}>
                          <ContextMenuTrigger asChild>
                            <div
                              onClick={() => useEditorStore.getState().selectBox(g.key, it.id)}
                              className={cn(
                                'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent',
                                isSelected && 'bg-accent'
                              )}
                              style={{ borderLeft: `3px solid ${g.border}` }}
                            >
                              <span className="size-2 shrink-0 rounded-sm" style={{ background: g.border }} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{it.label}</div>
                                <div className="truncate text-[10px] text-muted-foreground">{it.meta}</div>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem
                              onClick={() => handleDelete(g.key, it.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 /> 删除
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
