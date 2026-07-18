import { useEditorStore } from '../store/editorStore'

/**
 * 坐标转换工具
 *
 * 逻辑坐标系：角色锚点为原点 (0,0)，Y 向上为正
 * 屏幕坐标系：画布左上角为原点 (0,0)，Y 向下为正
 *
 * 转换关系：
 *   screenX = originX + gameX * scale
 *   screenY = originY - gameY * scale
 *   gameX = (screenX - originX) / scale
 *   gameY = (originY - screenY) / scale
 */

export function useCoordinateTransform() {
  const originX = useEditorStore((s) => s.originX)
  const originY = useEditorStore((s) => s.originY)
  const scale = useEditorStore((s) => s.scale)

  return {
    /** 逻辑坐标 → 屏幕坐标 */
    toScreen: (gameX: number, gameY: number): [number, number] => [
      originX + gameX * scale,
      originY - gameY * scale,
    ],
    /** 屏幕坐标 → 逻辑坐标 */
    toGame: (screenX: number, screenY: number): [number, number] => [
      (screenX - originX) / scale,
      (originY - screenY) / scale,
    ],
    scale,
  }
}

/** 不依赖 React hook 的纯函数版本（给事件处理用） */
export function toScreen(gameX: number, gameY: number): [number, number] {
  const { originX, originY, scale } = useEditorStore.getState()
  return [originX + gameX * scale, originY - gameY * scale]
}

export function toGame(screenX: number, screenY: number): [number, number] {
  const { originX, originY, scale } = useEditorStore.getState()
  return [(screenX - originX) / scale, (originY - screenY) / scale]
}

/** 逻辑尺寸 → 屏幕尺寸 */
export function toScreenSize(size: number): number {
  return size * useEditorStore.getState().scale
}

/** 屏幕尺寸 → 逻辑尺寸 */
export function toGameSize(size: number): number {
  return size / useEditorStore.getState().scale
}
