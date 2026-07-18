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
import { exportAnimation, importAnimation } from '../../utils/export'
import { toast } from 'sonner'
import { useRef, useState, useEffect } from 'react'

interface FileHandle {
  name: string
  save: (data: string) => Promise<void>
}

let currentFileHandle: any = null

export function getCurrentFileHandle() {
  return currentFileHandle
}
export function setCurrentFileHandle(handle: any) {
  currentFileHandle = handle
}

export default function MenuBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const animation = useEditorStore((s) => s.animation)
  const setAnimation = useEditorStore((s) => s.setAnimation)
  const showLayers = useEditorStore((s) => s.showLayers)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const resetView = useEditorStore((s) => s.resetView)

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

  const undo = () => useEditorStore.temporal.getState().undo()
  const redo = () => useEditorStore.temporal.getState().redo()
  const temporalState = useEditorStore.temporal.getState()
  const canUndo = temporalState.pastStates.length > 0
  const canRedo = temporalState.futureStates.length > 0

  const handleNew = () => {
    if (animation.elements.length > 0 && !confirm('新建会清空当前内容，是否继续？')) return
    currentFileHandle = null
    setAnimation({
      id: 'anim_new',
      name: '新动画',
      version: '1.0',
      totalTicks: 0,
      loop: false,
      elements: [],
      pushbox: {},
    })
    setOpenMenu(null)
  }

  const handleOpen = async () => {
    try {
      // @ts-ignore - File System Access API
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: '动画文件', accept: { 'application/json': ['.json'] } }],
      })
      const file = await handle.getFile()
      const data = await importAnimation(file)
      currentFileHandle = handle
      setAnimation(data)
      toast.success(`已打开 ${data.name}`)
    } catch (err) {
      // 用户取消或浏览器不支持
    }
    setOpenMenu(null)
  }

  const handleSave = async () => {
    useEditorStore.getState().syncMetadata()
    const anim = useEditorStore.getState().animation
    if (currentFileHandle) {
      try {
        const writable = await currentFileHandle.createWritable()
        const totalTicks = anim.elements.reduce((sum, e) => sum + e.duration, 0)
        const data = { ...anim, totalTicks }
        await writable.write(JSON.stringify(data, null, 2))
        await writable.close()
        toast.success('已保存')
      } catch (err) {
        toast.error('保存失败：' + (err as Error).message)
      }
    } else {
      await handleSaveAs()
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
      const totalTicks = anim.elements.reduce((sum, e) => sum + e.duration, 0)
      const data = { ...anim, totalTicks }
      await writable.write(JSON.stringify(data, null, 2))
      await writable.close()
      currentFileHandle = handle
      toast.success('已另存为')
    } catch (err) {
      // 用户取消
    }
    setOpenMenu(null)
  }

  const handleExport = () => {
    exportAnimation(animation)
    setOpenMenu(null)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importAnimation(file)
      setAnimation(data)
      toast.success(`已导入 ${data.name}`)
    } catch (err) {
      toast.error('导入失败：' + (err as Error).message)
    }
    e.target.value = ''
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-card px-2" ref={menuRef}>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>文件</MenubarTrigger>
          <MenubarContent>
            <MenubarItem id="menu-new" onClick={handleNew}>
              新建 <MenubarShortcut>Ctrl+N</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-open" onClick={handleOpen}>
              打开... <MenubarShortcut>Ctrl+O</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem id="menu-save" onClick={handleSave}>
              保存 <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem id="menu-saveas" onClick={handleSaveAs}>
              另存为... <MenubarShortcut>Ctrl+Shift+S</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={() => fileInputRef.current?.click()}>导入 JSON...</MenubarItem>
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
    </div>
  )
}
