import { AnimationData, AnimElement, SpriteSource } from '../types/animation'

// ============================================================================
// IndexedDB 持久化目录句柄（跨会话恢复工程）
// FileSystemDirectoryHandle 可被结构化克隆，因此能直接存进 IndexedDB。
// ============================================================================

const DB_NAME = 'animation-editor'
const STORE_NAME = 'handles'
const WORKSPACE_ROOT_KEY = 'workspace-root'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 保存工作区根目录句柄到 IndexedDB */
export async function saveWorkspaceHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, WORKSPACE_ROOT_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** 从 IndexedDB 读取工作区根目录句柄（可能已失效，需 queryPermission 验证） */
export async function loadWorkspaceHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(WORKSPACE_ROOT_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return handle
}

/** 清除持久化的工作区句柄 */
export async function clearWorkspaceHandle(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(WORKSPACE_ROOT_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// ============================================================================
// 近期打开文件列表（跨会话恢复）
// 每条记录连带存它的工作区目录句柄，打开时一并恢复，确保图片相对路径可解析。
// ============================================================================

const RECENT_FILES_KEY = 'recent-files'
/** 近期列表最大条数 */
export const RECENT_FILES_MAX = 10

export interface RecentFile {
  /** 动画 json 文件句柄 */
  fileHandle: FileSystemFileHandle
  /** 文件名，如 anim_200.json */
  fileName: string
  /** 该文件所属的工作区目录句柄（打开时一并恢复） */
  workspaceHandle: FileSystemDirectoryHandle
  /** 工作区目录名，用于菜单展示区分同名文件 */
  workspaceName: string
  /** 最后打开时间戳（ms） */
  lastOpenedAt: number
}

/** 读取近期打开文件列表 */
export async function loadRecentFiles(): Promise<RecentFile[]> {
  const db = await openDb()
  const list = await new Promise<RecentFile[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(RECENT_FILES_KEY)
    req.onsuccess = () => resolve((req.result as RecentFile[]) ?? [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return list
}

/** 写入近期打开文件列表（整体覆盖） */
export async function saveRecentFiles(list: RecentFile[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(list, RECENT_FILES_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// ============================================================================
// 句柄权限（File System Access API）
// 持久化的句柄在新会话首次使用前需重新授权；requestPermission 必须在用户手势中调用。
// ============================================================================

/** 请求句柄权限，返回是否可用。不支持权限 API 时假设可用。 */
export async function ensurePermission(
  handle: FileSystemHandle,
  mode: 'read' | 'readwrite'
): Promise<boolean> {
  const h = handle as any
  if (!h.queryPermission) return true
  const perm = await h.queryPermission({ mode })
  if (perm === 'granted') return true
  if (perm === 'prompt') {
    const req = await h.requestPermission({ mode })
    return req === 'granted'
  }
  return false // denied
}

// ============================================================================
// 工程目录文件操作
// ============================================================================

/** 把动画名转成文件夹安全的 slug（仅保留字母数字下划线连字符） */
export function slugify(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/_+/g, '_')
  return s || 'anim'
}

/** 递归创建子目录，返回最深层目录句柄。relPath 如 "sprites/stand" */
export async function ensureDir(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string
): Promise<FileSystemDirectoryHandle> {
  const parts = relPath.split('/').filter(Boolean)
  let handle = rootHandle
  for (const part of parts) {
    handle = await handle.getDirectoryHandle(part, { create: true })
  }
  return handle
}

/** 若 fileHandle 在 rootHandle 内，返回相对路径（如 "sprites/stand/x.png"）；否则返回 null */
export async function resolveRelativeIfInside(
  rootHandle: FileSystemDirectoryHandle,
  fileHandle: FileSystemFileHandle
): Promise<string | null> {
  try {
    const path = await rootHandle.resolve(fileHandle)
    return path ? path.join('/') : null
  } catch {
    return null
  }
}

/** 读 File 为 HTMLImageElement 并获取尺寸 */
function readImageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      URL.revokeObjectURL(url)
      resolve({ w, h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

/** 同名冲突时加后缀 _1, _2 ... */
async function uniqueFileName(
  dirHandle: FileSystemDirectoryHandle,
  name: string
): Promise<string> {
  if (!(await dirHandle.getFileHandle(name).catch(() => null))) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}_${i}${ext}`
    if (!(await dirHandle.getFileHandle(candidate).catch(() => null))) return candidate
  }
  return `${base}_${Date.now()}${ext}`
}

/**
 * 把外部图片复制进工程目录的 sprites/<animSlug>/ 下，返回相对 src + 尺寸。
 * 若 fileHandle 已在工程内（用户手动放好），直接算相对路径不复制。
 */
export async function importSpriteFile(
  rootHandle: FileSystemDirectoryHandle,
  file: File,
  animSlug: string,
  fileHandle?: FileSystemFileHandle
): Promise<{ src: string; w: number; h: number }> {
  // 情况 1：文件已在工程目录内 → 直接引用相对路径
  if (fileHandle) {
    const rel = await resolveRelativeIfInside(rootHandle, fileHandle)
    if (rel) {
      const { w, h } = await readImageSize(file)
      return { src: rel, w, h }
    }
  }

  // 情况 2：外部文件 → 复制进 sprites/<animSlug>/
  const dir = await ensureDir(rootHandle, `sprites/${animSlug}`)
  const name = await uniqueFileName(dir, file.name)
  const writable = await dir.getFileHandle(name, { create: true }).then((h) => h.createWritable())
  await writable.write(await file.arrayBuffer())
  await writable.close()
  const { w, h } = await readImageSize(file)
  return { src: `sprites/${animSlug}/${name}`, w, h }
}

/** 按 src 从工程目录读出 File */
export async function readSpriteFile(
  rootHandle: FileSystemDirectoryHandle,
  src: string
): Promise<File> {
  const parts = src.split('/')
  const fileName = parts.pop()!
  const dir = await ensureDir(rootHandle, parts.join('/'))
  const fileHandle = await dir.getFileHandle(fileName)
  return fileHandle.getFile()
}

/** 保存 anim.json 到工程根，文件名用动画 id */
export async function saveAnimJson(
  rootHandle: FileSystemDirectoryHandle,
  animId: string,
  json: string
): Promise<void> {
  const fileName = `${animId}.json`
  const fileHandle = await rootHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(json)
  await writable.close()
}

/**
 * 扫描工程根目录，找到动画 JSON 文件并加载。
 * 单动画工程模型下工程根应只有一个 anim_*.json（或任意 *.json）。
 * 返回 { fileName, data } 或 null（空工程）。
 */
export async function loadAnimFromProject(
  rootHandle: FileSystemDirectoryHandle
): Promise<{ fileName: string; data: AnimationData } | null> {
  const candidates: { name: string; isAnim: boolean }[] = []
  // @ts-ignore - 异步迭代器
  for await (const entry of rootHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.json')) {
      candidates.push({ name: entry.name, isAnim: entry.name.startsWith('anim_') })
    }
  }
  if (candidates.length === 0) return null
  // 优先 anim_*.json，其次任意 *.json
  candidates.sort((a, b) => Number(b.isAnim) - Number(a.isAnim))
  for (const c of candidates) {
    try {
      const fileHandle = await rootHandle.getFileHandle(c.name)
      const file = await fileHandle.getFile()
      const text = await file.text()
      const data = JSON.parse(text) as AnimationData
      if (data && Array.isArray(data.elements)) {
        return { fileName: c.name, data }
      }
    } catch {
      // 跳过解析失败的文件
    }
  }
  return null
}

/** 从工程根读取指定动画 JSON 文件 */
export async function readAnimJson(
  rootHandle: FileSystemDirectoryHandle,
  fileName: string
): Promise<string> {
  const fileHandle = await rootHandle.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  return file.text()
}

// ============================================================================
// 旧 base64 JSON 迁移
// ============================================================================

/** data URL → Blob */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',')
  const mime = meta.match(/data:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** 从文件名提取扩展名 */
function extFromName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot) : '.png'
}

/**
 * 把旧 base64 动画数据迁移到工程目录：
 * 遍历每帧，把 sprite.data（base64）写成文件到 sprites/<animSlug>/，
 * 替换为相对 src，返回新动画数据。
 * 兼容字段：旧 sprite 有 path+data，新 sprite 只有 src+w+h。
 */
export async function migrateBase64Sprites(
  rootHandle: FileSystemDirectoryHandle,
  animation: AnimationData,
  animSlug: string
): Promise<AnimationData> {
  const dir = await ensureDir(rootHandle, `sprites/${animSlug}`)
  const elements: AnimElement[] = []
  for (let i = 0; i < animation.elements.length; i++) {
    const el = animation.elements[i]
    // 新格式（已有 src）直接保留
    if ((el.sprite as any).src && !(el.sprite as any).data) {
      elements.push({ ...el, sprite: { ...el.sprite, x: el.sprite.x ?? 0, y: el.sprite.y ?? 0 } })
      continue
    }
    // 旧格式（有 data base64）→ 写盘
    const oldSprite = el.sprite as any
    if (!oldSprite.data) {
      // 无图帧
      elements.push({ ...el, sprite: { src: '', x: 0, y: 0, w: oldSprite.w ?? 0, h: oldSprite.h ?? 0 } })
      continue
    }
    const blob = dataUrlToBlob(oldSprite.data)
    const baseName = (oldSprite.path as string) || `frame_${i}`
    const ext = extFromName(baseName)
    const base = extFromName(baseName) === baseName ? `frame_${i}` : baseName.slice(0, -ext.length)
    const name = await uniqueFileName(dir, `${base}${ext}`)
    const writable = await dir.getFileHandle(name, { create: true }).then((h) => h.createWritable())
    await writable.write(await blob.arrayBuffer())
    await writable.close()
    const sprite: SpriteSource = { src: `sprites/${animSlug}/${name}`, x: 0, y: 0, w: oldSprite.w, h: oldSprite.h }
    elements.push({ ...el, sprite })
  }
  return { ...animation, elements }
}

/** 判断动画数据是否含旧 base64 格式（需迁移） */
export function needsMigration(animation: AnimationData): boolean {
  return animation.elements.some((el) => !!(el.sprite as any).data)
}
