import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { COLORS } from '../../types/animation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ObjType = 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint'

interface OutlineItem {
  id: string
  type: ObjType
  label: string
  color: string
  abbrev: string
}

const TYPE_META: Record<ObjType, { color: string; abbrev: string }> = {
  hurtbox: { color: COLORS.hurtboxBorder, abbrev: 'Hurt' },
  hitbox: { color: COLORS.hitboxBorder, abbrev: 'Hit' },
  jcbox: { color: COLORS.jcboxBorder, abbrev: 'JC' },
  pushbox: { color: COLORS.pushboxBorder, abbrev: 'Push' },
  spawnpoint: { color: COLORS.spawnpoint, abbrev: 'Spawn' },
}

export default function Outline() {
  const animation = useEditorStore((s) => s.animation)
  // 播放时冻结为 -1：大纲不跟随帧变化刷新，避免播放性能损耗
  const currentFrameIndex = useEditorStore((s) => (s.isPlaying ? -1 : s.currentFrameIndex))
  const isPlaying = useEditorStore((s) => s.isPlaying)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const selectBox = useEditorStore((s) => s.selectBox)
  const toggleSelection = useEditorStore((s) => s.toggleSelection)
  const selectRange = useEditorStore((s) => s.selectRange)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const removeSelected = useEditorStore((s) => s.removeSelected)

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null
  // shift 范围选的锚点（上次单击/Ctrl 单击的项）
  const [anchorId, setAnchorId] = useState<string | null>(null)

  // 构建扁平、按类型固定排序的对象列表：受击→攻击→JC→推挤→发射点
  const items: OutlineItem[] = []
  if (frame) {
    const push = (id: string, type: ObjType, label: string) =>
      items.push({ id, type, label, color: TYPE_META[type].color, abbrev: TYPE_META[type].abbrev })
    frame.hurtboxes.forEach((b, i) => push(b.id, 'hurtbox', `受击框 ${i + 1}`))
    frame.hitboxes.forEach((b, i) => push(b.id, 'hitbox', `攻击框 ${i + 1}`))
    frame.jcboxes.forEach((b, i) => push(b.id, 'jcbox', `JC框 ${i + 1}`))
    if (animation.pushbox.stand) push(animation.pushbox.stand.id, 'pushbox', '推挤框（站立）')
    frame.spawnPoints.forEach((p) => push(p.id, 'spawnpoint', p.name))
  }

  const handleClick = (item: OutlineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(item.type, item.id)
      setAnchorId(item.id)
    } else if (e.shiftKey && anchorId) {
      const anchorIdx = items.findIndex((it) => it.id === anchorId)
      const clickIdx = items.findIndex((it) => it.id === item.id)
      if (anchorIdx >= 0 && clickIdx >= 0) {
        const [from, to] = anchorIdx <= clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx]
        const range = items.slice(from, to + 1)
        selectRange(range.map((it) => it.id), item.id, item.type)
      } else {
        selectBox(item.type, item.id)
        setAnchorId(item.id)
      }
    } else {
      selectBox(item.type, item.id)
      setAnchorId(item.id)
    }
  }

  // 右键未选中项：先单选它；已属于多选则保留选区（便于对整组操作）
  const handleContextMenu = (item: OutlineItem) => {
    if (!selectedIds.includes(item.id)) {
      selectBox(item.type, item.id)
      setAnchorId(item.id)
    }
  }

  const totalObjects = items.length

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t">
      <div className="flex shrink-0 items-center justify-between bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">场景大纲</span>
        {frame && <Badge variant="secondary" className="font-normal">{totalObjects}</Badge>}
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        {/* 点空白处清空选区 */}
        <div className="p-1" onClick={() => clearSelection()}>
          {!frame && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {isPlaying ? '播放中…' : '无当前帧'}
            </div>
          )}
          {frame && totalObjects === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">当前帧无对象</div>
          )}
          {items.map((it, i) => {
            const selected = selectedIds.includes(it.id)
            // 类型分界：与上一项类型不同时，前补淡分隔线
            const divider = i > 0 && items[i - 1].type !== it.type
            return (
              <div key={it.id}>
                {divider && <div className="my-0.5 h-px bg-border/50" />}
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      onClick={(e) => handleClick(it, e)}
                      onContextMenu={() => handleContextMenu(it)}
                      onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault() }}
                      className={cn(
                        'relative flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs',
                        selected ? 'bg-accent' : 'hover:bg-accent/60'
                      )}
                    >
                      {selected && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-foreground" />}
                      <span className="size-2 shrink-0 rounded-full" style={{ background: it.color }} />
                      <span className={cn('min-w-0 flex-1 truncate', selected && 'font-medium')}>{it.label}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/70">{it.abbrev}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => removeSelected()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 /> 删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
