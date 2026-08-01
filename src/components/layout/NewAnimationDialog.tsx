import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '../../store/projectStore'
import { Folder } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 确认创建后回调，传入用户输入的动画名 */
  onConfirm: (name: string) => void | Promise<void>
  /** 取消回调 */
  onCancel?: () => void
}

/** 文件夹/路径安全的 slug：只保留字母数字下划线连字符，其余转下划线 */
function toSlug(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export default function NewAnimationDialog({ open, onOpenChange, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  const workspaceName = useProjectStore((s) => s.workspaceName)
  const hasWorkspace = useProjectStore((s) => s.hasWorkspace)
  const setWorkspace = useProjectStore((s) => s.setWorkspace)

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setBusy(false)
    }
  }, [open])

  const slug = toSlug(name)

  const handleChangeWorkspace = async () => {
    try {
      // @ts-ignore - File System Access API
      const handle = await window.showDirectoryPicker({
        id: 'animation-workspace',
        mode: 'readwrite',
      })
      await setWorkspace(handle)
    } catch {
      // 用户取消
    }
  }

  const handleConfirm = async () => {
    if (!slug || busy) return
    // 没工作区则先选
    if (!useProjectStore.getState().workspaceHandle) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({
          id: 'animation-workspace',
          mode: 'readwrite',
        })
        await setWorkspace(handle)
      } catch {
        return // 用户取消选目录，放弃创建
      }
    }
    setBusy(true)
    try {
      await onConfirm(slug)
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && onCancel) onCancel()
      onOpenChange(v)
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogNewAnim.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogNewAnim.desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* 工作区路径 */}
          <div className="flex flex-col gap-1.5">
            <Label>{t('dialogNewAnim.location')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1.5 text-xs">
                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-muted-foreground" title={workspaceName}>
                  {hasWorkspace ? workspaceName : t('dialogNewAnim.noWorkspace')}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleChangeWorkspace}>
                {t('dialogNewAnim.change')}
              </Button>
            </div>
            {!hasWorkspace && (
              <p className="text-xs text-amber-600">{t('dialogNewAnim.noWorkspaceWarn')}</p>
            )}
          </div>

          {/* 动画名 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="anim-name">{t('dialogNewAnim.name')}</Label>
            <Input
              id="anim-name"
              autoFocus
              value={name}
              placeholder="anim_200"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
            />
            {name && (
              <p className="text-xs text-muted-foreground">
                {t('dialogNewAnim.willCreate', { slug })}
                {name !== slug && <span className="text-amber-600">{t('dialogNewAnim.slugWarn')}</span>}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            if (onCancel) onCancel()
            onOpenChange(false)
          }} disabled={busy}>
            {t('dialogNewAnim.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!slug || busy}>
            {busy ? t('dialogNewAnim.creating') : t('dialogNewAnim.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
