import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Kbd } from '@/components/ui/kbd'
import { MousePointer2, Move, Square, Swords, Diamond, Box, Crosshair } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { Tool } from '../../types/animation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const editTools: { id: Tool; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: 'select', label: '选择', icon: MousePointer2, shortcut: 'Q' },
  { id: 'anchor', label: '精灵对齐', icon: Move, shortcut: 'W' },
]

const createTools: { id: Tool; label: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: 'hurtbox', label: '受击框', icon: Square },
  { id: 'hitbox', label: '攻击框', icon: Swords },
  { id: 'jcbox', label: 'JC框', icon: Diamond },
  { id: 'pushbox', label: '推挤框', icon: Box },
  { id: 'spawnpoint', label: '发射点', icon: Crosshair },
]

function ToolButton({
  id,
  label,
  icon: Icon,
  shortcut,
  active,
  onClick,
}: {
  id: Tool
  label: string
  icon: LucideIcon
  shortcut?: string
  active: boolean
  onClick: (id: Tool) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', active && 'bg-accent text-accent-foreground')}
          onClick={() => onClick(id)}
          aria-label={label}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {shortcut && <Kbd className="px-1 py-0 text-[10px]">{shortcut}</Kbd>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export default function ToolRail() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      {editTools.map((t) => (
        <ToolButton key={t.id} {...t} active={tool === t.id} onClick={setTool} />
      ))}
      <Separator className="my-1 w-6" />
      {createTools.map((t) => (
        <ToolButton key={t.id} {...t} active={tool === t.id} onClick={setTool} />
      ))}
    </div>
  )
}
