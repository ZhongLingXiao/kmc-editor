import type { PhaseMarkers, PhaseName } from '../types/animation'

export interface PhaseRange {
  startTick: number
  endTick: number
}

/** 将外部输入规范化为合法的两个阶段边界。 */
export function normalizePhaseMarkers(
  markers: Partial<PhaseMarkers> | null | undefined,
  totalTicks: number
): PhaseMarkers | undefined {
  if (!markers || totalTicks <= 0) return undefined

  const rawStart = Number(markers.activeStartTick)
  const rawEnd = Number(markers.activeEndTick)
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return undefined

  const activeStartTick = Math.max(0, Math.min(totalTicks, Math.round(rawStart)))
  const activeEndTick = Math.max(
    activeStartTick,
    Math.min(totalTicks, Math.round(rawEnd))
  )
  return { activeStartTick, activeEndTick }
}

/** 根据两个边界计算三个连续阶段的 Tick 区间。 */
export function getPhaseRanges(
  markers: PhaseMarkers | undefined,
  totalTicks: number
): Record<PhaseName, PhaseRange> | null {
  const normalized = normalizePhaseMarkers(markers, totalTicks)
  if (!normalized) return null
  return {
    startup: { startTick: 0, endTick: normalized.activeStartTick },
    active: { startTick: normalized.activeStartTick, endTick: normalized.activeEndTick },
    recovery: { startTick: normalized.activeEndTick, endTick: totalTicks },
  }
}

/** 获取某个 Tick 所处的阶段；totalTicks 这个终点本身不属于播放区间。 */
export function phaseAtTick(
  markers: PhaseMarkers | undefined,
  tick: number,
  totalTicks: number
): PhaseName | null {
  if (tick < 0 || tick >= totalTicks) return null
  const normalized = normalizePhaseMarkers(markers, totalTicks)
  if (!normalized) return null
  if (tick < normalized.activeStartTick) return 'startup'
  if (tick < normalized.activeEndTick) return 'active'
  return 'recovery'
}

/** 对两个边界统一应用 Tick 映射，并在新时间轴上重新规范化。 */
export function mapPhaseMarkers(
  markers: PhaseMarkers | undefined,
  mapTick: (tick: number) => number,
  totalTicks: number
): PhaseMarkers | undefined {
  if (!markers) return undefined
  return normalizePhaseMarkers(
    {
      activeStartTick: mapTick(markers.activeStartTick),
      activeEndTick: mapTick(markers.activeEndTick),
    },
    totalTicks
  )
}

/**
 * 插入一段新的时间后移动后续 phase 边界。
 * 在动画末尾插入时，totalTicks 这个终点不移动，避免新追加帧自动变成 active。
 */
export function shiftPhaseMarkersAfterInsert(
  markers: PhaseMarkers | undefined,
  insertionTick: number,
  insertedDuration: number,
  oldTotalTicks: number,
  newTotalTicks: number
): PhaseMarkers | undefined {
  if (!markers) return undefined
  const delta = Math.max(0, Math.round(insertedDuration))
  if (delta === 0) return normalizePhaseMarkers(markers, newTotalTicks)

  return mapPhaseMarkers(
    markers,
    (tick) =>
      insertionTick < oldTotalTicks && tick >= insertionTick ? tick + delta : tick,
    newTotalTicks
  )
}

/**
 * 修改单帧 duration 后重新定位 phase 边界。
 * 位于该帧之后的边界随时间轴移动；落在该帧内部的边界尽量保持原位置。
 */
export function remapPhaseMarkersAfterDurationChange(
  markers: PhaseMarkers | undefined,
  frameStartTick: number,
  oldDuration: number,
  newDuration: number,
  newTotalTicks: number
): PhaseMarkers | undefined {
  if (!markers) return undefined
  const oldEndTick = frameStartTick + Math.max(0, oldDuration)
  const nextEndTick = frameStartTick + Math.max(0, newDuration)
  const delta = newDuration - oldDuration

  return mapPhaseMarkers(
    markers,
    (tick) => {
      if (tick < frameStartTick) return tick
      if (tick >= oldEndTick) return tick + delta
      return Math.min(tick, nextEndTick)
    },
    newTotalTicks
  )
}

/** 删除一个或多个 Tick 区间后重新定位 phase 边界。区间必须按起点升序排列。 */
export function remapPhaseMarkersAfterRemovals(
  markers: PhaseMarkers | undefined,
  intervals: PhaseRange[],
  newTotalTicks: number
): PhaseMarkers | undefined {
  if (!markers) return undefined
  const sorted = [...intervals]
    .filter((range) => range.endTick > range.startTick)
    .sort((a, b) => a.startTick - b.startTick)

  return mapPhaseMarkers(
    markers,
    (tick) => {
      let removedBefore = 0
      for (const range of sorted) {
        if (tick <= range.startTick) break
        if (tick >= range.endTick) {
          removedBefore += range.endTick - range.startTick
          continue
        }
        return range.startTick - removedBefore
      }
      return tick - removedBefore
    },
    newTotalTicks
  )
}
