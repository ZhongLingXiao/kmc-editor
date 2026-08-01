import { useMemo, useState } from 'react'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { Keyboard, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ShortcutItem {
  keys: string[]
  descKey: string
}

function ShortcutRow({ keys, descKey }: ShortcutItem) {
  const { t } = useTranslation()
  const desc = t(descKey)
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex shrink-0 items-center gap-0.5">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
            <Kbd className="px-1 py-0 text-[10px]">{k}</Kbd>
          </span>
        ))}
      </div>
      <span className="truncate text-[11px] text-muted-foreground" title={desc}>{desc}</span>
    </div>
  )
}

export default function ShortcutsOverlay() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const groups: { titleKey: string; items: ShortcutItem[] }[] = useMemo(() => [
    {
      titleKey: 'shortcut.groupTool',
      items: [
        { keys: ['Q'], descKey: 'shortcut.selSelect' },
        { keys: ['W'], descKey: 'shortcut.selAnchor' },
      ],
    },
    {
      titleKey: 'shortcut.groupFrame',
      items: [
        { keys: ['←', '→'], descKey: 'shortcut.frameSwitch' },
        { keys: ['Delete'], descKey: 'shortcut.frameDelete' },
      ],
    },
    {
      titleKey: 'shortcut.groupEdit',
      items: [
        { keys: ['↑', '↓', '←', '→'], descKey: 'shortcut.editNudge' },
        { keys: ['Shift', t('common.drag')], descKey: 'shortcut.editLockAxis' },
        { keys: ['Esc'], descKey: 'shortcut.editCancel' },
        { keys: ['Ctrl', 'Z'], descKey: 'shortcut.editUndo' },
        { keys: ['Ctrl', 'Y'], descKey: 'shortcut.editRedo' },
      ],
    },
    {
      titleKey: 'shortcut.groupView',
      items: [
        { keys: ['Space'], descKey: 'shortcut.viewPlay' },
        { keys: [t('common.wheel')], descKey: 'shortcut.viewZoom' },
      ],
    },
  ], [t])

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute right-2 top-2 z-20"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="bg-card/80 shadow backdrop-blur-sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Keyboard />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{open ? t('shortcut.collapse') : t('shortcut.title')}</TooltipContent>
      </Tooltip>
      <CollapsibleContent className="absolute right-0 top-full mt-1">
        <div className="w-[210px] rounded-md border bg-card/80 p-2 shadow backdrop-blur-sm">
          <span className="mb-1.5 block text-xs font-semibold">{t('shortcut.title')}</span>
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <div key={g.titleKey} className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {t(g.titleKey)}
                </span>
                <div className="flex flex-col gap-1">
                  {g.items.map((s) => (
                    <ShortcutRow key={s.descKey} {...s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
