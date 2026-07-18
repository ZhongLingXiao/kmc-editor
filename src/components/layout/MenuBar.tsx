import { useRef, useState, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { exportAnimation, importAnimation } from '../../utils/export'
import { Tool } from '../../types/animation'

interface FileHandle {
  name: string
  save: (data: string) => Promise<void>
}

// 全局文件句柄（保存当前打开的文件）
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
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)

  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭菜单
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

  // === 文件操作 ===

  // 新建
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

  // 打开（File System Access API）
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
    } catch (err) {
      // 用户取消或浏览器不支持
    }
    setOpenMenu(null)
  }

  // 保存（Ctrl+S）- 如果已有文件句柄则直接写入，否则另存为
  const handleSave = async () => {
    // 保存前把编辑器设置写入 metadata
    useEditorStore.getState().syncMetadata()
    const anim = useEditorStore.getState().animation

    if (currentFileHandle) {
      try {
        const writable = await currentFileHandle.createWritable()
        const totalTicks = anim.elements.reduce((sum, e) => sum + e.duration, 0)
        const data = { ...anim, totalTicks }
        await writable.write(JSON.stringify(data, null, 2))
        await writable.close()
      } catch (err) {
        alert('保存失败：' + (err as Error).message)
      }
    } else {
      await handleSaveAs()
    }
    setOpenMenu(null)
  }

  // 另存为
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
    } catch (err) {
      // 用户取消
    }
    setOpenMenu(null)
  }

  // 导出（下载，不用 File System API）
  const handleExport = () => {
    exportAnimation(animation)
    setOpenMenu(null)
  }

  // === 菜单定义 ===
  const menus: Record<string, { label: string; action: () => void; shortcut?: string; disabled?: boolean; id?: string }[]> = {
    文件: [
      { label: '新建', action: handleNew, shortcut: 'Ctrl+N', id: 'menu-new' },
      { label: '打开...', action: handleOpen, shortcut: 'Ctrl+O', id: 'menu-open' },
      { label: '保存', action: handleSave, shortcut: 'Ctrl+S', id: 'menu-save' },
      { label: '另存为...', action: handleSaveAs, shortcut: 'Ctrl+Shift+S', id: 'menu-saveas' },
      { label: '导出（下载）', action: handleExport, id: 'menu-export' },
    ],
    编辑: [
      { label: '撤销', action: undo, shortcut: 'Ctrl+Z', disabled: !canUndo, id: 'menu-undo' },
      { label: '重做', action: redo, shortcut: 'Ctrl+Y', disabled: !canRedo, id: 'menu-redo' },
    ],
  }

  return (
    <div className="menubar" ref={menuRef}>
      {Object.entries(menus).map(([menuName, items]) => (
        <div
          key={menuName}
          className={`menu-item ${openMenu === menuName ? 'active' : ''}`}
          onClick={() => setOpenMenu(openMenu === menuName ? null : menuName)}
          onMouseEnter={() => openMenu && setOpenMenu(menuName)}
        >
          {menuName}
          {openMenu === menuName && (
            <div className="menu-dropdown">
              {items.map((item, i) => (
                <div
                  key={i}
                  id={item.id}
                  className={`menu-dropdown-item ${item.disabled ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!item.disabled) item.action()
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {/* 工具栏 */}
      <div className="menu-tools">
        {([
          { id: 'select', label: '选择', icon: '↖' },
          { id: 'hurtbox', label: '受击框', icon: '▣' },
          { id: 'hitbox', label: '攻击框', icon: '⚔' },
          { id: 'jcbox', label: 'JC框', icon: '◈' },
          { id: 'pushbox', label: '推挤框', icon: '▭' },
          { id: 'spawnpoint', label: '发射点', icon: '●' },
          { id: 'anchor', label: '图片对齐', icon: '✥' },
        ] as { id: Tool; label: string; icon: string }[]).map((t) => (
          <button
            key={t.id}
            className={`tool-button tool-${t.id} ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />
      <span className="toolbar-label">{animation.name} ({animation.elements.length} 帧)</span>
    </div>
  )
}
