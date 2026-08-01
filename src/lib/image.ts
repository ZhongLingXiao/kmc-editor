import { importSpriteFile, ensurePermission } from './project'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'

export interface ImportResult {
  src: string
  w: number
  h: number
}

/**
 * 把用户选/拖入的图片导入到工作区目录，返回相对 src + 尺寸。
 * 必须先设定工作区，否则抛错（由调用方提示用户先设定工作区）。
 * fileHandle 可选：若来自 showOpenFilePicker，传入可判断是否已在工作区内避免重复拷贝。
 */
export async function importImageToProject(
  file: File,
  fileHandle?: FileSystemFileHandle
): Promise<ImportResult> {
  const rootHandle = useProjectStore.getState().workspaceHandle
  if (!rootHandle) {
    throw new Error('请先设定工作区目录')
  }
  // 启动恢复的工作区可能尚未授权，首次导入时请求权限
  const ok = await ensurePermission(rootHandle, 'readwrite')
  if (!ok) {
    throw new Error('工作区权限被拒绝')
  }
  const anim = useEditorStore.getState().animation
  return importSpriteFile(rootHandle, file, anim.id, fileHandle)
}

/** 过滤图片并按文件名自然排序（walk_1 排在 walk_10 之前） */
export function sortImageFiles(files: File[]): File[] {
  return files
    .filter((f) => f.type.startsWith('image/'))
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    )
}

/**
 * 批量导入多张图片（单帧序列）：过滤+排序后逐张导入工作区，返回结果列表。
 * 调用方负责按结果创建帧（第一帧复用当前空帧或新建，其余追加末尾）。
 */
export async function importSpritesBatch(files: File[]): Promise<ImportResult[]> {
  const imgs = sortImageFiles(files)
  const results: ImportResult[] = []
  for (const f of imgs) {
    results.push(await importImageToProject(f))
  }
  return results
}
