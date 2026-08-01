import { create } from 'zustand'
import {
  loadWorkspaceHandle,
  saveWorkspaceHandle,
} from '../lib/project'
import { clearSpriteCache } from '../lib/spriteResolver'
import { useEditorStore } from './editorStore'
import { normalizeAnimationData, buildExportData } from '../utils/export'
import { saveAnimJson } from '../lib/project'
import type { AnimationData } from '../types/animation'

interface ProjectState {
  /** 工作区根目录句柄（持久化在 IndexedDB），所有动画 json 与 sprites 都在其下 */
  workspaceHandle: FileSystemDirectoryHandle | null
  /** 工作区文件夹名，仅用于显示 */
  workspaceName: string
  /** 是否已设定工作区 */
  hasWorkspace: boolean
  /** 当前正在编辑的动画 id（null 表示尚未新建/打开任何动画） */
  currentAnimId: string | null

  /** 设定/修改工作区根目录（持久化） */
  setWorkspace: (handle: FileSystemDirectoryHandle) => Promise<void>
  /** 新建动画：创建空动画并立即在工作区下写入 <name>.json */
  createAnimation: (name: string) => Promise<void>
  /** 打开动画：读 json 文件加载动画数据 */
  openAnimation: (fileHandle: FileSystemFileHandle) => Promise<void>
  /** 启动时从 IndexedDB 恢复工作区根 */
  restoreWorkspace: () => Promise<void>
}

function createAnimationNamed(name: string): AnimationData {
  return {
    id: name,
    name,
    version: '1.0',
    totalTicks: 0,
    loop: false,
    elements: [],
    pushbox: {},
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  workspaceHandle: null,
  workspaceName: '',
  hasWorkspace: false,
  currentAnimId: null,

  setWorkspace: async (handle) => {
    await saveWorkspaceHandle(handle)
    clearSpriteCache()
    set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true })
  },

  createAnimation: async (name) => {
    const workspaceHandle = get().workspaceHandle
    if (!workspaceHandle) {
      throw new Error('请先设定工作区目录')
    }
    const anim = createAnimationNamed(name)
    useEditorStore.getState().setAnimation(anim)
    set({ currentAnimId: name })
    // 立即在工作区下创建 json 文件，使新建即可见
    const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
    await saveAnimJson(workspaceHandle, name, JSON.stringify(data, null, 2))
  },

  openAnimation: async (fileHandle) => {
    const file = await fileHandle.getFile()
    const text = await file.text()
    const raw = JSON.parse(text) as AnimationData
    const data = normalizeAnimationData(raw)
    useEditorStore.getState().setAnimation(data)
    set({ currentAnimId: data.id })
  },

  restoreWorkspace: async () => {
    const handle = await loadWorkspaceHandle()
    if (!handle) return
    const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' })
    if (perm === 'granted') {
      clearSpriteCache()
      set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true })
    } else if (perm === 'prompt') {
      const req = await (handle as any).requestPermission?.({ mode: 'readwrite' })
      if (req === 'granted') {
        clearSpriteCache()
        set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true })
      }
    }
  },
}))
