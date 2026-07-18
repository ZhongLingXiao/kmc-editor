import { useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { exportAnimation, importAnimation } from '../../utils/export'
import { Tool } from '../../types/animation'

export default function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const animation = useEditorStore((s) => s.animation)
  const setAnimation = useEditorStore((s) => s.setAnimation)
  const addFrame = useEditorStore((s) => s.addFrame)

  const undo = () => useEditorStore.temporal.getState().undo()
  const redo = () => useEditorStore.temporal.getState().redo()
  const temporalState = useEditorStore.temporal.getState()
  const canUndo = temporalState.pastStates.length > 0
  const canRedo = temporalState.futureStates.length > 0

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importAnimation(file)
      setAnimation(data)
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    e.target.value = ''
  }

  const tools: { id: Tool; label: string; icon: string }[] = [
    { id: 'select', label: '选择', icon: '↖' },
    { id: 'hurtbox', label: '受击框', icon: '▣' },
    { id: 'hitbox', label: '攻击框', icon: '⚔' },
    { id: 'jcbox', label: 'JC框', icon: '◈' },
    { id: 'pushbox', label: '推挤框', icon: '▭' },
    { id: 'spawnpoint', label: '发射点', icon: '●' },
    { id: 'anchor', label: '图片对齐', icon: '✥' },
  ]

  return (
    <div className="toolbar">
      {/* 文件操作 */}
      <button onClick={() => fileInputRef.current?.click()}>导入</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
      <button onClick={() => exportAnimation(animation)}>导出</button>

      <div className="toolbar-separator" />

      {/* 撤销重做 */}
      <button onClick={undo} disabled={!canUndo} title="Ctrl+Z">撤销</button>
      <button onClick={redo} disabled={!canRedo} title="Ctrl+Y">重做</button>

      <div className="toolbar-separator" />

      {/* 工具选择 */}
      <span className="toolbar-label">工具:</span>
      {tools.map((t) => (
        <button
          key={t.id}
          className={`tool-button tool-${t.id} ${tool === t.id ? 'active' : ''}`}
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          {t.icon} {t.label}
        </button>
      ))}

      <div className="toolbar-separator" />

      {/* 添加帧 */}
      <button onClick={addFrame}>+ 添加帧</button>

      <div style={{ flex: 1 }} />

      {/* 动画名称 */}
      <span className="toolbar-label">{animation.name} ({animation.elements.length} 帧)</span>
    </div>
  )
}
