import { useEditorStore } from '../../store/editorStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export default function PreferencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const newFrameInheritBoxes = useEditorStore((s) => s.newFrameInheritBoxes)
  const setNewFrameInheritBoxes = useEditorStore((s) => s.setNewFrameInheritBoxes)
  const newFrameInheritOffset = useEditorStore((s) => s.newFrameInheritOffset)
  const setNewFrameInheritOffset = useEditorStore((s) => s.setNewFrameInheritOffset)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>偏好设置</DialogTitle>
          <DialogDescription>编辑器的全局行为偏好。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">新建帧</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">新帧继承轴点</Label>
                <p className="text-xs text-muted-foreground">新建帧时继承源帧的精灵轴点，使序列帧视觉对齐。关闭则轴点归零。</p>
              </div>
              <Switch checked={newFrameInheritOffset} onCheckedChange={setNewFrameInheritOffset} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">新帧继承碰撞箱与发射点</Label>
                <p className="text-xs text-muted-foreground">新建帧时继承源帧的 hurtbox/hitbox/JC框/推挤框/发射点。关闭则不继承。</p>
              </div>
              <Switch checked={newFrameInheritBoxes} onCheckedChange={setNewFrameInheritBoxes} />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
