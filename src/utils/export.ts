import { AnimationData, SHOW_LAYER_KEYS, ShowLayers } from '../types/animation'

/** 规范化 showLayers：只保留 SHOW_LAYER_KEYS 中的字段，剥离过期字段，缺失字段补默认 true */
function normalizeShowLayers(sl: Partial<Record<string, boolean>> | undefined): ShowLayers {
  return Object.fromEntries(
    SHOW_LAYER_KEYS.map((k) => [k, sl?.[k] ?? true])
  ) as ShowLayers
}

/** 构建导出数据。includeEditor=false 时剥离 editor 元数据（纯动画数据）。 */
export function buildExportData(animation: AnimationData, includeEditor: boolean = true): Record<string, unknown> {
  const totalTicks = animation.elements.reduce((sum, e) => sum + e.duration, 0)
  const { editor, ...rest } = animation
  if (!includeEditor || !editor) return { ...rest, totalTicks }
  return {
    ...rest,
    totalTicks,
    editor: {
      ...editor,
      showLayers: normalizeShowLayers(editor.showLayers),
    },
  }
}

/** 导出动画数据为 JSON 文件。includeEditor=false 时剥离 editor 元数据（纯动画数据）。 */
export function exportAnimation(animation: AnimationData, includeEditor: boolean = true): void {
  const data = buildExportData(animation, includeEditor)
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${animation.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/** 从 JSON 文件导入动画数据 */
export function importAnimation(file: File): Promise<AnimationData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AnimationData
        // 确保每个元素有 spawnPoints 数组（向后兼容）
        data.elements = data.elements.map((el) => ({
          ...el,
          spawnPoints: el.spawnPoints || [],
          hurtboxes: el.hurtboxes || [],
          hitboxes: el.hitboxes || [],
          jcboxes: el.jcboxes || [],
        }))
        // 规范化 editor.showLayers：只保留 SHOW_LAYER_KEYS 中的字段，剥离过期字段
        if (data.editor?.showLayers) {
          data.editor.showLayers = normalizeShowLayers(data.editor.showLayers)
        }
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
