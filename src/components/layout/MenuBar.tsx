import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarCheckboxItem,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/components/ui/menubar'
import { Undo2, Redo2, Clock, FilePlus2, FolderOpen, Save, SaveAll, FileInput, Download, Settings, Maximize, Globe } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { changeLang } from '../../i18n'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { exportAnimation, importAnimation, buildExportData } from '../../utils/export'
import { saveAnimJson, migrateBase64Sprites, needsMigration, ensurePermission } from '../../lib/project'
import type { RecentFile } from '../../lib/project'
import { toast } from 'sonner'
import { useRef, useState, useEffect } from 'react'
import PreferencesDialog from './PreferencesDialog'
import NewAnimationDialog from './NewAnimationDialog'

export default function MenuBar() {
  const { t, i18n } = useTranslation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const animation = useEditorStore((s) => s.animation)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const resetView = useEditorStore((s) => s.resetView)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [newAnimOpen, setNewAnimOpen] = useState(false)

  const hasWorkspace = useProjectStore((s) => s.hasWorkspace)
  const workspaceName = useProjectStore((s) => s.workspaceName)
  const createAnimation = useProjectStore((s) => s.createAnimation)
  const openAnimation = useProjectStore((s) => s.openAnimation)
  const restoreWorkspace = useProjectStore((s) => s.restoreWorkspace)
  const recentFiles = useProjectStore((s) => s.recentFiles)
  const openRecentFile = useProjectStore((s) => s.openRecentFile)
  const removeRecentFile = useProjectStore((s) => s.removeRecentFile)
  const clearRecentFiles = useProjectStore((s) => s.clearRecentFiles)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // 启动时从 IndexedDB 恢复工作区
  useEffect(() => {
    void restoreWorkspace()
  }, [restoreWorkspace])

  const undo = () => useEditorStore.temporal.getState().undo()
  const redo = () => useEditorStore.temporal.getState().redo()
  const temporalState = useEditorStore.temporal.getState()
  const canUndo = temporalState.pastStates.length > 0
  const canRedo = temporalState.futureStates.length > 0

  // 新建动画：弹窗输入名字（弹窗内可改工作区）
  const handleNew = () => {
    setNewAnimOpen(true)
    setOpenMenu(null)
  }

  const handleNewConfirm = async (name: string) => {
    try {
      await createAnimation(name)
      toast.success(t('toast.createdAnim', { name }))
    } catch (err) {
      toast.error(t('toast.createFailed') + '：' + (err as Error).message)
    }
  }

  const handleOpen = async () => {
    const workspaceHandle = useProjectStore.getState().workspaceHandle
    try {
      // @ts-ignore - File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: t('menu.animFileDesc'), accept: { 'application/json': ['.json'] } }],
        multiple: false,
        // @ts-ignore
        startIn: workspaceHandle ?? undefined,
      })
      await openAnimation(handle)
      toast.success(t('toast.opened', { name: useEditorStore.getState().animation.name }))
    } catch (err) {
      // 用户取消或浏览器不支持
    }
    setOpenMenu(null)
  }

  const handleOpenRecent = async (item: RecentFile) => {
    try {
      await openRecentFile(item)
      toast.success(t('toast.opened', { name: item.fileName }))
    } catch (err) {
      toast.error(t('toast.openFailed', { name: item.fileName }) + '：' + (err as Error).message)
      // 句柄可能已失效（文件被删/移动），从列表移除
      await removeRecentFile(item.fileHandle)
    }
    setOpenMenu(null)
  }

  const handleSave = async () => {
    const workspaceHandle = useProjectStore.getState().workspaceHandle
    if (!workspaceHandle) {
      toast.error(t('toast.saveFirst'))
      setOpenMenu(null)
      return
    }
    // 启动恢复的工作区可能尚未授权，首次保存时请求权限
    const ok = await ensurePermission(workspaceHandle, 'readwrite')
    if (!ok) {
      toast.error(t('toast.permissionDenied'))
      setOpenMenu(null)
      return
    }
    useEditorStore.getState().syncMetadata()
    const anim = useEditorStore.getState().animation
    try {
      const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
      await saveAnimJson(workspaceHandle, anim.id, JSON.stringify(data, null, 2))
      toast.success(t('toast.saved'))
    } catch (err) {
      toast.error(t('toast.saveFailed') + '：' + (err as Error).message)
    }
    setOpenMenu(null)
  }

  const handleSaveAs = async () => {
    useEditorStore.getState().syncMetadata()
    const anim = useEditorStore.getState().animation
    try {
      // @ts-ignore
      const handle = await window.showSaveFilePicker({
        suggestedName: `${anim.id}.json`,
        types: [{ description: t('menu.animFileDesc'), accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      toast.success(t('toast.savedAs'))
    } catch (err) {
      // 用户取消
    }
    setOpenMenu(null)
  }

  const handleExport = () => {
    exportAnimation(animation, useEditorStore.getState().saveEditorMetadata)
    setOpenMenu(null)
  }

  // 导入旧 JSON（兼容迁移）
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importAnimation(file)
      if (needsMigration(data)) {
        const workspaceHandle = useProjectStore.getState().workspaceHandle
        if (!workspaceHandle) {
          toast.warning(t('toast.legacyWarn'))
          useEditorStore.getState().setAnimation(data)
          e.target.value = ''
          setOpenMenu(null)
          return
        }
        const migrated = await migrateBase64Sprites(workspaceHandle, data, data.id)
        useEditorStore.getState().setAnimation(migrated)
        toast.success(t('toast.importedMigrated', { name: data.name }))
      } else {
        useEditorStore.getState().setAnimation(data)
        toast.success(t('toast.importedName', { name: data.name }))
      }
    } catch (err) {
      toast.error(t('toast.importFailed') + '：' + (err as Error).message)
    }
    e.target.value = ''
    setOpenMenu(null)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-card px-2" ref={menuRef}>
      <Menubar className="border-0 bg-transparent p-0 shadow-none">
        <MenubarMenu>
          <MenubarTrigger>{t('menu.file')}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem id="menu-new-project" onClick={handleNew}>
              <FilePlus2 /> {t('menu.new')} <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-open-project" onClick={handleOpen}>
              <FolderOpen /> {t('menu.open')} <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger>
                <Clock className="size-4 mr-2 text-muted-foreground" /> {t('menu.recent')}
              </MenubarSubTrigger>
              <MenubarSubContent>
                {recentFiles.length === 0 ? (
                  <MenubarItem disabled>{t('menu.recentEmpty')}</MenubarItem>
                ) : (
                  recentFiles.map((item, idx) => (
                    <MenubarItem
                      key={`${item.lastOpenedAt}-${idx}`}
                      onClick={() => handleOpenRecent(item)}
                      title={`${item.workspaceName}/${item.fileName}`}
                    >
                      <span className="truncate font-mono">{item.fileName}</span>
                      <span className="ml-auto pl-2 text-xs text-muted-foreground">
                        {item.workspaceName}
                      </span>
                    </MenubarItem>
                  ))
                )}
                {recentFiles.length > 0 && (
                  <>
                    <MenubarSeparator />
                    <MenubarItem
                      onClick={() => { void clearRecentFiles(); setOpenMenu(null) }}
                      className="text-muted-foreground"
                    >
                      {t('menu.clearList')}
                    </MenubarItem>
                  </>
                )}
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem id="menu-save" onClick={handleSave} disabled={!hasWorkspace}>
              <Save /> {t('menu.save')} <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-saveas" onClick={handleSaveAs}>
              <SaveAll /> {t('menu.saveAs')} <MenubarShortcut>Ctrl+Shift+S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => fileInputRef.current?.click()}>
              <FileInput /> {t('menu.importLegacy')}
            </MenubarItem>
            <MenubarItem id="menu-export" onClick={handleExport}>
              <Download /> {t('menu.export')}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>{t('menu.edit')}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={undo} disabled={!canUndo}>
              <Undo2 /> {t('menu.undo')} <MenubarShortcut>Ctrl+Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={redo} disabled={!canRedo}>
              <Redo2 /> {t('menu.redo')} <MenubarShortcut>Ctrl+Y</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => { setPreferencesOpen(true); setOpenMenu(null) }}>
              <Settings /> {t('menu.preferences')}
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>{t('menu.view')}</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => { resetView(); setOpenMenu(null) }}>
              <Maximize /> {t('menu.resetView')}
            </MenubarItem>
            <MenubarSeparator />
            <MenubarCheckboxItem
              checked={showLayers.grid}
              onClick={() => toggleLayer('grid')}
            >
              {t('menu.showGrid')}
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={showLayers.onionSkin}
              onClick={() => toggleLayer('onionSkin')}
            >
              {t('menu.showOnion')}
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
      />

      <div className="flex-1" />

      {hasWorkspace && (
        <Badge variant="outline" className="gap-1 font-normal" title={t('menu.workspace')}>
          {workspaceName}
        </Badge>
      )}

      <Badge variant="secondary" className="gap-1 font-normal">
        {animation.name}
        <span className="text-muted-foreground">{animation.elements.length} {t('common.frames')}</span>
      </Badge>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('menu.undo')} Ctrl+Z</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo}>
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('menu.redo')} Ctrl+Y</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('lang.label')}>
                <Globe />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('lang.label')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={i18n.language}
            onValueChange={(v) => changeLang(v as 'zh' | 'en')}
          >
            <DropdownMenuRadioItem value="zh">{t('lang.zh')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">{t('lang.en')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <NewAnimationDialog
        open={newAnimOpen}
        onOpenChange={setNewAnimOpen}
        onConfirm={handleNewConfirm}
      />
    </div>
  )
}
