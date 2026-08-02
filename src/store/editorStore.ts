import { create } from 'zustand'
import { temporal } from 'zundo'
import {
  AnimationData,
  AnimElement,
  Box,
  SpawnPoint,
  Tool,
  ShowLayers,
  OnionSkinSettings,
} from '../types/animation'

/** 稳定空数组：用于 set 时避免每帧创建新 [] 引用触发订阅者 re-render */
const EMPTY_IDS: string[] = []

/** 生成唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 创建空帧 */
function createEmptyElement(index: number): AnimElement {
  return {
    index,
    sprite: { src: '', x: 0, y: 0, w: 0, h: 0 },
    duration: 1,
    offset: { x: 0, y: 0 },
    hurtboxes: [],
    hitboxes: [],
    jcboxes: [],
    spawnPoints: [],
  }
}

/** 计算某帧的起始 tick（帧索引之前的所有帧 duration 之和） */
function frameStartTick(elements: AnimElement[], index: number): number {
  let acc = 0
  for (let i = 0; i < index && i < elements.length; i++) {
    acc += elements[i].duration
  }
  return acc
}

/** 根据 tick 找到所属帧索引（playhead 落点对应的动画帧） */
function findFrameIndex(elements: AnimElement[], tick: number): number {
  if (elements.length === 0) return -1
  let acc = 0
  for (let i = 0; i < elements.length; i++) {
    if (tick < acc + elements[i].duration) return i
    acc += elements[i].duration
  }
  return elements.length - 1 // 到达/超过末尾，落在最后一帧
}

/** 查找某 id 对应的对象类型（用于多选时回退主选） */
type SelectableType = 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint'
function findTypeId(animation: AnimationData, frameIndex: number, id: string): SelectableType | null {
  const frame = animation.elements[frameIndex]
  if (!frame) return null
  if (frame.hurtboxes.some((b) => b.id === id)) return 'hurtbox'
  if (frame.hitboxes.some((b) => b.id === id)) return 'hitbox'
  if (frame.jcboxes.some((b) => b.id === id)) return 'jcbox'
  if (frame.spawnPoints.some((p) => p.id === id)) return 'spawnpoint'
  if (animation.pushbox.stand?.id === id) return 'pushbox'
  return null
}

/** 根据当前选区计算主选（最后操作项）；preferred 优先，否则取末尾 */
function primaryFromIds(
  animation: AnimationData,
  frameIndex: number,
  ids: string[],
  preferredId: string | null,
  preferredType: SelectableType | null
): { id: string | null; type: SelectableType | null } {
  if (preferredId && ids.includes(preferredId)) {
    return { id: preferredId, type: preferredType ?? findTypeId(animation, frameIndex, preferredId) }
  }
  if (ids.length === 0) return { id: null, type: null }
  const id = ids[ids.length - 1]
  return { id, type: findTypeId(animation, frameIndex, id) }
}

/** 跨帧对应规格：框按类型内索引、发射点按名字、推挤框全局唯一 */
type SelSpec =
  | { kind: 'box'; type: 'hurtbox' | 'hitbox' | 'jcbox'; index: number }
  | { kind: 'spawn'; name: string }
  | { kind: 'push' }

/** 把锚点帧上的 selectedIds 解析为跨帧对应规格 */
function resolveSpecs(animation: AnimationData, anchorFrameIndex: number, ids: string[]): SelSpec[] {
  const frame = animation.elements[anchorFrameIndex]
  const specs: SelSpec[] = []
  if (!frame) return specs
  for (const id of ids) {
    let i = frame.hurtboxes.findIndex((b) => b.id === id)
    if (i >= 0) { specs.push({ kind: 'box', type: 'hurtbox', index: i }); continue }
    i = frame.hitboxes.findIndex((b) => b.id === id)
    if (i >= 0) { specs.push({ kind: 'box', type: 'hitbox', index: i }); continue }
    i = frame.jcboxes.findIndex((b) => b.id === id)
    if (i >= 0) { specs.push({ kind: 'box', type: 'jcbox', index: i }); continue }
    const sp = frame.spawnPoints.find((p) => p.id === id)
    if (sp) { specs.push({ kind: 'spawn', name: sp.name }); continue }
    if (animation.pushbox.stand?.id === id) { specs.push({ kind: 'push' }); continue }
  }
  return specs
}

/** 操作要作用的帧集：选中帧 ∪ 当前帧（锚点始终包含），过滤越界 */
function targetFrames(selectedFrameIndices: number[], currentFrameIndex: number, len: number): number[] {
  const set = new Set<number>(selectedFrameIndices)
  if (currentFrameIndex >= 0) set.add(currentFrameIndex)
  return Array.from(set).filter((i) => i >= 0 && i < len)
}

