import { useEditorStore } from '../../store/editorStore'
import { COLORS } from '../../types/animation'

export default function PropertyPanel() {
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const updateAnimationMeta = useEditorStore((s) => s.updateAnimationMeta)
  const updateFrame = useEditorStore((s) => s.updateFrame)
  const setOffset = useEditorStore((s) => s.setOffset)
  const showLayers = useEditorStore((s) => s.showLayers)
  const onionSkin = useEditorStore((s) => s.onionSkin)
  const updateOnionSkin = useEditorStore((s) => s.updateOnionSkin)
  const toggleLayer = useEditorStore((s) => s.toggleLayer)
  const tool = useEditorStore((s) => s.tool)

  const selectedBoxId = useEditorStore((s) => s.selectedBoxId)
  const selectedBoxType = useEditorStore((s) => s.selectedBoxType)
  const updateBox = useEditorStore((s) => s.updateBox)
  const removeBox = useEditorStore((s) => s.removeBox)
  const updatePushbox = useEditorStore((s) => s.updatePushbox)
  const setPushbox = useEditorStore((s) => s.setPushbox)
  const updateSpawnPoint = useEditorStore((s) => s.updateSpawnPoint)
  const removeSpawnPoint = useEditorStore((s) => s.removeSpawnPoint)

  const frame = currentFrameIndex >= 0 ? animation.elements[currentFrameIndex] : null

  // 选中的碰撞箱
  const selectedBox = (() => {
    if (!frame || !selectedBoxId || !selectedBoxType) return null
    if (selectedBoxType === 'hurtbox') return { type: 'hurtbox' as const, data: frame.hurtboxes.find((b) => b.id === selectedBoxId) }
    if (selectedBoxType === 'hitbox') return { type: 'hitbox' as const, data: frame.hitboxes.find((b) => b.id === selectedBoxId) }
    if (selectedBoxType === 'jcbox') return { type: 'jcbox' as const, data: frame.jcboxes.find((b) => b.id === selectedBoxId) }
    if (selectedBoxType === 'pushbox') return { type: 'pushbox' as const, data: animation.pushbox.stand?.id === selectedBoxId ? animation.pushbox.stand : undefined }
    if (selectedBoxType === 'spawnpoint') return { type: 'spawnpoint' as const, data: frame.spawnPoints.find((p) => p.id === selectedBoxId) }
    return null
  })()
  const selectedPushbox = selectedBox?.type === 'pushbox' ? selectedBox.data : undefined

  return (
    <div className="right-panel">
      {/* 动画属性 */}
      <div className="property-section">
        <div className="property-section-title">动画属性</div>
        <div className="property-row">
          <span className="property-label">ID</span>
          <div className="property-value">
            <input
              type="text"
              value={animation.id}
              onChange={(e) => updateAnimationMeta({ id: e.target.value })}
            />
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">名称</span>
          <div className="property-value">
            <input
              type="text"
              value={animation.name}
              onChange={(e) => updateAnimationMeta({ name: e.target.value })}
            />
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">总帧数</span>
          <span className="property-value">{animation.totalTicks} Tick</span>
        </div>
        <div className="property-row">
          <span className="property-label">循环</span>
          <div className="property-value">
            <input
              type="checkbox"
              checked={animation.loop}
              onChange={(e) => updateAnimationMeta({ loop: e.target.checked })}
            />
          </div>
        </div>
      </div>

      {/* 图层显示 */}
      <div className="property-section">
        <div className="property-section-title">图层显示</div>
        {([
          { key: 'hurtbox' as const, label: '受击框', color: COLORS.hurtbox },
          { key: 'hitbox' as const, label: '攻击框', color: COLORS.hitbox },
          { key: 'jcbox' as const, label: 'JC框', color: COLORS.jcbox },
          { key: 'pushbox' as const, label: '推挤框', color: COLORS.pushbox },
          { key: 'spawnpoint' as const, label: '发射点', color: COLORS.spawnpoint },
          { key: 'onionSkin' as const, label: '洋葱皮', color: 'rgba(128,128,128,0.3)' },
          { key: 'grid' as const, label: '网格', color: COLORS.grid },
        ]).map((layer) => (
          <div key={layer.key} className="layer-toggle">
            <input
              type="checkbox"
              checked={showLayers[layer.key]}
              onChange={() => toggleLayer(layer.key)}
            />
            <div className="layer-color" style={{ background: layer.color }} />
            <span>{layer.label}</span>
          </div>
        ))}
      </div>

      {/* 洋葱皮设置 */}
      <div className="property-section">
        <div className="property-section-title">洋葱皮</div>
        <div className="property-row">
          <span className="property-label">前帧数量</span>
          <div className="property-value">
            <input
              type="number"
              min={0}
              max={5}
              value={onionSkin.prevFrames}
              onChange={(e) => updateOnionSkin({ prevFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
            />
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">后帧数量</span>
          <div className="property-value">
            <input
              type="number"
              min={0}
              max={5}
              value={onionSkin.nextFrames}
              onChange={(e) => updateOnionSkin({ nextFrames: Math.max(0, Math.min(5, parseInt(e.target.value) || 0)) })}
            />
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">透明度</span>
          <div className="property-value">
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={onionSkin.baseOpacity}
              onChange={(e) => updateOnionSkin({ baseOpacity: parseFloat(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{Math.round(onionSkin.baseOpacity * 100)}%</span>
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">衰减率</span>
          <div className="property-value">
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={onionSkin.decayRate}
              onChange={(e) => updateOnionSkin({ decayRate: parseFloat(e.target.value) })}
            />
            <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>{Math.round(onionSkin.decayRate * 100)}%</span>
          </div>
        </div>
        {/* 透明度预览 */}
        <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.6 }}>
          {[onionSkin.prevFrames, 0, onionSkin.nextFrames].map((_, i, arr) => {
            const half = Math.floor(arr.length / 2)
            const d = i - half
            if (d === 0) return <span key={i} style={{ color: '#fff', fontWeight: 600 }}> 当前 </span>
            const op = onionSkin.baseOpacity * Math.pow(onionSkin.decayRate, Math.abs(d) - 1)
            const color = d < 0 ? onionSkin.prevColor : onionSkin.nextColor
            return <span key={i} style={{ color }}>{d < 0 ? '前' : '后'}{Math.abs(d)}:{Math.round(op * 100)}% </span>
          })}
        </div>
        <div className="property-row" style={{ marginTop: 8 }}>
          <span className="property-label">前帧颜色</span>
          <div className="property-value" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={onionSkin.prevColor.startsWith('rgba') ? '#0096ff' : onionSkin.prevColor}
              onChange={(e) => updateOnionSkin({ prevColor: e.target.value })}
              style={{ width: 32, height: 24, border: '1px solid #3a3a3a', borderRadius: 3, cursor: 'pointer', background: 'transparent' }}
            />
            {[
              { label: '蓝', val: '#0096ff' },
              { label: '青', val: '#00ffcc' },
              { label: '绿', val: '#22ff22' },
              { label: '紫', val: '#aa00ff' },
            ].map((c) => (
              <button
                key={c.val}
                onClick={() => updateOnionSkin({ prevColor: c.val })}
                style={{
                  width: 20, height: 20, padding: 0, minWidth: 0,
                  background: c.val, border: onionSkin.prevColor === c.val ? '2px solid #fff' : '1px solid #3a3a3a',
                  borderRadius: 3, cursor: 'pointer',
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="property-row">
          <span className="property-label">后帧颜色</span>
          <div className="property-value" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="color"
              value={onionSkin.nextColor.startsWith('rgba') ? '#ff5050' : onionSkin.nextColor}
              onChange={(e) => updateOnionSkin({ nextColor: e.target.value })}
              style={{ width: 32, height: 24, border: '1px solid #3a3a3a', borderRadius: 3, cursor: 'pointer', background: 'transparent' }}
            />
            {[
              { label: '红', val: '#ff5050' },
              { label: '橙', val: '#ff8800' },
              { label: '黄', val: '#ffdd00' },
              { label: '粉', val: '#ff00aa' },
            ].map((c) => (
              <button
                key={c.val}
                onClick={() => updateOnionSkin({ nextColor: c.val })}
                style={{
                  width: 20, height: 20, padding: 0, minWidth: 0,
                  background: c.val, border: onionSkin.nextColor === c.val ? '2px solid #fff' : '1px solid #3a3a3a',
                  borderRadius: 3, cursor: 'pointer',
                }}
                title={c.label}
              />
            ))}
          </div>
        </div>
        <div className="property-row" style={{ marginTop: 8 }}>
          <span className="property-label">显示内容</span>
        </div>
        <div className="layer-toggle">
          <input type="checkbox" checked={onionSkin.showSprite} onChange={(e) => updateOnionSkin({ showSprite: e.target.checked })} />
          <div className="layer-color" style={{ background: 'rgba(200,200,200,0.5)' }} />
          <span>精灵图</span>
        </div>
        <div className="layer-toggle">
          <input type="checkbox" checked={onionSkin.showBoxes} onChange={(e) => updateOnionSkin({ showBoxes: e.target.checked })} />
          <div className="layer-color" style={{ background: 'rgba(200,200,200,0.5)' }} />
          <span>碰撞箱边框</span>
        </div>
      </div>

      {/* 当前帧属性 */}
      {frame && (
        <div className="property-section">
          <div className="property-section-title">帧 {currentFrameIndex} 属性</div>
          <div className="property-row">
            <span className="property-label">时长</span>
            <div className="property-value">
              <input
                type="number"
                min={1}
                value={frame.duration}
                onChange={(e) => updateFrame(currentFrameIndex, { duration: parseInt(e.target.value) || 1 })}
              />
            </div>
            <span style={{ fontSize: 11, color: '#888' }}>Tick</span>
          </div>
          {frame.sprite.w > 0 && (
            <>
              <div className="property-row">
                <span className="property-label">图片尺寸</span>
                <span className="property-value" style={{ fontSize: 11 }}>
                  {frame.sprite.w}×{frame.sprite.h}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, margin: '4px 0 8px' }}>
                角色根点 <span style={{ color: '#ff5555' }}>Root (0,0)</span> 固定不可编辑。使用“图片对齐”工具拖动图片，或用方向键微调；下方轴点数值会自动更新。
                <br />受击框、攻击框和发射点会随图片同步移动；推挤框保持 Root 坐标。
              </div>
              <div className="property-row">
                <span className="property-label">轴点 X</span>
                <div className="property-value">
                  <input
                    type="number"
                    value={frame.offset.x}
                    onChange={(e) => setOffset(currentFrameIndex, parseInt(e.target.value) || 0, frame.offset.y)}
                  />
                </div>
              </div>
              <div className="property-row">
                <span className="property-label">轴点 Y</span>
                <div className="property-value">
                  <input
                    type="number"
                    value={frame.offset.y}
                    onChange={(e) => setOffset(currentFrameIndex, frame.offset.x, parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button
                  style={{ flex: 1 }}
                  onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), frame.sprite.h)}
                >
                  设为脚底中心
                </button>
                <button
                  style={{ flex: 1 }}
                  onClick={() => setOffset(currentFrameIndex, Math.round(frame.sprite.w / 2), Math.round(frame.sprite.h / 2))}
                >
                  设为图片中心
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 本帧对象列表：用于查看并同步选择当前帧已有的编辑对象。 */}
      {frame && (
        <div className="property-section">
          <div className="property-section-title">本帧对象</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {frame.hurtboxes.map((box, index) => (
              <button
                key={box.id}
                className={selectedBoxId === box.id ? 'active' : ''}
                onClick={() => useEditorStore.getState().selectBox('hurtbox', box.id)}
                style={{ textAlign: 'left', borderLeft: `3px solid ${COLORS.hurtboxBorder}` }}
              >
                <span style={{ color: COLORS.hurtboxBorder, fontWeight: 700 }}>▣</span> 受击框 {index + 1}　X:{box.x} Y:{box.y} W:{box.w} H:{box.h}
              </button>
            ))}
            {frame.hitboxes.map((box, index) => (
              <button
                key={box.id}
                className={selectedBoxId === box.id ? 'active' : ''}
                onClick={() => useEditorStore.getState().selectBox('hitbox', box.id)}
                style={{ textAlign: 'left', borderLeft: `3px solid ${COLORS.hitboxBorder}` }}
              >
                <span style={{ color: COLORS.hitboxBorder, fontWeight: 700 }}>⚔</span> 攻击框 {index + 1}　X:{box.x} Y:{box.y} W:{box.w} H:{box.h}
              </button>
            ))}
            {frame.jcboxes.map((box, index) => (
              <button
                key={box.id}
                className={selectedBoxId === box.id ? 'active' : ''}
                onClick={() => useEditorStore.getState().selectBox('jcbox', box.id)}
                style={{ textAlign: 'left', borderLeft: `3px solid ${COLORS.jcboxBorder}` }}
              >
                <span style={{ color: COLORS.jcboxBorder, fontWeight: 700 }}>◈</span> JC框 {index + 1}　X:{box.x} Y:{box.y} W:{box.w} H:{box.h}
              </button>
            ))}
            {frame.spawnPoints.map((point) => (
              <button
                key={point.id}
                className={selectedBoxId === point.id ? 'active' : ''}
                onClick={() => useEditorStore.getState().selectBox('spawnpoint', point.id)}
                style={{ textAlign: 'left', borderLeft: `3px solid ${COLORS.spawnpoint}` }}
              >
                <span style={{ color: COLORS.spawnpoint, fontWeight: 700 }}>●</span> 发射点 {point.name}　X:{point.x} Y:{point.y}
              </button>
            ))}
            {animation.pushbox.stand && (
              <button
                className={selectedBoxId === animation.pushbox.stand.id ? 'active' : ''}
                onClick={() => useEditorStore.getState().selectBox('pushbox', animation.pushbox.stand!.id)}
                style={{ textAlign: 'left', borderLeft: `3px solid ${COLORS.pushboxBorder}` }}
              >
                <span style={{ color: COLORS.pushboxBorder, fontWeight: 700 }}>▭</span> 推挤框（站立）　X:{animation.pushbox.stand.x} Y:{animation.pushbox.stand.y} W:{animation.pushbox.stand.w} H:{animation.pushbox.stand.h}
              </button>
            )}
            {frame.hurtboxes.length === 0 && frame.hitboxes.length === 0 && frame.spawnPoints.length === 0 && !animation.pushbox.stand && (
              <div style={{ color: '#777', fontSize: 11, padding: '4px 0' }}>当前没有碰撞框或发射点</div>
            )}
          </div>
        </div>
      )}

      {/* 选中碰撞箱属性 */}
      {selectedBox && (selectedBox.type === 'hurtbox' || selectedBox.type === 'hitbox' || selectedBox.type === 'jcbox') && selectedBox.data && (
        <div className="property-section">
          <div className="property-section-title">
            {selectedBox.type === 'hurtbox' ? '受击框' : selectedBox.type === 'hitbox' ? '攻击框' : 'JC框'}
          </div>
          <div className="property-row">
            <span className="property-label">X</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.x}
                onChange={(e) => updateBox(selectedBox.type, selectedBoxId!, { x: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">Y</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.y}
                onChange={(e) => updateBox(selectedBox.type, selectedBoxId!, { y: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">宽</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.w}
                onChange={(e) => updateBox(selectedBox.type, selectedBoxId!, { w: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">高</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.h}
                onChange={(e) => updateBox(selectedBox.type, selectedBoxId!, { h: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <button
            onClick={() => removeBox(selectedBox.type, selectedBoxId!)}
            style={{ width: '100%', marginTop: 6, color: '#ff6666' }}
          >
            删除
          </button>
        </div>
      )}

      {/* 选中推挤框属性：当前原型只编辑站立 Pushbox，坐标相对固定 Root。 */}
      {selectedPushbox && (
        <div className="property-section">
          <div className="property-section-title">推挤框（站立）</div>
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: 8 }}>
            推挤框是角色物理占位，坐标相对固定 Root (0,0)。可拖拽、缩放或直接输入数值。
          </div>
          {(['x', 'y', 'w', 'h'] as const).map((key) => (
            <div key={key} className="property-row">
              <span className="property-label">{{ x: 'X', y: 'Y', w: '宽', h: '高' }[key]}</span>
              <div className="property-value">
                <input
                  type="number"
                  value={selectedPushbox[key]}
                  onChange={(e) => updatePushbox('stand', { [key]: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => setPushbox('stand', null)}
            style={{ width: '100%', marginTop: 6, color: '#ff6666' }}
          >
            删除推挤框
          </button>
        </div>
      )}

      {/* 选中发射点属性 */}
      {selectedBox && selectedBox.type === 'spawnpoint' && selectedBox.data && (
        <div className="property-section">
          <div className="property-section-title">发射点</div>
          <div className="property-row">
            <span className="property-label">名称</span>
            <div className="property-value">
              <input
                type="text"
                value={selectedBox.data.name}
                onChange={(e) => updateSpawnPoint(selectedBoxId!, { name: e.target.value })}
              />
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">X</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.x}
                onChange={(e) => updateSpawnPoint(selectedBoxId!, { x: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="property-row">
            <span className="property-label">Y</span>
            <div className="property-value">
              <input
                type="number"
                value={selectedBox.data.y}
                onChange={(e) => updateSpawnPoint(selectedBoxId!, { y: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <button
            onClick={() => removeSpawnPoint(selectedBoxId!)}
            style={{ width: '100%', marginTop: 6, color: '#ff6666' }}
          >
            删除
          </button>
        </div>
      )}

      {/* 当前帧统计 */}
      {frame && (
        <div className="property-section">
          <div className="property-section-title">帧统计</div>
          <div className="property-row">
            <span className="property-label">受击框</span>
            <span className="property-value">{frame.hurtboxes.length} 个</span>
          </div>
          <div className="property-row">
            <span className="property-label">攻击框</span>
            <span className="property-value">{frame.hitboxes.length} 个</span>
          </div>
          <div className="property-row">
            <span className="property-label">发射点</span>
            <span className="property-value">{frame.spawnPoints.length} 个</span>
          </div>
        </div>
      )}

      {/* 工具提示 */}
      <div className="property-section">
        <div className="property-section-title">快捷键</div>
        <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
          <div>空格 - 播放/暂停</div>
          <div>← → - 切换帧</div>
          <div>Ctrl+Z - 撤销</div>
          <div>Ctrl+Y - 重做</div>
          <div>Delete / Backspace - 删除当前选中对象</div>
          <div>滚轮 - 缩放画布</div>
          {tool !== 'select' && (
            <div style={{ marginTop: 6, color: '#4a9eff' }}>
              当前工具: {tool}
              <br />
              {tool === 'hurtbox' || tool === 'hitbox'
                ? '在画布上拖拽绘制'
                : tool === 'spawnpoint'
                ? '点击画布放置发射点'
                : tool === 'anchor'
                ? '拖动图片进行对齐；方向键微调 1px，Shift+方向键微调 10px'
                : tool === 'pushbox'
                ? '在画布上拖拽拉选推挤框'
                : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
