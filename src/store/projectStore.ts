import { create } from 'zustand'
import {
  loadWorkspaceHandle,
  saveWorkspaceHandle,
  loadRecentFiles,
  saveRecentFiles,
  RECENT_FILES_MAX,
  ensurePermission,
} from '../lib/project'
import type { RecentFile } from '../lib/project'
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
  /** 工作区写权限状态：'granted' 可写 / 'prompt' 需授权 / 'denied' 拒绝 / null 无工作区 */
  permStatus: 'granted' | 'prompt' | 'denied' | null
  /** 近期打开文件列表（持久化在 IndexedDB） */
  recentFiles: RecentFile[]

  /** 设定/修改工作区根目录（持久化） */
  setWorkspace: (handle: FileSystemDirectoryHandle) => Promise<void>
  /** 新建动画：创建空动画并立即在工作区下写入 <name>.json */
  createAnimation: (name: string) => Promise<void>
  /** 打开动画：读 json 文件加载动画数据，并记入近期列表 */
  openAnimation: (fileHandle: FileSystemFileHandle) => Promise<void>
  /** 打开近期列表中的某一项（一并恢复其工作区） */
  openRecentFile: (item: RecentFile) => Promise<void>
  /** 从近期列表移除指定文件（失效清理） */
  removeRecentFile: (fileHandle: FileSystemFileHandle) => Promise<void>
  /** 清空近期列表 */
  clearRecentFiles: () => Promise<void>
  /** 启动时从 IndexedDB 恢复工作区根与近期列表 */
  restoreWorkspace: () => Promise<void>
  /** 重新查询工作区写权限状态并更新 store */
  refreshPermStatus: () => Promise<void>
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
  permStatus: null,
  recentFiles: [],

  setWorkspace: async (handle) => {
    await saveWorkspaceHandle(handle)
    clearSpriteCache()
    // showDirectoryPicker(mode:readwrite) 已获授权
    set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true, permStatus: 'granted' })
  },

  createAnimation: async (name) => {
    const workspaceHandle = get().workspaceHandle
    if (!workspaceHandle) {
      throw new Error('请先设定工作区目录')
    }
    // 启动恢复的工作区可能尚未授权，首次新建时请求写权限（弹窗），与保存一致
    const ok = await ensurePermission(workspaceHandle, 'readwrite')
    set({ permStatus: ok ? 'granted' : 'denied' })
    if (!ok) {
      throw new Error('工作区权限被拒绝')
    }
    const anim = createAnimationNamed(name)
    useEditorStore.getState().setAnimation(anim)
    set({ currentAnimId: name })
    // 立即在工作区下创建 json 文件，使新建即可见
    const data = buildExportData(anim, useEditorStore.getState().saveEditorMetadata)
    const fileHandle = await saveAnimJson(workspaceHandle, name, JSON.stringify(data, null, 2))
    // 新建即记入近期列表，与打开行为一致
    await recordRecentFile(get, set, fileHandle, `${name}.json`)
  },

  openAnimation: async (fileHandle) => {
    const file = await fileHandle.getFile()
    const text = await file.text()
    const raw = JSON.parse(text) as AnimationData
    const data = normalizeAnimationData(raw)
    useEditorStore.getState().setAnimation(data)
    set({ currentAnimId: data.id })
    // 记入近期列表（连带当前工作区句柄，便于跨会话恢复）
    await recordRecentFile(get, set, fileHandle, fileHandle.name)
  },

  openRecentFile: async (item) => {
    // 恢复工作区权限（读+写，因为后续保存要写）
    const wsOk = await ensurePermission(item.workspaceHandle, 'readwrite')
    set({ permStatus: wsOk ? 'granted' : 'denied' })
    if (!wsOk) throw new Error('工作区权限被拒绝')
    // 文件只需读
    const fOk = await ensurePermission(item.fileHandle, 'read')
    if (!fOk) throw new Error('文件权限被拒绝')
    // 先切换工作区，再打开文件（openAnimation 会用当前工作区记录近期）
    await get().setWorkspace(item.workspaceHandle)
    await get().openAnimation(item.fileHandle)
  },

  removeRecentFile: async (fileHandle) => {
    const list = get().recentFiles
    const next: RecentFile[] = []
    for (const item of list) {
      let same = false
      try {
        same = await item.fileHandle.isSameEntry(fileHandle)
      } catch {
        same = false
      }
      if (!same) next.push(item)
    }
    set({ recentFiles: next })
    await saveRecentFiles(next)
  },

  clearRecentFiles: async () => {
    set({ recentFiles: [] })
    await saveRecentFiles([])
  },

  restoreWorkspace: async () => {
    // 同时恢复工作区根与近期列表
    const [handle, recent] = await Promise.all([
      loadWorkspaceHandle(),
      loadRecentFiles(),
    ])
    set({ recentFiles: recent })
    if (!handle) return
    const perm = await (handle as any).queryPermission?.({ mode: 'readwrite' })
    if (perm === 'granted') {
      clearSpriteCache()
      set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true, permStatus: 'granted' })
    } else if (perm === 'prompt') {
      // 启动时无用户手势，requestPermission 通常被拒；保留句柄，首次操作时再请求
      set({ workspaceHandle: handle, workspaceName: handle.name, hasWorkspace: true, permStatus: 'prompt' })
    }
    // perm === 'denied'：不恢复
  },

  refreshPermStatus: async () => {
    const handle = get().workspaceHandle
    if (!handle) { set({ permStatus: null }); return }
    const h = handle as any
    if (!h.queryPermission) { set({ permStatus: 'granted' }); return }
    try {
      const p = await h.queryPermission({ mode: 'readwrite' })
      set({ permStatus: p })
    } catch {
      set({ permStatus: null })
    }
  },
}))

/** 内部：把刚打开的文件记入近期列表（去重 + 刷新时间 + 限数） */
async function recordRecentFile(
  get: () => ProjectState,
  set: (partial: Partial<ProjectState>) => void,
  fileHandle: FileSystemFileHandle,
  fileName: string
): Promise<void> {
  const workspaceHandle = get().workspaceHandle
  if (!workspaceHandle) return // 没工作区不记录（图片无法解析，记录意义不大）
  const list = get().recentFiles
  const filtered: RecentFile[] = []
  for (const item of list) {
    let same = false
    try {
      same = await item.fileHandle.isSameEntry(fileHandle)
    } catch {
      same = false
    }
    if (!same) filtered.push(item)
  }
  const entry: RecentFile = {
    fileHandle,
    fileName,
    workspaceHandle,
    workspaceName: workspaceHandle.name,
    lastOpenedAt: Date.now(),
  }
  const next = [entry, ...filtered].slice(0, RECENT_FILES_MAX)
  set({ recentFiles: next })
  await saveRecentFiles(next)
}
