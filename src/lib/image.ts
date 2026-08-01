import { importSpriteFile } from './project'
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
  const anim = useEditorStore.getState().animation
  return importSpriteFile(rootHandle, file, anim.id, fileHandle)
}
