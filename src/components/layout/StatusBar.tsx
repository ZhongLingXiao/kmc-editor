import { Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useEditorStore } from '../../store/editorStore'
import { phaseAtTick } from '../../utils/phases'

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
  const currentPhaseLabel =
    currentPhase === 'startup'
      ? t('timeline.startup')
      : currentPhase === 'active'
      ? t('timeline.active')
      : currentPhase === 'recovery'
      ? t('timeline.recovery')
      : null

  return (
    <div className="flex h-[28px] shrink-0 items-center gap-2 border-t bg-card px-2 text-xs text-muted-foreground">
      <span className="font-mono">
        {t('status.frame', {
          cur: currentFrameIndex >= 0 ? currentFrameIndex : '-',
          total: animation.elements.length > 0 ? animation.elements.length - 1 : 0,
        })}
      </span>
      <Separator orientation="vertical" className="h-4" />
      <span className="font-mono">
        {t('status.tick', { cur: currentTick, total: animation.totalTicks })}
      </span>
      {currentPhaseLabel && (
        <Badge variant="secondary" className="h-5 font-normal">
          {currentPhaseLabel}
        </Badge>
      )}
      {selectedFrameCount > 1 && (
        <span>{t('status.selectedFrames', { count: selectedFrameCount })}</span>
      )}
      {selectedObjectCount > 0 && (
        <span>{t('status.selectedObjects', { count: selectedObjectCount })}</span>
      )}

      <div className="flex-1" />

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
