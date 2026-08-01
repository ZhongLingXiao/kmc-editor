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
}
