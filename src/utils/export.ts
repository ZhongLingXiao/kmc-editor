import { AnimationData } from '../types/animation'

/** 导出动画数据为 JSON 文件 */
export function exportAnimation(animation: AnimationData): void {
  const totalTicks = animation.elements.reduce((sum, e) => sum + e.duration, 0)
  const data = { ...animation, totalTicks }

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
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
