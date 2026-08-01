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
} from '@/components/ui/menubar'
import { Undo2, Redo2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { exportAnimation, importAnimation, buildExportData } from '../../utils/export'
import { saveAnimJson, migrateBase64Sprites, needsMigration } from '../../lib/project'
import { toast } from 'sonner'
import { useRef, useState, useEffect } from 'react'
import PreferencesDialog from './PreferencesDialog'
import NewAnimationDialog from './NewAnimationDialog'

export default function MenuBar() {
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
      toast.success(`已创建动画 ${name}`)
    } catch (err) {
      toast.error('创建失败：' + (err as Error).message)
    }
  }

  const handleOpen = async () => {
    const workspaceHandle = useProjectStore.getState().workspaceHandle
    try {
      // @ts-ignore - File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: '动画文件', accept: { 'application/json': ['.json'] } }],
        multiple: false,
        // @ts-ignore
        startIn: workspaceHandle ?? undefined,
      })
      await openAnimation(handle)
      toast.success(`已打开 ${useEditorStore.getState().animation.name}`)
    } catch (err) {
      // 用户取消或浏览器不支持
    }
    setOpenMenu(null)
  }

  const handleSave = async () => {
    const workspaceHandle = useProjectStore.getState().workspaceHandle
    if (!workspaceHandle) {
      toast.error('请先设定工作区目录（新建动画时选择）')
      setOpenMenu(null)
      return
    }
    useEditorStore.getState().syncMetadata()
    const anim = useEditorStore.getState().animation
    try {
      const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
      await saveAnimJson(workspaceHandle, anim.id, JSON.stringify(data, null, 2))
      toast.success('已保存')
    } catch (err) {
      toast.error('保存失败：' + (err as Error).message)
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
        types: [{ description: '动画文件', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      toast.success('已另存为')
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
          toast.warning('此文件为旧格式（含内嵌图片），请先新建动画设定工作区再导入，以便迁移图片')
          useEditorStore.getState().setAnimation(data)
          e.target.value = ''
          setOpenMenu(null)
          return
        }
        const migrated = await migrateBase64Sprites(workspaceHandle, data, data.id)
        useEditorStore.getState().setAnimation(migrated)
        toast.success(`已导入并迁移 ${data.name}`)
      } else {
        useEditorStore.getState().setAnimation(data)
        toast.success(`已导入 ${data.name}`)
      }
    } catch (err) {
      toast.error('导入失败：' + (err as Error).message)
    }
    e.target.value = ''
    setOpenMenu(null)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-card px-2" ref={menuRef}>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>文件</MenubarTrigger>
          <MenubarContent>
            <MenubarItem id="menu-new-project" onClick={handleNew}>
              新建动画… <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-open-project" onClick={handleOpen}>
              打开动画… <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem id="menu-save" onClick={handleSave} disabled={!hasWorkspace}>
              保存 <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-saveas" onClick={handleSaveAs}>
              另存为… <MenubarShortcut>Ctrl+Shift+S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => fileInputRef.current?.click()}>导入旧 JSON…</MenubarItem>
            <MenubarItem id="menu-export" onClick={handleExport}>导出（下载）</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>编辑</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={undo} disabled={!canUndo}>
              撤销 <MenubarShortcut>Ctrl+Z</MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={redo} disabled={!canRedo}>
              重做 <MenubarShortcut>Ctrl+Y</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => { setPreferencesOpen(true); setOpenMenu(null) }}>
              偏好设置…
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>视图</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => { resetView(); setOpenMenu(null) }}>
              重置视图
            </MenubarItem>
            <MenubarSeparator />
            <MenubarCheckboxItem
              checked={showLayers.grid}
              onClick={() => toggleLayer('grid')}
            >
              显示网格
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={showLayers.onionSkin}
              onClick={() => toggleLayer('onionSkin')}
            >
              显示洋葱皮
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
        <Badge variant="outline" className="gap-1 font-normal" title="工作区">
          {workspaceName}
        </Badge>
      )}

      <Badge variant="secondary" className="gap-1 font-normal">
        {animation.name}
        <span className="text-muted-foreground">{animation.elements.length} 帧</span>
      </Badge>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo}>
            <Undo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>撤销 Ctrl+Z</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo}>
            <Redo2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>重做 Ctrl+Y</TooltipContent>
      </Tooltip>

      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
      <NewAnimationDialog
        open={newAnimOpen}
        onOpenChange={setNewAnimOpen}
        onConfirm={handleNewConfirm}
      />
    </div>
  )
}