/** 按 specs 在单帧上应用：boxFn/spawnFn 返回新对象或 null（null=删除） */
function applySpecsToFrame(
  frame: AnimElement,
  specs: SelSpec[],
  boxFn: (b: Box, type: 'hurtbox' | 'hitbox' | 'jcbox') => Box | null,
  spawnFn: (p: SpawnPoint) => SpawnPoint | null
): AnimElement {
  const boxIdx = (type: 'hurtbox' | 'hitbox' | 'jcbox') =>
    new Set(specs.filter((s) => s.kind === 'box' && s.type === type).map((s) => (s as { index: number }).index))
  const spawnNames = new Set(specs.filter((s) => s.kind === 'spawn').map((s) => (s as { name: string }).name))
  const mapBox = (list: Box[], type: 'hurtbox' | 'hitbox' | 'jcbox') => {
    const idxs = boxIdx(type)
    if (idxs.size === 0) return list
    const out: Box[] = []
    list.forEach((b, i) => {
      if (idxs.has(i)) {
        const r = boxFn(b, type)
        if (r !== null) out.push(r)
      } else out.push(b)
    })
    return out
  }
  let spawnPoints = frame.spawnPoints
  if (spawnNames.size > 0) {
    const out: SpawnPoint[] = []
    frame.spawnPoints.forEach((p) => {
      if (spawnNames.has(p.name)) {
        const r = spawnFn(p)
        if (r !== null) out.push(r)
      } else out.push(p)
    })
    spawnPoints = out
  }
  return {
    ...frame,
    hurtboxes: mapBox(frame.hurtboxes, 'hurtbox'),
    hitboxes: mapBox(frame.hitboxes, 'hitbox'),
    jcboxes: mapBox(frame.jcboxes, 'jcbox'),
    spawnPoints,
  }
}

/** 创建默认动画 */
function createDefaultAnimation(): AnimationData {
  return {
    id: 'anim_new',
    name: 'New Animation',
    version: '1.0',
    totalTicks: 0,
    loop: false,
    elements: [],
    pushbox: {},
  }
}

interface EditorState {
  // === 动画数据 ===
  animation: AnimationData
  currentFrameIndex: number
  currentTick: number // 播放头所在的 tick（帧索引由此派生）

  // === 编辑状态 ===
  tool: Tool
  selectedBoxId: string | null
  selectedBoxType: 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint' | null
  selectedIds: string[] // 多选：全部选中对象 id（跨类型），主选 = 最后操作项
  selectedFrameIndices: number[] // 多选：选中的帧（元素操作按对应关系传播到这些帧）
  showLayers: ShowLayers
  onionSkin: OnionSkinSettings
  settingsOpen: string[] // 设置面板 Accordion 展开项（编辑器态，持久跨 tab 切换）
  frameListMode: 'detail' | 'compact' // 帧列表显示模式（编辑器态）
  newFrameInheritBoxes: boolean // 新帧是否继承源帧碰撞箱与发射点（编辑器态）
  newFrameInheritOffset: boolean // 新帧是否继承源帧轴点（编辑器态）
  saveEditorMetadata: boolean // 导出时是否写入 editor 元数据（编辑器态）

  // === 预览状态 ===
  isPlaying: boolean
  playSpeed: number
  previewLoop: boolean // 预览循环（编辑器态，不进 animation 数据、不进撤销历史、不导出）
  fps: number // 播放实时帧率（编辑器态，仅显示用）

  // === 画布状态 ===
  canvasWidth: number
  canvasHeight: number
  originX: number // 逻辑原点在画布上的 X（屏幕坐标），受 panX 影响
  originY: number // 逻辑原点在画布上的 Y（屏幕坐标），受 panY 影响
  scale: number
  panX: number // 画布平移偏移 X
  panY: number // 画布平移偏移 Y
  gridSize: number // 网格单元尺寸（逻辑像素，编辑器态，不进撤销历史）

  // === Actions: 动画管理 ===
  setAnimation: (data: AnimationData) => void
  updateAnimationMeta: (meta: Partial<Pick<AnimationData, 'id' | 'name' | 'loop'>>) => void

  // === Actions: 帧管理 ===
  addFrame: (sourceIndex?: number) => void
  insertFrame: (at: number, sourceIndex: number) => void
  removeFrame: (index: number) => void
  duplicateFrame: (index: number) => void
  setFrame: (index: number) => void
  moveFrame: (from: number, to: number) => void
  updateFrame: (index: number, data: Partial<AnimElement>) => void
  /** 将源帧的轴点与四类框（受击/攻击/JC/发射点）覆盖应用到目标帧，保留目标帧的 sprite 与 duration */
  applyFrameToFrames: (sourceIndex: number, targetIndices: number[]) => void
  loadSprite: (index: number, src: string, x: number, y: number, w: number, h: number) => void
  // 移动播放头到指定 tick（currentFrameIndex 随之派生）
  setCurrentTick: (tick: number) => void

