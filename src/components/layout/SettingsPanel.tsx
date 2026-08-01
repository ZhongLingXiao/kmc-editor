import { useEditorStore } from '../../store/editorStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-16 shrink-0 text-xs text-muted-foreground">{label}</Label>
      <div className="flex-1">{children}</div>
    </div>
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

export default function SettingsPanel() {
  const animation = useEditorStore((s) => s.animation)
  const updateAnimationMeta = useEditorStore((s) => s.updateAnimationMeta)
  const settingsOpen = useEditorStore((s) => s.settingsOpen)
  const setSettingsOpen = useEditorStore((s) => s.setSettingsOpen)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Accordion type="multiple" value={settingsOpen} onValueChange={setSettingsOpen} className="min-h-0 flex-1 overflow-auto px-2">
        <AccordionItem value="anim">
          <AccordionTrigger className="text-xs">动画属性</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2.5 px-1 pb-3">
            <Row label="ID">
              <Input value={animation.id} readOnly className="h-7 bg-muted text-muted-foreground" title="ID 创建后不可修改，用作文件夹与资源路径" />
            </Row>
            <Row label="名称">
              <Input value={animation.name} onChange={(e) => updateAnimationMeta({ name: e.target.value })} className="h-7" />
            </Row>
            <Row label="循环(导出)">
              <Switch checked={animation.loop} onCheckedChange={(v) => updateAnimationMeta({ loop: v })} />
            </Row>
            <Separator className="my-1" />
            <span className="text-xs font-medium text-muted-foreground">信息</span>
            <div className="flex flex-col gap-1">
              <StatRow label="总时长" value={`${animation.totalTicks} Tick`} />
              <StatRow label="帧数" value={animation.elements.length} />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
