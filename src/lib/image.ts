/**
 * 读取图片文件为 dataURL 并获取尺寸。
 * 供拖拽导入 / 文件选择共用。
 */
export function readImageFile(file: File): Promise<{ path: string; data: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => resolve({ path: file.name, data: dataUrl, w: img.width, h: img.height })
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = dataUrl
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}