  // === Actions: 碰撞箱管理 ===
  addBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', box: Omit<Box, 'id'>) => string
  updateBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', id: string, data: Partial<Box>) => void
  removeBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', id: string) => void
  selectBox: (type: 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint' | null, id: string | null) => void
  toggleSelection: (type: 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint', id: string) => void
  selectRange: (ids: string[], primaryId: string, primaryType: 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint') => void
  clearSelection: () => void
  moveSelected: (dx: number, dy: number) => void
  removeSelected: () => void
  setSelectedField: (field: 'x' | 'y' | 'w' | 'h', value: number) => void
  renameSelectedSpawnPoint: (newName: string) => void
  toggleFrameSelection: (index: number) => void
  selectFrameRange: (indices: number[]) => void
  clearFrameSelection: () => void
  setSelectedFramesDuration: (value: number) => void
  setSelectedFramesOffset: (x: number, y: number) => void
  applyOffsetPresetToSelectedFrames: (preset: 'foot' | 'center') => void
  removeSelectedFrames: () => void

  // === Actions: Pushbox ===
  setPushbox: (type: 'stand' | 'crouch' | 'air', box: Omit<Box, 'id'> | null) => void
  updatePushbox: (type: 'stand' | 'crouch' | 'air', data: Partial<Box>) => void

  // === Actions: 发射点 ===
  addSpawnPoint: (point: Omit<SpawnPoint, 'id'>) => string
  updateSpawnPoint: (id: string, data: Partial<SpawnPoint>) => void
  removeSpawnPoint: (id: string) => void

  // === Actions: 锚点 ===
  setOffset: (index: number, x: number, y: number) => void

  // === Actions: 工具/图层 ===
  setTool: (tool: Tool) => void
  toggleLayer: (layer: keyof ShowLayers) => void
  setLayers: (keys: (keyof ShowLayers)[], value: boolean) => void
  updateOnionSkin: (settings: Partial<OnionSkinSettings>) => void
  syncMetadata: () => void
  setSettingsOpen: (open: string[]) => void
  setFrameListMode: (mode: 'detail' | 'compact') => void
  setNewFrameInheritBoxes: (inherit: boolean) => void
  setNewFrameInheritOffset: (inherit: boolean) => void
  setSaveEditorMetadata: (save: boolean) => void

  // === Actions: 预览 ===
  setPlaying: (playing: boolean) => void
  setPlaySpeed: (speed: number) => void
  togglePreviewLoop: () => void
  setFps: (fps: number) => void

  // === Actions: 画布 ===
  setCanvasSize: (w: number, h: number) => void
  setScale: (scale: number) => void
  setPan: (x: number, y: number) => void
  resetView: () => void
  setGridSize: (size: number) => void
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      // === 初始状态 ===
      animation: createDefaultAnimation(),
      currentFrameIndex: -1,
      currentTick: 0,

      tool: 'select',
      selectedBoxId: null,
      selectedBoxType: null,
      selectedIds: [],
      selectedFrameIndices: [],
      showLayers: {
        hurtbox: true,
        hitbox: true,
        jcbox: true,
        pushbox: true,
        spawnpoint: true,
        onionSkin: true,
        grid: true,
      },

      onionSkin: {
        prevFrames: 1,
        nextFrames: 0,
        baseOpacity: 0.8,
        decayRate: 0.5,
        prevColor: '#0096ff',
        nextColor: '#ff5050',
        showSprite: true,
        showBoxes: true,
      },

      settingsOpen: ['anim'],
      frameListMode: 'detail',
      newFrameInheritBoxes: true,
      newFrameInheritOffset: true,
      saveEditorMetadata: true,

      isPlaying: false,
      playSpeed: 1,
      previewLoop: false,
      fps: 0,

      canvasWidth: 800,
      canvasHeight: 600,
      originX: 400,
      originY: 450,
      scale: 1,
      panX: 0,
      panY: 0,
      gridSize: 20,

      // === 动画管理 ===
      setAnimation: (data) => {
        set((s) => ({
          animation: data,
          currentFrameIndex: data.elements.length > 0 ? 0 : -1,
          currentTick: 0,
          // 从文件恢复编辑器设置
          onionSkin: data.editor?.onionSkin ?? s.onionSkin,
          showLayers: data.editor?.showLayers ?? s.showLayers,
          selectedIds: [],
          selectedBoxId: null,
          selectedBoxType: null,
          selectedFrameIndices: data.elements.length > 0 ? [0] : [],
        }))
        // 载入/新建/导入是全新起点：清空撤销历史，避免 Ctrl+Z 回退到打开前
        useEditorStore.temporal.getState().clear()
      },

      updateAnimationMeta: (meta) =>
        set((s) => ({ animation: { ...s.animation, ...meta } })),

      // === 帧管理 ===
      addFrame: (sourceIndex) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const newIndex = elements.length

          // 继承源帧数据：轴点与碰撞箱/发射点分别由两个开关控制，精灵图 src 继承（多帧可共用同一张图，磁盘只一份）
          const srcIdx = sourceIndex ?? s.currentFrameIndex
          const prev = srcIdx >= 0 ? elements[srcIdx] : null
          const inheritOffset = s.newFrameInheritOffset
          const inheritBoxes = s.newFrameInheritBoxes
          const newElement: AnimElement =
            prev && (inheritOffset || inheritBoxes)
              ? {
                  ...prev,
                  index: newIndex,
                  sprite: { src: prev.sprite.src, x: prev.sprite.x, y: prev.sprite.y, w: prev.sprite.w, h: prev.sprite.h },
                  offset: inheritOffset ? prev.offset : { x: 0, y: 0 },
                  hurtboxes: inheritBoxes ? prev.hurtboxes.map((b) => ({ ...b, id: genId() })) : [],
                  hitboxes: inheritBoxes ? prev.hitboxes.map((b) => ({ ...b, id: genId() })) : [],
                  jcboxes: inheritBoxes ? prev.jcboxes.map((b) => ({ ...b, id: genId() })) : [],
                  spawnPoints: inheritBoxes ? prev.spawnPoints.map((p) => ({ ...p, id: genId() })) : [],
                }
              : createEmptyElement(newIndex)

          elements.push(newElement)
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentFrameIndex: newIndex,
            currentTick: s.animation.totalTicks, // 新帧的起始 tick = 旧总 tick
          }
        }),

