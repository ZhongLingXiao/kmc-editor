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

/** 生成唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 创建空帧 */
function createEmptyElement(index: number): AnimElement {
  return {
    index,
    sprite: { path: '', data: '', w: 0, h: 0 },
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

/** 创建默认动画 */
function createDefaultAnimation(): AnimationData {
  return {
    id: 'anim_new',
    name: '新动画',
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
  showLayers: ShowLayers
  onionSkin: OnionSkinSettings
  settingsOpen: string[] // 设置面板 Accordion 展开项（编辑器态，持久跨 tab 切换）
  frameListMode: 'detail' | 'compact' // 帧列表显示模式（编辑器态）

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

  // === Actions: 动画管理 ===
  setAnimation: (data: AnimationData) => void
  updateAnimationMeta: (meta: Partial<Pick<AnimationData, 'id' | 'name' | 'loop'>>) => void

  // === Actions: 帧管理 ===
  addFrame: () => void
  removeFrame: (index: number) => void
  duplicateFrame: (index: number) => void
  setFrame: (index: number) => void
  moveFrame: (from: number, to: number) => void
  updateFrame: (index: number, data: Partial<AnimElement>) => void
  loadSprite: (index: number, path: string, data: string, w: number, h: number) => void
  // 移动播放头到指定 tick（currentFrameIndex 随之派生）
  setCurrentTick: (tick: number) => void

  // === Actions: 碰撞箱管理 ===
  addBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', box: Omit<Box, 'id'>) => string
  updateBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', id: string, data: Partial<Box>) => void
  removeBox: (type: 'hurtbox' | 'hitbox' | 'jcbox', id: string) => void
  selectBox: (type: 'hurtbox' | 'hitbox' | 'jcbox' | 'pushbox' | 'spawnpoint' | null, id: string | null) => void

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
  updateOnionSkin: (settings: Partial<OnionSkinSettings>) => void
  syncMetadata: () => void
  setSettingsOpen: (open: string[]) => void
  setFrameListMode: (mode: 'detail' | 'compact') => void

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
      showLayers: {
        hurtbox: true,
        hitbox: true,
        jcbox: true,
        pushbox: true,
        spawnpoint: true,
        onionSkin: true,
        onionBoxes: true,
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

      settingsOpen: ['anim', 'onion', 'display'],
      frameListMode: 'detail',

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

      // === 动画管理 ===
      setAnimation: (data) =>
        set((s) => ({
          animation: data,
          currentFrameIndex: data.elements.length > 0 ? 0 : -1,
          currentTick: 0,
          // 从文件恢复编辑器设置
          onionSkin: data.editor?.onionSkin ?? s.onionSkin,
          showLayers: data.editor?.showLayers ?? s.showLayers,
        })),

      updateAnimationMeta: (meta) =>
        set((s) => ({ animation: { ...s.animation, ...meta } })),

      // === 帧管理 ===
      addFrame: () =>
        set((s) => {
          const elements = [...s.animation.elements]
          const newIndex = elements.length

          // 从当前帧继承所有数据（box、发射点、轴点），只清空精灵图
          const prev = s.currentFrameIndex >= 0 ? elements[s.currentFrameIndex] : null
          const newElement: AnimElement = prev
            ? {
                ...prev,
                index: newIndex,
                sprite: { path: '', data: '', w: 0, h: 0 },
                // 深拷贝 box 和发射点，生成新 ID 避免冲突
                hurtboxes: prev.hurtboxes.map((b) => ({ ...b, id: genId() })),
                hitboxes: prev.hitboxes.map((b) => ({ ...b, id: genId() })),
                jcboxes: prev.jcboxes.map((b) => ({ ...b, id: genId() })),
                spawnPoints: prev.spawnPoints.map((p) => ({ ...p, id: genId() })),
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
          return { currentFrameIndex: index, currentTick: frameStartTick(s.animation.elements, index) }
        }),

      // 移动播放头：currentFrameIndex 由 tick 派生，可在帧内任意 tick 停留
      setCurrentTick: (tick) =>
        set((s) => {
          if (s.animation.elements.length === 0) return { currentTick: 0, currentFrameIndex: -1 }
          const clamped = Math.max(0, Math.min(s.animation.totalTicks, tick))
          return { currentTick: clamped, currentFrameIndex: findFrameIndex(s.animation.elements, clamped) }
        }),

      moveFrame: (from, to) =>
        set((s) => {
          if (from === to || from < 0 || to < 0) return s
          const arr = [...s.animation.elements]
          const [moved] = arr.splice(from, 1)
          arr.splice(to, 0, moved)
          // 不可变更新 index，避免污染旧 state 的撤销快照
          const elements = arr.map((e, i) => ({ ...e, index: i }))
          return { animation: { ...s.animation, elements } }
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

      loadSprite: (index, path, data, w, h) =>
        set((s) => {
          const elements = [...s.animation.elements]
          if (!elements[index]) return s
          elements[index] = {
            ...elements[index],
            sprite: { path, data, w, h },
            offset: { x: Math.round(w / 2), y: h }, // 默认精灵轴点：图片底部中心对齐固定角色根点
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
          return { animation: { ...s.animation, elements }, selectedBoxId: id, selectedBoxType: type }
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
          return { animation: { ...s.animation, elements }, selectedBoxId: null, selectedBoxType: null }
        }),

      selectBox: (type, id) => set({ selectedBoxType: type, selectedBoxId: id }),

      // === Pushbox ===
      setPushbox: (type, box) =>
        set((s) => {
          const pushbox = { ...s.animation.pushbox }
          if (box === null) {
            delete pushbox[type]
          } else {
            pushbox[type] = { ...box, id: `push_${type}` }
          }
          const removedSelectedPushbox = box === null && s.selectedBoxType === 'pushbox' && s.selectedBoxId === `push_${type}`
          return {
            animation: { ...s.animation, pushbox },
            ...(removedSelectedPushbox ? { selectedBoxId: null, selectedBoxType: null } : {}),
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
          return { animation: { ...s.animation, elements } }
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
