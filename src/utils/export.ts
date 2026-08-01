import { AnimationData, SHOW_LAYER_KEYS, ShowLayers } from '../types/animation'

/** 规范化 showLayers：只保留 SHOW_LAYER_KEYS 中的字段，剥离过期字段，缺失字段补默认 true */
function normalizeShowLayers(sl: Partial<Record<string, boolean>> | undefined): ShowLayers {
  return Object.fromEntries(
    SHOW_LAYER_KEYS.map((k) => [k, sl?.[k] ?? true])
  ) as ShowLayers
}

/** 构建导出数据。includeEditor=false 时剥离 editor 元数据（纯动画数据）。
 *  同时剥离 sprite 上的临时迁移字段（_legacyData/_legacyPath），只导出 src+w+h。
 */
export function buildExportData(animation: AnimationData, includeEditor: boolean = true): Record<string, unknown> {
  const totalTicks = animation.elements.reduce((sum, e) => sum + e.duration, 0)
  const { editor, ...rest } = animation
  // 清理 sprite 上的临时迁移字段，只保留 src/x/y/w/h
  const cleanElements = rest.elements.map((el) => {
    const s = el.sprite as any
    return { ...el, sprite: { src: s.src ?? '', x: s.x ?? 0, y: s.y ?? 0, w: s.w ?? 0, h: s.h ?? 0 } }
  })
  const base = { ...rest, elements: cleanElements, totalTicks }
  if (!includeEditor || !editor) return base
  return {
    ...base,
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

/** 规范化动画数据：补全字段、兼容旧 base64 sprite 格式。
 *  旧格式 sprite 有 path+data，新 sprite 只有 src+w+h；
 *  旧格式导入后 sprite._legacyData 保留（用 as any 访问），由迁移函数写盘后清除。
 */
export function normalizeAnimationData(data: AnimationData): AnimationData {
  data.elements = data.elements.map((el) => {
    const sprite = el.sprite as any
    let newSprite
    if (sprite.data && !sprite.src) {
      newSprite = { src: '', x: 0, y: 0, w: sprite.w ?? 0, h: sprite.h ?? 0, _legacyData: sprite.data, _legacyPath: sprite.path }
    } else if (sprite.src) {
      newSprite = { src: sprite.src, x: sprite.x ?? 0, y: sprite.y ?? 0, w: sprite.w ?? 0, h: sprite.h ?? 0 }
    } else {
      newSprite = { src: '', x: 0, y: 0, w: 0, h: 0 }
    }
    return {
      ...el,
      sprite: newSprite,
      spawnPoints: el.spawnPoints || [],
      hurtboxes: el.hurtboxes || [],
      hitboxes: el.hitboxes || [],
      jcboxes: el.jcboxes || [],
    }
  })
  if (data.editor?.showLayers) {
    data.editor.showLayers = normalizeShowLayers(data.editor.showLayers)
  }
  return data
}

/** 从 JSON 文件导入动画数据 */
export function importAnimation(file: File): Promise<AnimationData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as AnimationData
        resolve(normalizeAnimationData(data))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
