import { useState } from 'react'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS: { key: string; desc: string }[] = [
  { key: '空格', desc: '播放/暂停·平移' },
  { key: '← →', desc: '切换帧' },
  { key: '方向键', desc: '微调选中(Shift=10)' },
  { key: 'Shift+拖', desc: '锁主轴向' },
  { key: 'Esc', desc: '取消选中' },
  { key: 'Delete', desc: '删除选中' },
  { key: 'Ctrl+Z/Y', desc: '撤销/重做' },
  { key: '滚轮', desc: '缩放画布' },
]

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="absolute left-2 top-2 z-20">
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
        <TooltipContent>{open ? '收起' : '快捷键'}</TooltipContent>
      </Tooltip>
      <CollapsibleContent className="mt-1">
        <div className="w-[190px] rounded-md border bg-card/80 p-2 shadow backdrop-blur-sm">
          <span className="mb-1 block text-xs font-semibold">快捷键</span>
          <div className="flex flex-col gap-0.5 text-[11px]">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <span className="shrink-0 font-mono text-muted-foreground">{s.key}</span>
                <span className="truncate text-muted-foreground" title={s.desc}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
