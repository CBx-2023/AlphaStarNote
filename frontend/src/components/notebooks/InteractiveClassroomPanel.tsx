'use client'

import { ExternalLink, RefreshCw, X } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getInteractiveClassroomCopy } from '@/lib/interactive-classroom'
import { InteractiveClassroomJobStatus } from '@/lib/types/interactive-classroom'

type InteractiveClassroomEmbedState = 'idle' | 'loading' | 'ready' | 'failed'

interface InteractiveClassroomPanelProps {
  copy: ReturnType<typeof getInteractiveClassroomCopy>
  iframeKey: number
  job: InteractiveClassroomJobStatus | null
  url: string | null
  embedState: InteractiveClassroomEmbedState
  onClose: () => void
  onIframeLoad: () => void
  onOpenInNewTab: () => void
  onReload: () => void
  onRetryEmbed: () => void
}

function getStatusBadge(
  job: InteractiveClassroomJobStatus | null,
  embedState: InteractiveClassroomEmbedState,
  copy: ReturnType<typeof getInteractiveClassroomCopy>
) {
  if (embedState === 'failed') {
    return <Badge variant="destructive">{copy.loadTimeoutTitle}</Badge>
  }

  if (embedState === 'ready') {
    return <Badge>{copy.readyLabel}</Badge>
  }

  if (embedState === 'loading' && job?.result_url) {
    return <Badge variant="secondary">{copy.loadingLabel}</Badge>
  }

  if (job?.status === 'failed' || job?.error) {
    return <Badge variant="destructive">{copy.failedLabel}</Badge>
  }

  if (job?.status) {
    return <Badge variant="secondary">{job.status}</Badge>
  }

  return null
}

export function InteractiveClassroomPanel({
  copy,
  iframeKey,
  job,
  url,
  embedState,
  onClose,
  onIframeLoad,
  onOpenInNewTab,
  onReload,
  onRetryEmbed,
}: InteractiveClassroomPanelProps) {
  const progressValue =
    typeof job?.progress === 'number'
      ? Math.max(0, Math.min(100, job.progress))
      : null

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-none border-0 border-l shadow-none">
      <CardHeader className="border-b pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              {copy.panelTitle}
              {getStatusBadge(job, embedState, copy)}
            </CardTitle>
            <CardDescription>
              {url ? copy.iframeHint : copy.panelIdleDescription}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {url && (
              <>
                <Button variant="outline" size="sm" onClick={onReload}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  {copy.reload}
                </Button>
                <Button variant="outline" size="sm" onClick={onOpenInNewTab}>
                  <ExternalLink className="mr-1 h-4 w-4" />
                  {copy.openInNewTab}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="mr-1 h-4 w-4" />
              {copy.close}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!url ? (
        <CardContent className="flex flex-1 flex-col justify-center gap-4">
          {job ? (
            <>
              <div className="space-y-2">
                <div className="text-sm font-medium">{copy.progressLabel}</div>
                <div className="text-sm text-muted-foreground">
                  {job.message || job.step || copy.progressWaiting}
                </div>
              </div>

              {progressValue !== null && (
                <div className="space-y-2">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(progressValue)}%
                  </div>
                </div>
              )}

              {(job.status === 'failed' || job.error) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {job.error || job.message || copy.failedLabel}
                </div>
              )}

              {job.status !== 'failed' && !job.error && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  <span>{copy.progressWaiting}</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              {copy.panelIdleDescription}
            </div>
          )}
        </CardContent>
      ) : embedState === 'failed' ? (
        <CardContent className="flex flex-1 items-center justify-center">
          <div className="max-w-md space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <div className="space-y-2">
              <div className="text-base font-semibold text-destructive">
                {copy.loadTimeoutTitle}
              </div>
              <div className="text-sm text-muted-foreground">
                {copy.loadTimeoutDescription}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRetryEmbed}>{copy.retryEmbed}</Button>
              <Button variant="outline" onClick={onOpenInNewTab}>
                {copy.openInNewTab}
              </Button>
            </div>
          </div>
        </CardContent>
      ) : (
        <CardContent className="relative flex-1 min-h-0 p-0">
          <iframe
            key={iframeKey}
            title={copy.panelTitle}
            src={url}
            className="h-full w-full border-0 bg-white"
            allow="autoplay; microphone; clipboard-read; clipboard-write; fullscreen"
            allowFullScreen
            onLoad={onIframeLoad}
          />

          {embedState === 'loading' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70">
              <div className="flex min-w-64 flex-col items-center gap-3 rounded-lg border bg-card px-6 py-5 shadow-sm">
                <LoadingSpinner />
                <div className="text-sm text-muted-foreground">
                  {copy.loadingLabel}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
