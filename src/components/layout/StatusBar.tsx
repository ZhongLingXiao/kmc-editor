import { Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useEditorStore } from '../../store/editorStore'
import type { PhaseName } from '../../types/animation'
import { getPhaseRanges, phaseAtTick } from '../../utils/phases'

const PHASE_TONES: Record<PhaseName, { dot: string; chip: string }> = {
  startup: {
    dot: 'bg-teal-500',
    chip: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  active: {
    dot: 'bg-red-500',
    chip: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  },
  recovery: {
    dot: 'bg-blue-500',
    chip: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  },
}

function PhaseChip({
  phase,
  label,
  startTick,
  endTick,
  active,
}: {
  phase: PhaseName
  label: string
  startTick: number
  endTick: number
  active: boolean
}) {
  const tone = PHASE_TONES[phase]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'h-5 shrink-0 gap-1 px-1.5 text-[11px] font-normal',
            tone.chip,
            active && 'ring-1 ring-inset ring-current'
          )}
          aria-current={active ? 'step' : undefined}
        >
          <span className={cn('size-1.5 rounded-full', tone.dot)} />
          <span>{label}</span>
          <span className="font-mono">{endTick - startTick}t</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label} · {startTick}–{endTick} Tick
      </TooltipContent>
    </Tooltip>
  )
}

export default function StatusBar() {
  const { t } = useTranslation()
  const animation = useEditorStore((s) => s.animation)
  const currentFrameIndex = useEditorStore((s) => s.currentFrameIndex)
  const currentTick = useEditorStore((s) => s.currentTick)
  const selectedFrameCount = useEditorStore((s) => s.selectedFrameIndices.length)
  const selectedObjectCount = useEditorStore((s) => s.selectedIds.length)
  const timelinePxPerTick = useEditorStore((s) => s.timelinePxPerTick)
  const timelineViewportWidth = useEditorStore((s) => s.timelineViewportWidth)
  const fitTimeline = useEditorStore((s) => s.fitTimeline)

  const currentPhase = phaseAtTick(animation.phases, currentTick, animation.totalTicks)
  const phaseRanges = getPhaseRanges(animation.phases, animation.totalTicks)

  return (
    <div className="flex h-[28px] shrink-0 items-center gap-2 border-t bg-card px-2 text-xs text-muted-foreground">
      <span className="w-[96px] shrink-0 whitespace-nowrap font-mono">
        {t('status.frame', {
          cur: currentFrameIndex >= 0 ? currentFrameIndex : '-',
          total: animation.elements.length > 0 ? animation.elements.length - 1 : 0,
        })}
      </span>
      <Separator orientation="vertical" className="h-4" />
      <span className="w-[112px] shrink-0 whitespace-nowrap font-mono">
        {t('status.tick', { cur: currentTick, total: animation.totalTicks })}
      </span>
      {phaseRanges && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <div className="hidden items-center gap-1.5 md:flex">
            <PhaseChip
              phase="startup"
              label={t('timeline.startup')}
              startTick={phaseRanges.startup.startTick}
              endTick={phaseRanges.startup.endTick}
              active={currentPhase === 'startup'}
            />
            <PhaseChip
              phase="active"
              label={t('timeline.active')}
              startTick={phaseRanges.active.startTick}
              endTick={phaseRanges.active.endTick}
              active={currentPhase === 'active'}
            />
            <PhaseChip
              phase="recovery"
              label={t('timeline.recovery')}
              startTick={phaseRanges.recovery.startTick}
              endTick={phaseRanges.recovery.endTick}
              active={currentPhase === 'recovery'}
            />
          </div>
        </>
      )}
      {selectedFrameCount > 1 && (
        <span>{t('status.selectedFrames', { count: selectedFrameCount })}</span>
      )}
      {selectedObjectCount > 0 && (
        <span>{t('status.selectedObjects', { count: selectedObjectCount })}</span>
      )}

      <div className="flex-1" />

      <Separator orientation="vertical" className="h-4" />
      <span className="font-mono">
        {t('status.zoom', { value: Number(timelinePxPerTick.toFixed(2)) })}
      </span>
      <Button
        variant="ghost"
        size="xs"
        className="h-6 gap-1 px-2"
        onClick={fitTimeline}
        disabled={animation.totalTicks <= 0 || timelineViewportWidth <= 0}
      >
        <Maximize2 className="size-3" />
        {t('status.fitTimeline')}
      </Button>
    </div>
  )
}
