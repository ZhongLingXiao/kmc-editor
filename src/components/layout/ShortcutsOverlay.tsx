import { useState } from 'react'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Kbd } from '@/components/ui/kbd'
import { Keyboard, X } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  desc: string
}

const SHORTCUT_GROUPS: { title: string; items: ShortcutItem[] }[] = [
  {
    title: '工具',
    items: [
      { keys: ['Q'], desc: '选择' },
      { keys: ['W'], desc: '精灵对齐' },
    ],
  },
  {
    title: '帧',
    items: [
      { keys: ['←', '→'], desc: '切换帧' },
      { keys: ['Delete'], desc: '删除选中/当前帧' },
    ],
  },
  {
    title: '编辑',
    items: [
      { keys: ['↑', '↓', '←', '→'], desc: '微调选中元素' },
      { keys: ['Shift', '拖拽'], desc: '锁主轴向' },
      { keys: ['Esc'], desc: '取消选中' },
      { keys: ['Ctrl', 'Z'], desc: '撤销' },
      { keys: ['Ctrl', 'Y'], desc: '重做' },
    ],
  },
  {
    title: '视图',
    items: [
      { keys: ['Space'], desc: '播放/暂停·平移' },
      { keys: ['滚轮'], desc: '缩放画布' },
    ],
  },
]

function ShortcutRow({ keys, desc }: ShortcutItem) {
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
  const [open, setOpen] = useState(false)

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
        <TooltipContent>{open ? '收起' : '快捷键'}</TooltipContent>
      </Tooltip>
      <CollapsibleContent className="absolute right-0 top-full mt-1">
        <div className="w-[210px] rounded-md border bg-card/80 p-2 shadow backdrop-blur-sm">
          <span className="mb-1.5 block text-xs font-semibold">快捷键</span>
          <div className="flex flex-col gap-2">
            {SHORTCUT_GROUPS.map((g) => (
              <div key={g.title} className="flex flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {g.title}
                </span>
                <div className="flex flex-col gap-1">
                  {g.items.map((s) => (
                    <ShortcutRow key={s.desc} {...s} />
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
