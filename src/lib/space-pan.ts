// 协调空格键：轻点 = 播放/暂停；按住 + 拖拽 = 平移画布。
// CanvasArea 在按住空格拖拽时把 panned 置 true，App 的 keyup 据此决定是否切换播放。
export const spaceState = {
  held: false,
  panned: false,
  downAt: 0,
}
