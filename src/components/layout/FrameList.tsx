import { useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'

export default function FrameList() {
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const setFrame = useEditorStore((s) => s.setFrame)
  const removeFrame = useEditorStore((s) => s.removeFrame)
  const duplicateFrame = useEditorStore((s) => s.duplicateFrame)
  const loadSprite = useEditorStore((s) => s.loadSprite)
  const addFrame = useEditorStore((s) => s.addFrame)

  const spriteInputRef = useRef<HTMLInputElement>(null)
  const pendingFrameIndex = useRef<number>(-1)

  const handleLoadSprite = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || pendingFrameIndex.current < 0) return

    // 读取为 base64 data URL，存入 JSON 可直接加载显示
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        // path 存原始文件名方便识别，data 存 base64 供引擎加载
        loadSprite(pendingFrameIndex.current, file.name, dataUrl, img.width, img.height)
      }
      img.onerror = () => alert('图片加载失败')
      img.src = dataUrl
    }
    reader.onerror = () => alert('图片读取失败')
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="left-panel">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>帧列表</span>
        <button onClick={addFrame} style={{ fontSize: 11, padding: '2px 8px' }}>+ 添加帧</button>
      </div>
      <input
        ref={spriteInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleLoadSprite}
      />
      <div className="frame-list">
        {animation.elements.length === 0 && (
          <div style={{ padding: '20px', color: '#666', fontSize: 12, textAlign: 'center' }}>
            没有帧
            <br />
            点击上方"+ 添加帧"
          </div>
        )}
        {animation.elements.map((elem, i) => (
          <div
            key={i}
            className={`frame-item ${i === currentFrameIndex ? 'active' : ''}`}
            onClick={() => setFrame(i)}
          >
            <span className="frame-number">{i}</span>
            <div
              className="frame-thumbnail"
              style={{
                backgroundImage: elem.sprite.data ? `url(${elem.sprite.data})` : 'none',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            />
            <div className="frame-info">
              <div>{elem.duration} Tick</div>
              <div className="frame-duration">
                {elem.sprite.w > 0 ? `${elem.sprite.w}×${elem.sprite.h}` : '无图片'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 帧操作 */}
      {currentFrameIndex >= 0 && (
        <div style={{ padding: '8px', borderTop: '1px solid #333', display: 'flex', gap: 4 }}>
          <button
            onClick={() => {
              pendingFrameIndex.current = currentFrameIndex
              spriteInputRef.current?.click()
            }}
            style={{ flex: 1 }}
          >
            载入图
          </button>
          <button onClick={() => duplicateFrame(currentFrameIndex)}>复制</button>
          <button
            onClick={() => removeFrame(currentFrameIndex)}
            disabled={animation.elements.length <= 1}
          >
            删除
          </button>
        </div>
      )}
    </div>
  )
}
