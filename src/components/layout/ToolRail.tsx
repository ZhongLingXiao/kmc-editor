import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { MousePointer2, Move, Square, Swords, Diamond, Box, Crosshair } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { Tool } from '../../types/animation'
import type { LucideIcon } from 'lucide-react'

const editTools: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: '选择', icon: MousePointer2 },
  { id: 'anchor', label: '精灵对齐', icon: Move },
]

const createTools: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'hurtbox', label: '受击框', icon: Square },
  { id: 'hitbox', label: '攻击框', icon: Swords },
  { id: 'jcbox', label: 'JC框', icon: Diamond },
  { id: 'pushbox', label: '推挤框', icon: Box },
  { id: 'spawnpoint', label: '发射点', icon: Crosshair },
]

function ToolButton({ id, label, icon: Icon }: { id: Tool; label: string; icon: LucideIcon }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem value={id} aria-label={label} className="size-8 p-0">
          <Icon />
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export default function ToolRail() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      <ToggleGroup
        type="single"
        value={tool}
        onValueChange={(v) => v && setTool(v as Tool)}
        orientation="vertical"
        className="flex flex-col gap-1"
      >
        {editTools.map((t) => (
          <ToolButton key={t.id} {...t} />
        ))}
      </ToggleGroup>

      <Separator className="my-1 w-6" />

      <ToggleGroup
        type="single"
        value={tool}
        onValueChange={(v) => v && setTool(v as Tool)}
        orientation="vertical"
        className="flex flex-col gap-1"
      >
        {createTools.map((t) => (
          <ToolButton key={t.id} {...t} />
        ))}
      </ToggleGroup>
    </div>
  )
}
