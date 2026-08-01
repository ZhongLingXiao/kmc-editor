import { useEditorStore } from '../../store/editorStore'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const newFrameInheritBoxes = useEditorStore((s) => s.newFrameInheritBoxes)
  const setNewFrameInheritBoxes = useEditorStore((s) => s.setNewFrameInheritBoxes)
  const newFrameInheritOffset = useEditorStore((s) => s.newFrameInheritOffset)
  const setNewFrameInheritOffset = useEditorStore((s) => s.setNewFrameInheritOffset)
  const saveEditorMetadata = useEditorStore((s) => s.saveEditorMetadata)
  const setSaveEditorMetadata = useEditorStore((s) => s.setSaveEditorMetadata)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogPrefs.title')}</DialogTitle>
          <DialogDescription>{t('dialogPrefs.desc')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dialogPrefs.newFrame')}</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">{t('dialogPrefs.inheritOffset')}</Label>
                <p className="text-xs text-muted-foreground">{t('dialogPrefs.inheritOffsetDesc')}</p>
              </div>
              <Switch checked={newFrameInheritOffset} onCheckedChange={setNewFrameInheritOffset} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">{t('dialogPrefs.inheritBoxes')}</Label>
                <p className="text-xs text-muted-foreground">{t('dialogPrefs.inheritBoxesDesc')}</p>
              </div>
              <Switch checked={newFrameInheritBoxes} onCheckedChange={setNewFrameInheritBoxes} />
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('dialogPrefs.file')}</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label className="text-sm">{t('dialogPrefs.saveMeta')}</Label>
                <p className="text-xs text-muted-foreground">{t('dialogPrefs.saveMetaDesc')}</p>
              </div>
              <Switch checked={saveEditorMetadata} onCheckedChange={setSaveEditorMetadata} />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