      removeFrame: (index) =>
        set((s) => {
          if (s.animation.elements.length <= 1) return s
          const elements = s.animation.elements
            .filter((_, i) => i !== index)
            .map((e, i) => ({ ...e, index: i }))
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          const newIndex = Math.min(s.currentFrameIndex, elements.length - 1)
          const newTick = Math.min(s.currentTick, Math.max(0, totalTicks - 1))
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentFrameIndex: Math.max(0, newIndex),
            currentTick: newTick,
            selectedIds: [],
            selectedBoxId: null,
            selectedBoxType: null,
            selectedFrameIndices: [Math.max(0, newIndex)],
          }
        }),

      insertFrame: (at, sourceIndex) =>
        set((s) => {
          const elements = s.animation.elements
          const clampedAt = Math.max(0, Math.min(at, elements.length))
          // 继承源帧数据：轴点与碰撞箱/发射点分别由两个开关控制，精灵图 src 继承，重新生成 ID
          const src = elements[sourceIndex] ?? elements[clampedAt] ?? null
          const inheritOffset = s.newFrameInheritOffset
          const inheritBoxes = s.newFrameInheritBoxes
          const newElement: AnimElement =
            src && (inheritOffset || inheritBoxes)
              ? {
                  ...src,
                  index: clampedAt,
                  sprite: { src: src.sprite.src, x: src.sprite.x, y: src.sprite.y, w: src.sprite.w, h: src.sprite.h },
                  offset: inheritOffset ? src.offset : { x: 0, y: 0 },
                  hurtboxes: inheritBoxes ? src.hurtboxes.map((b) => ({ ...b, id: genId() })) : [],
                  hitboxes: inheritBoxes ? src.hitboxes.map((b) => ({ ...b, id: genId() })) : [],
                  jcboxes: inheritBoxes ? src.jcboxes.map((b) => ({ ...b, id: genId() })) : [],
                  spawnPoints: inheritBoxes ? src.spawnPoints.map((p) => ({ ...p, id: genId() })) : [],
                }
              : createEmptyElement(clampedAt)
          const newElements = [
            ...elements.slice(0, clampedAt),
            newElement,
            ...elements.slice(clampedAt),
          ].map((e, i) => ({ ...e, index: i }))
          const totalTicks = newElements.reduce((sum, e) => sum + e.duration, 0)
          return {
            animation: { ...s.animation, elements: newElements, totalTicks },
            currentFrameIndex: clampedAt,
            currentTick: frameStartTick(newElements, clampedAt),
          }
        }),

      duplicateFrame: (index) =>
        set((s) => {
          const source = s.animation.elements[index]
          if (!source) return s
          const copy: AnimElement = {
            ...source,
            hurtboxes: source.hurtboxes.map((b) => ({ ...b, id: genId() })),
            hitboxes: source.hitboxes.map((b) => ({ ...b, id: genId() })),
            jcboxes: source.jcboxes.map((b) => ({ ...b, id: genId() })),
            spawnPoints: source.spawnPoints.map((p) => ({ ...p, id: genId() })),
          }
          // 不可变更新：重新生成所有元素的 index，避免就地修改旧 state 的元素污染撤销快照
          const elements = [
            ...s.animation.elements.slice(0, index + 1),
            copy,
            ...s.animation.elements.slice(index + 1),
          ].map((e, i) => ({ ...e, index: i }))
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentFrameIndex: index + 1,
            currentTick: frameStartTick(elements, index + 1),
          }
        }),

      setFrame: (index) =>
        set((s) => {
          if (index < 0 || index >= s.animation.elements.length) return s
          return { currentFrameIndex: index, currentTick: frameStartTick(s.animation.elements, index), selectedIds: [], selectedBoxId: null, selectedBoxType: null, selectedFrameIndices: [index] }
        }),

      applyFrameToFrames: (sourceIndex, targetIndices) =>
        set((s) => {
          const source = s.animation.elements[sourceIndex]
          if (!source || targetIndices.length === 0) return s
          const targets = new Set(targetIndices)
          const elements = s.animation.elements.map((el, i) => {
            // 跳过非目标帧与源帧自身（避免无意义自覆盖）
            if (!targets.has(i) || i === sourceIndex) return el
            return {
              ...el,
              offset: { ...source.offset },
              hurtboxes: source.hurtboxes.map((b) => ({ ...b, id: genId() })),
              hitboxes: source.hitboxes.map((b) => ({ ...b, id: genId() })),
              jcboxes: source.jcboxes.map((b) => ({ ...b, id: genId() })),
              spawnPoints: source.spawnPoints.map((p) => ({ ...p, id: genId() })),
            }
          })
          // duration 未变，totalTicks 不变；清空选区避免选中已被替换的旧框 id
          return {
            animation: { ...s.animation, elements },
            selectedIds: [],
            selectedBoxId: null,
            selectedBoxType: null,
          }
        }),

      // 移动播放头：currentFrameIndex 由 tick 派生，可在帧内任意 tick 停留
      setCurrentTick: (tick) =>
        set((s) => {
          if (s.animation.elements.length === 0) return { currentTick: 0, currentFrameIndex: -1, selectedIds: [], selectedBoxId: null, selectedBoxType: null, selectedFrameIndices: [] }
          const clamped = Math.max(0, Math.min(s.animation.totalTicks, tick))
          const newFrame = findFrameIndex(s.animation.elements, clamped)
          // 帧变化时清空选区与帧多选，避免选中别帧对象。
          // 用稳定 EMPTY_IDS 避免每帧创建新 [] 引用触发订阅者 re-render。
          if (newFrame !== s.currentFrameIndex) {
            return { currentTick: clamped, currentFrameIndex: newFrame, selectedIds: EMPTY_IDS, selectedBoxId: null, selectedBoxType: null, selectedFrameIndices: [newFrame] }
          }
          return { currentTick: clamped, currentFrameIndex: newFrame }
        }),

      moveFrame: (from, to) =>
        set((s) => {
          if (from === to || from < 0 || to < 0 || from >= s.animation.elements.length || to >= s.animation.elements.length) return s
          const arr = [...s.animation.elements]
          const [moved] = arr.splice(from, 1)
          arr.splice(to, 0, moved)
          // 不可变更新 index，避免污染旧 state 的撤销快照
          const elements = arr.map((e, i) => ({ ...e, index: i }))
          // 跟随当前帧：移动的是当前帧 → 索引变为 to；当前帧在移动区间内 → 相应增减
          let newFrameIndex = s.currentFrameIndex
          if (s.currentFrameIndex === from) newFrameIndex = to
          else if (from < s.currentFrameIndex && to >= s.currentFrameIndex) newFrameIndex = s.currentFrameIndex - 1
          else if (from > s.currentFrameIndex && to <= s.currentFrameIndex) newFrameIndex = s.currentFrameIndex + 1
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentFrameIndex: newFrameIndex,
            currentTick: frameStartTick(elements, newFrameIndex),
          }
        }),

      updateFrame: (index, data) =>
        set((s) => {
          const elements = [...s.animation.elements]
          if (!elements[index]) return s
          elements[index] = { ...elements[index], ...data }
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          // 时长变化后保证播放头仍在范围内
          const clampedTick = Math.min(s.currentTick, totalTicks)
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentTick: clampedTick,
            currentFrameIndex: findFrameIndex(elements, clampedTick),
          }
        }),

      loadSprite: (index, src, x, y, w, h) =>
        set((s) => {
          const elements = [...s.animation.elements]
          if (!elements[index]) return s
          const old = elements[index]
          // 首次载入（offset 为 0,0）设为底部中心对齐 Root；否则保留现有轴点
          // （含从源帧继承的），避免覆盖用户调整或继承的轴点
          const isFirstLoad = old.offset.x === 0 && old.offset.y === 0
          elements[index] = {
            ...old,
            sprite: { src, x, y, w, h },
            offset: isFirstLoad ? { x: Math.round(w / 2), y: h } : old.offset,
          }
          return { animation: { ...s.animation, elements } }
        }),

      // === 碰撞箱管理 ===
      // 注意：所有更新都必须构造全新的 frame / 数组 / box 对象，不能就地修改旧
      // state 的引用，否则 zundo 的撤销快照会被污染导致 Ctrl+Z 失效。
      addBox: (type, box) => {
        const id = genId()
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          const newBox: Box = { ...box, id }
          const newFrame: AnimElement =
            type === 'hurtbox'
              ? { ...frame, hurtboxes: [...frame.hurtboxes, newBox] }
              : type === 'hitbox'
              ? { ...frame, hitboxes: [...frame.hitboxes, newBox] }
              : { ...frame, jcboxes: [...frame.jcboxes, newBox] }
          elements[s.currentFrameIndex] = newFrame
          return { animation: { ...s.animation, elements }, selectedIds: [id], selectedBoxId: id, selectedBoxType: type }
        })
        return id
      },

      updateBox: (type, id, data) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          const mapList = (list: Box[]) => list.map((b) => (b.id === id ? { ...b, ...data } : b))
          const newFrame: AnimElement =
            type === 'hurtbox'
              ? { ...frame, hurtboxes: mapList(frame.hurtboxes) }
              : type === 'hitbox'
              ? { ...frame, hitboxes: mapList(frame.hitboxes) }
              : { ...frame, jcboxes: mapList(frame.jcboxes) }
          elements[s.currentFrameIndex] = newFrame
          return { animation: { ...s.animation, elements } }
        }),

      removeBox: (type, id) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          const filterList = (list: Box[]) => list.filter((b) => b.id !== id)
          const newFrame: AnimElement =
            type === 'hurtbox'
              ? { ...frame, hurtboxes: filterList(frame.hurtboxes) }
              : type === 'hitbox'
              ? { ...frame, hitboxes: filterList(frame.hitboxes) }
              : { ...frame, jcboxes: filterList(frame.jcboxes) }
          elements[s.currentFrameIndex] = newFrame
          const nextIds = s.selectedIds.filter((x) => x !== id)
          const p = primaryFromIds({ ...s.animation, elements }, s.currentFrameIndex, nextIds, s.selectedBoxId, s.selectedBoxType)
          return { animation: { ...s.animation, elements }, selectedIds: nextIds, selectedBoxId: p.id, selectedBoxType: p.type }
        }),

      selectBox: (type, id) =>
        set({ selectedBoxType: type, selectedBoxId: id, selectedIds: id ? [id] : [] }),

      // 多选：Ctrl 切换某项进出选区，主选 = 最后操作项
      toggleSelection: (type, id) =>
        set((s) => {
          const exists = s.selectedIds.includes(id)
          const next = exists ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id]
          const p = primaryFromIds(
            s.animation,
            s.currentFrameIndex,
            next,
            exists ? null : id,
            exists ? null : type
          )
          return { selectedIds: next, selectedBoxId: p.id, selectedBoxType: p.type }
        }),

      // 多选：Shift 范围选，选区 = ids，主选 = 点击项
      selectRange: (ids, primaryId, primaryType) =>
        set({ selectedIds: ids, selectedBoxId: primaryId, selectedBoxType: primaryType }),

      clearSelection: () => set({ selectedIds: [], selectedBoxId: null, selectedBoxType: null }),

      // 整体平移选中对象：跨所有选中帧按对应关系传播（框按索引/发射点按名字/推挤框全局）
      moveSelected: (dx, dy) =>
        set((s) => {
          if (s.selectedIds.length === 0 || (dx === 0 && dy === 0)) return s
          const specs = resolveSpecs(s.animation, s.currentFrameIndex, s.selectedIds)
          if (specs.length === 0) return s
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          const elements = [...s.animation.elements]
          for (const fi of frames) {
            const f = elements[fi]
            if (!f) continue
            elements[fi] = applySpecsToFrame(f, specs, (b) => ({ ...b, x: b.x + dx, y: b.y + dy }), (p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
          }
          let pushbox = s.animation.pushbox
          if (specs.some((sp) => sp.kind === 'push') && pushbox.stand) {
            pushbox = { ...pushbox, stand: { ...pushbox.stand, x: pushbox.stand.x + dx, y: pushbox.stand.y + dy } }
          }
          return { animation: { ...s.animation, elements, pushbox } }
        }),

      // 删除选中对象：跨所有选中帧按对应关系传播，然后清空选区
      removeSelected: () =>
        set((s) => {
          if (s.selectedIds.length === 0) return s
          const specs = resolveSpecs(s.animation, s.currentFrameIndex, s.selectedIds)
          if (specs.length === 0) return s
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          const elements = [...s.animation.elements]
          for (const fi of frames) {
            const f = elements[fi]
            if (!f) continue
            elements[fi] = applySpecsToFrame(f, specs, () => null, () => null)
          }
          let pushbox = s.animation.pushbox
          if (specs.some((sp) => sp.kind === 'push') && pushbox.stand) {
            pushbox = { ...pushbox }
            delete pushbox.stand
          }
          return {
            animation: { ...s.animation, elements, pushbox },
            selectedIds: [],
            selectedBoxId: null,
            selectedBoxType: null,
          }
        }),

      // 批量设置选中对象某字段（跨帧传播；发射点只设 x/y）
      setSelectedField: (field, value) =>
        set((s) => {
          if (s.selectedIds.length === 0) return s
          const specs = resolveSpecs(s.animation, s.currentFrameIndex, s.selectedIds)
          if (specs.length === 0) return s
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          const elements = [...s.animation.elements]
          const boxFn = (b: Box) => ({ ...b, [field]: value })
          const spawnFn = (p: SpawnPoint) => (field === 'x' || field === 'y' ? { ...p, [field]: value } : p)
          for (const fi of frames) {
            const f = elements[fi]
            if (!f) continue
            elements[fi] = applySpecsToFrame(f, specs, boxFn, spawnFn)
          }
          let pushbox = s.animation.pushbox
          if (specs.some((sp) => sp.kind === 'push') && pushbox.stand) {
            pushbox = { ...pushbox, stand: { ...pushbox.stand, [field]: value } }
          }
          return { animation: { ...s.animation, elements, pushbox } }
        }),

      // 重命名选中发射点（按名字跨帧同步重命名，保持对应关系）
      renameSelectedSpawnPoint: (newName) =>
        set((s) => {
          if (s.selectedIds.length === 0) return s
          const specs = resolveSpecs(s.animation, s.currentFrameIndex, s.selectedIds)
          const names = new Set(specs.filter((sp) => sp.kind === 'spawn').map((sp) => (sp as { name: string }).name))
          if (names.size === 0) return s
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          const elements = [...s.animation.elements]
          for (const fi of frames) {
            const f = elements[fi]
            if (!f) continue
            elements[fi] = { ...f, spawnPoints: f.spawnPoints.map((p) => (names.has(p.name) ? { ...p, name: newName } : p)) }
          }
          return { animation: { ...s.animation, elements } }
        }),

      // 帧多选：Ctrl 切换某帧进出选区，当前帧随之移动到该帧
      toggleFrameSelection: (i) =>
        set((s) => {
          const exists = s.selectedFrameIndices.includes(i)
          const next = exists ? s.selectedFrameIndices.filter((x) => x !== i) : [...s.selectedFrameIndices, i]
          return {
            currentFrameIndex: i,
            currentTick: frameStartTick(s.animation.elements, i),
            selectedFrameIndices: next,
            selectedIds: [],
            selectedBoxId: null,
            selectedBoxType: null,
          }
        }),

      // 帧多选：Shift 范围选，选区 = indices，当前帧（锚点）不变
      selectFrameRange: (indices) =>
        set({
          selectedFrameIndices: indices,
          selectedIds: [],
          selectedBoxId: null,
          selectedBoxType: null,
        }),

      clearFrameSelection: () => set({ selectedFrameIndices: [] }),

      // 批量设置选中帧的 duration
      setSelectedFramesDuration: (value) =>
        set((s) => {
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          if (frames.length === 0) return s
          const v = Math.max(1, Math.round(value))
          const elements = [...s.animation.elements]
          for (const fi of frames) {
            if (elements[fi]) elements[fi] = { ...elements[fi], duration: v }
          }
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          const clampedTick = Math.min(s.currentTick, totalTicks)
          return { animation: { ...s.animation, elements, totalTicks }, currentTick: clampedTick }
        }),

      // 批量设置选中帧的轴点 offset（绝对值，所有选中帧设为同一 x/y）
      setSelectedFramesOffset: (x, y) =>
        set((s) => {
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          if (frames.length === 0) return s
          const elements = [...s.animation.elements]
          for (const fi of frames) {
            if (elements[fi]) elements[fi] = { ...elements[fi], offset: { x, y } }
          }
          return { animation: { ...s.animation, elements } }
        }),

      // 按预设批量设轴点：每帧按各自精灵图尺寸计算（脚底中心/图片中心），无精灵图的帧跳过
      applyOffsetPresetToSelectedFrames: (preset) =>
        set((s) => {
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          if (frames.length === 0) return s
          const elements = [...s.animation.elements]
          let changed = false
          for (const fi of frames) {
            const e = elements[fi]
            if (!e || e.sprite.w <= 0) continue
            const x = Math.round(e.sprite.w / 2)
            const y = preset === 'foot' ? e.sprite.h : Math.round(e.sprite.h / 2)
            elements[fi] = { ...e, offset: { x, y } }
            changed = true
          }
          return changed ? { animation: { ...s.animation, elements } } : s
        }),

      // 批量删除选中帧（至少保留一帧）
      removeSelectedFrames: () =>
        set((s) => {
          if (s.animation.elements.length <= 1) return s
          const frames = targetFrames(s.selectedFrameIndices, s.currentFrameIndex, s.animation.elements.length)
          const toRemove = new Set(frames)
          const remaining = s.animation.elements.filter((_, i) => !toRemove.has(i))
          if (remaining.length === 0) return s
          const elements = remaining.map((e, i) => ({ ...e, index: i }))
          const totalTicks = elements.reduce((sum, e) => sum + e.duration, 0)
          const newIndex = Math.min(s.currentFrameIndex, elements.length - 1)
          const newTick = Math.min(s.currentTick, Math.max(0, totalTicks - 1))
          return {
            animation: { ...s.animation, elements, totalTicks },
            currentFrameIndex: Math.max(0, newIndex),
            currentTick: newTick,
            selectedFrameIndices: [Math.max(0, newIndex)],
            selectedIds: [],
            selectedBoxId: null,
            selectedBoxType: null,
          }
        }),

      // === Pushbox ===
      setPushbox: (type, box) =>
        set((s) => {
          const pushbox = { ...s.animation.pushbox }
          if (box === null) {
            delete pushbox[type]
          } else {
            pushbox[type] = { ...box, id: `push_${type}` }
          }
          const pushId = `push_${type}`
          const removing = box === null
          const nextIds = removing ? s.selectedIds.filter((x) => x !== pushId) : s.selectedIds
          let primaryId = s.selectedBoxId
          let primaryType = s.selectedBoxType
          if (removing && primaryId === pushId) {
            const p = primaryFromIds({ ...s.animation, pushbox }, s.currentFrameIndex, nextIds, null, null)
            primaryId = p.id
            primaryType = p.type
          }
          return {
            animation: { ...s.animation, pushbox },
            selectedIds: nextIds,
            selectedBoxId: primaryId,
            selectedBoxType: primaryType,
          }
        }),

      updatePushbox: (type, data) =>
        set((s) => {
          const pushbox = { ...s.animation.pushbox }
          if (pushbox[type]) {
            pushbox[type] = { ...pushbox[type]!, ...data }
          }
          return { animation: { ...s.animation, pushbox } }
        }),

      // === 发射点 ===
      addSpawnPoint: (point) => {
        const id = genId()
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          elements[s.currentFrameIndex] = {
            ...frame,
            spawnPoints: [...frame.spawnPoints, { ...point, id }],
          }
          return { animation: { ...s.animation, elements } }
        })
        return id
      },

      updateSpawnPoint: (id, data) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          elements[s.currentFrameIndex] = {
            ...frame,
            spawnPoints: frame.spawnPoints.map((p) =>
              p.id === id ? { ...p, ...data } : p
            ),
          }
          return { animation: { ...s.animation, elements } }
        }),

      removeSpawnPoint: (id) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const frame = elements[s.currentFrameIndex]
          if (!frame) return s
          elements[s.currentFrameIndex] = {
            ...frame,
            spawnPoints: frame.spawnPoints.filter((p) => p.id !== id),
          }
          const nextIds = s.selectedIds.filter((x) => x !== id)
          const p = primaryFromIds({ ...s.animation, elements }, s.currentFrameIndex, nextIds, s.selectedBoxId, s.selectedBoxType)
          return { animation: { ...s.animation, elements }, selectedIds: nextIds, selectedBoxId: p.id, selectedBoxType: p.type }
        }),

      // === 精灵轴点 ===
      // 改变图片对齐点时，受击框、攻击框和发射点作为图片子对象同步平移。
      // Pushbox 是角色物理根点的框，因此不跟随单帧图片对齐变化。
      setOffset: (index, x, y) =>
        set((s) => {
          const elements = [...s.animation.elements]
          const previous = elements[index]
          if (!previous) return s

          // 图片在逻辑坐标中的位移：imageX = -pivotX，imageY = pivotY。
          const dx = previous.offset.x - x
          const dy = y - previous.offset.y
          elements[index] = {
            ...previous,
            offset: { x, y },
            hurtboxes: previous.hurtboxes.map((box) => ({
              ...box,
              x: box.x + dx,
              y: box.y + dy,
            })),
            hitboxes: previous.hitboxes.map((box) => ({
              ...box,
              x: box.x + dx,
              y: box.y + dy,
            })),
            jcboxes: previous.jcboxes.map((box) => ({
              ...box,
              x: box.x + dx,
              y: box.y + dy,
            })),
            spawnPoints: previous.spawnPoints.map((point) => ({
              ...point,
              x: point.x + dx,
              y: point.y + dy,
            })),
          }
          return { animation: { ...s.animation, elements } }
        }),

      // === 工具/图层 ===
      setTool: (tool) => set({ tool }),
      toggleLayer: (layer) =>
        set((s) => ({
          showLayers: { ...s.showLayers, [layer]: !s.showLayers[layer] },
        })),
      setLayers: (keys, value) =>
        set((s) => {
          const showLayers = { ...s.showLayers }
          for (const k of keys) showLayers[k] = value
          return { showLayers }
        }),

      updateOnionSkin: (settings) =>
        set((s) => ({
          onionSkin: { ...s.onionSkin, ...settings },
        })),

      // 把洋葱皮和图层设置同步到 animation.editor，保存文件时一起写入
      syncMetadata: () =>
        set((s) => ({
          animation: {
            ...s.animation,
            editor: {
              onionSkin: s.onionSkin,
              showLayers: s.showLayers,
            },
          },
        })),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setFrameListMode: (mode) => set({ frameListMode: mode }),
      setNewFrameInheritBoxes: (inherit) => set({ newFrameInheritBoxes: inherit }),
      setNewFrameInheritOffset: (inherit) => set({ newFrameInheritOffset: inherit }),
      setSaveEditorMetadata: (save) => set({ saveEditorMetadata: save }),

      // === 预览 ===
      setPlaying: (playing) => set({ isPlaying: playing }),
      setPlaySpeed: (speed) => set({ playSpeed: speed }),
      togglePreviewLoop: () => set((s) => ({ previewLoop: !s.previewLoop })),
      setFps: (fps) => set({ fps }),

      // === 画布 ===
      setCanvasSize: (w, h) =>
        set((s) => ({
          canvasWidth: w,
          canvasHeight: h,
          originX: w / 2 + s.panX,
          originY: h * 0.75 + s.panY,
        })),
      setScale: (scale) => set({ scale: Math.max(0.2, Math.min(4, scale)) }),
      setPan: (x, y) =>
        set((s) => ({
          panX: x,
          panY: y,
          originX: s.canvasWidth / 2 + x,
          originY: s.canvasHeight * 0.75 + y,
        })),
      resetView: () =>
        set((s) => ({
          panX: 0,
          panY: 0,
          scale: 1,
          originX: s.canvasWidth / 2,
          originY: s.canvasHeight * 0.75,
        })),
      setGridSize: (size) => set({ gridSize: Math.max(2, Math.round(size)) }),
    }),
    {
      // 撤销/重做配置：只追踪动画数据变化
      partialize: (state) => ({
        animation: state.animation,
      }),
      limit: 100, // 最多100步历史
    }
  )
)
