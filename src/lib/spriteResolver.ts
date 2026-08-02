import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { readSpriteFile } from './project'

// ============================================================================
// 精灵图解析 + 缓存
// key = sprite.src（相对工程根的路径），value = { image, blobUrl }
// 切换工程时 clearSpriteCache() 释放所有 blobURL。
// ============================================================================

interface CacheEntry {
  image: HTMLImageElement | undefined  // undefined = 加载中
  blobUrl: string | null
  error: boolean
}

const cache = new Map<string, CacheEntry>()

// 预裁剪缓存：key = `${src}|${x},${y},${w},${h}`，value = 裁好的小 canvas。
// 渲染时直接 drawImage 小 canvas，避免每帧从大 sheet 反复 crop。
const regionCache = new Map<string, HTMLCanvasElement>()

/** 同步获取缓存的精灵图，未加载或加载中返回 undefined，并触发异步加载 */
export function getSprite(src: string): HTMLImageElement | undefined {
  if (!src) return undefined
  const rootHandle = useProjectStore.getState().workspaceHandle
  if (!rootHandle) return undefined

  const cached = cache.get(src)
  if (cached) {
    if (cached.error) return undefined
    return cached.image
  }

  // 未缓存，触发异步加载
  cache.set(src, { image: undefined, blobUrl: null, error: false })
  void loadSprite(src, rootHandle)
  return undefined
}

/**
 * 预裁剪：取 sheet 中 {x,y,w,h} 区域裁到独立小 canvas 并缓存。
 * 渲染时用小 canvas 而非大图 crop，避免每帧 drawImage 大图。
 * 大图未加载时返回 undefined（getSprite 会触发加载，加载完靠 useSprite 事件重渲染）。
 */
export function getSpriteRegion(
  src: string,
  x: number,
  y: number,
  w: number,
  h: number
): HTMLCanvasElement | undefined {
  if (!src || w <= 0 || h <= 0) return undefined
  const key = `${src}|${x},${y},${w},${h}`
  const cached = regionCache.get(key)
  if (cached) return cached
  const img = getSprite(src)
  if (!img) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w))
  canvas.height = Math.max(1, Math.round(h))
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  regionCache.set(key, canvas)
  return canvas
}

async function loadSprite(src: string, rootHandle: FileSystemDirectoryHandle) {
  try {
    const file = await readSpriteFile(rootHandle, src)
    const blobUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      cache.set(src, { image, blobUrl, error: false })
      window.dispatchEvent(new CustomEvent('sprite-loaded', { detail: { src } }))
    }
    image.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      cache.set(src, { image: undefined, blobUrl: null, error: true })
      window.dispatchEvent(new CustomEvent('sprite-loaded', { detail: { src } }))
    }
    image.src = blobUrl
  } catch (err) {
    cache.set(src, { image: undefined, blobUrl: null, error: true })
    window.dispatchEvent(new CustomEvent('sprite-loaded', { detail: { src } }))
  }
}

/** React hook 版本：当前帧用，监听加载完成事件自动重渲染 */
export function useSprite(src: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    if (!src) {
      setImg(undefined)
      return
    }
    const entry = cache.get(src)
    if (entry?.image) {
      setImg(entry.image)
      return
    }
    // 触发加载（getSprite 内部会处理）
    getSprite(src)
    setImg(undefined)
  }, [src])

  // 监听其他地方加载完成的事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.src === src) {
        const entry = cache.get(src)
        if (entry?.image) setImg(entry.image)
      } else {
        // 其他 src 加载完成也触发重渲染（洋葱皮等场景）
        forceUpdate((n) => n + 1)
      }
    }
    window.addEventListener('sprite-loaded', handler)
    return () => window.removeEventListener('sprite-loaded', handler)
  }, [src])

  return img
}

/** 取 src 对应的 blobURL（供 CSS backgroundImage 用）。未加载返回 null。 */
export function useSpriteBlobUrl(src: string): string | null {
  useSprite(src) // 复用加载逻辑
  const entry = cache.get(src)
  return entry?.blobUrl ?? null
}

/** 切换工程 / 关闭工程时清空缓存，释放所有 blobURL */
export function clearSpriteCache(): void {
  for (const entry of cache.values()) {
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl)
  }
  cache.clear()
  regionCache.clear()
}
