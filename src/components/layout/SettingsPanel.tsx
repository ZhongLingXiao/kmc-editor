import { useEditorStore } from '../../store/editorStore'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
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

const PREV_COLORS = [
  { label: '蓝', val: '#0096ff' },
  { label: '青', val: '#00ffcc' },
  { label: '绿', val: '#22ff22' },
  { label: '紫', val: '#aa00ff' },
]
const NEXT_COLORS = [
  { label: '红', val: '#ff5050' },
  { label: '橙', val: '#ff8800' },
  { label: '黄', val: '#ffdd00' },
  { label: '粉', val: '#ff00aa' },
]

export default function SettingsPanel() {
  const animation = useEditorStore((s) => s.animation)
  const updateAnimationMeta = useEditorStore((s) => s.updateAnimationMeta)
  const onionSkin = useEditorStore((s) => s.onionSkin)
  const updateOnionSkin = useEditorStore((s) => s.updateOnionSkin)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t">
      <div className="shrink-0 bg-muted/50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">设置</span>
      </div>
      <Separator />
      <Accordion type="multiple" defaultValue={['anim']} className="min-h-0 flex-1 overflow-auto px-2">
        <AccordionItem value="anim">
          <AccordionTrigger className="text-xs">动画属性</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2.5 px-1 pb-3">
            <Row label="ID">
              <Input value={animation.id} onChange={(e) => updateAnimationMeta({ id: e.target.value })} className="h-7" />
            </Row>
            <Row label="名称">
              <Input value={animation.name} onChange={(e) => updateAnimationMeta({ name: e.target.value })} className="h-7" />
            </Row>
            <Row label="总时长">
              <span className="text-xs text-muted-foreground">{animation.totalTicks} Tick</span>
            </Row>
            <Row label="循环(导出)">
              <Switch checked={animation.loop} onCheckedChange={(v) => updateAnimationMeta({ loop: v })} />
            </Row>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="onion">
          <AccordionTrigger className="text-xs">洋葱皮</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-3 px-1 pb-3">
            <Row label="前帧">
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.prevFrames}
                onChange={(e) => updateOnionSkin({ prevFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label="后帧">
              <Input
                type="number"
                min={0}
                max={5}
                value={onionSkin.nextFrames}
                onChange={(e) => updateOnionSkin({ nextFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
                className="h-7"
              />
            </Row>
            <Row label="透明度">
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.baseOpacity]} min={0.1} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ baseOpacity: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.baseOpacity * 100)}%</span>
              </div>
            </Row>
            <Row label="衰减率">
              <div className="flex items-center gap-2">
                <Slider className="w-24 shrink-0" value={[onionSkin.decayRate]} min={0.2} max={1} step={0.05} onValueChange={([v]) => updateOnionSkin({ decayRate: v })} />
                <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">{Math.round(onionSkin.decayRate * 100)}%</span>
              </div>
            </Row>
            <Row label="前帧色">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={onionSkin.prevColor.startsWith('rgba') ? '#0096ff' : onionSkin.prevColor}
                  onChange={(e) => updateOnionSkin({ prevColor: e.target.value })}
                  className="size-6 cursor-pointer rounded border bg-transparent"
                />
                {PREV_COLORS.map((c) => (
                  <button
                    key={c.val}
                    onClick={() => updateOnionSkin({ prevColor: c.val })}
                    className="size-5 rounded border"
                    style={{ background: c.val, borderColor: onionSkin.prevColor === c.val ? '#000' : 'var(--border)' }}
                    title={c.label}
                  />
                ))}
              </div>
            </Row>
            <Row label="后帧色">
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={onionSkin.nextColor.startsWith('rgba') ? '#ff5050' : onionSkin.nextColor}
                  onChange={(e) => updateOnionSkin({ nextColor: e.target.value })}
                  className="size-6 cursor-pointer rounded border bg-transparent"
                />
                {NEXT_COLORS.map((c) => (
                  <button
                    key={c.val}
                    onClick={() => updateOnionSkin({ nextColor: c.val })}
                    className="size-5 rounded border"
                    style={{ background: c.val, borderColor: onionSkin.nextColor === c.val ? '#000' : 'var(--border)' }}
                    title={c.label}
                  />
                ))}
              </div>
            </Row>
            <Row label="精灵图">
              <Switch checked={onionSkin.showSprite} onCheckedChange={(v) => updateOnionSkin({ showSprite: v })} />
            </Row>
            <Row label="碰撞框">
              <Switch checked={onionSkin.showBoxes} onCheckedChange={(v) => updateOnionSkin({ showBoxes: v })} />
            </Row>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="display">
          <AccordionTrigger className="text-xs">显示</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2.5 px-1 pb-3">
            <Row label="网格">
              <Switch checked={showLayers.grid} onCheckedChange={() => toggleLayer('grid')} />
            </Row>
            <Row label="洋葱皮">
              <Switch checked={showLayers.onionSkin} onCheckedChange={() => toggleLayer('onionSkin')} />
            </Row>
            <p className="text-[11px] text-muted-foreground">受击框/攻击框等类型的显隐，请在左侧“场景大纲”的组眼睛中切换。</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="help">
          <AccordionTrigger className="text-xs">快捷键</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-1 px-1 pb-3 text-[11px] text-muted-foreground">
            <div>空格 — 播放/暂停（轻点）/ 平移（按住拖拽）</div>
            <div>← → — 切换帧（无选中时）</div>
            <div>方向键 — 微调选中元素（Shift=10px）</div>
            <div>Shift + 拖拽 — 锁主轴向移动</div>
            <div>Esc — 取消选中</div>
            <div>Delete — 删除选中对象</div>
            <div>Ctrl+Z / Ctrl+Y — 撤销/重做</div>
            <div>滚轮 — 缩放画布</div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
