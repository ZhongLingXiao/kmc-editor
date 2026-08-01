import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { Kbd } from '@/components/ui/kbd'
import { MousePointer2, Move, Square, Swords, Diamond, Box, Crosshair } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { Tool } from '../../types/animation'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const editTools: { id: Tool; labelKey: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: 'select', labelKey: 'tool.select', icon: MousePointer2, shortcut: 'Q' },
  { id: 'anchor', labelKey: 'tool.anchor', icon: Move, shortcut: 'W' },
]

const createTools: { id: Tool; labelKey: string; icon: LucideIcon; shortcut?: string }[] = [
  { id: 'hurtbox', labelKey: 'tool.hurtbox', icon: Square },
  { id: 'hitbox', labelKey: 'tool.hitbox', icon: Swords },
  { id: 'jcbox', labelKey: 'tool.jcbox', icon: Diamond },
  { id: 'pushbox', labelKey: 'tool.pushbox', icon: Box },
  { id: 'spawnpoint', labelKey: 'tool.spawnpoint', icon: Crosshair },
]

function ToolButton({
  id,
  labelKey,
  icon: Icon,
  shortcut,
  active,
  onClick,
}: {
  id: Tool
  labelKey: string
  icon: LucideIcon
  shortcut?: string
  active: boolean
  onClick: (id: Tool) => void
}) {
  const { t } = useTranslation()
  const label = t(labelKey)
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
