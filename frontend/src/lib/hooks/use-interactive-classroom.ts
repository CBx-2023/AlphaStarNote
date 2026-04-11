import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { interactiveClassroomApi } from '@/lib/api/interactive-classroom'
import { getInteractiveClassroomCopy, normalizeInteractiveClassroomLanguage } from '@/lib/interactive-classroom'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { InteractiveClassroomJobStatus } from '@/lib/types/interactive-classroom'
import { formatApiError } from '@/lib/utils/error-handler'
import { removeDrawioXml } from '@/lib/utils/drawio'

const DEFAULT_POLL_INTERVAL_MS = 5000
const MAX_TRANSIENT_POLL_ERRORS = 3
const EMBED_TIMEOUT_MS = 15000

type InteractiveClassroomEmbedState = 'idle' | 'loading' | 'ready' | 'failed'

interface UseInteractiveClassroomOptions {
  title: string
  content: string
}

export function useInteractiveClassroom({
  title,
  content,
}: UseInteractiveClassroomOptions) {
  const { language } = useTranslation()
  const { toast } = useToast()
  const normalizedLanguage = normalizeInteractiveClassroomLanguage(language)
  const copy = useMemo(
    () => getInteractiveClassroomCopy(language),
    [language]
  )

  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [cleanedContent, setCleanedContent] = useState('')
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isCreatingJob, setIsCreatingJob] = useState(false)
  const [interactiveClassroomJob, setInteractiveClassroomJob] =
    useState<InteractiveClassroomJobStatus | null>(null)
  const [interactiveClassroomUrl, setInteractiveClassroomUrl] = useState<string | null>(null)
  const [interactiveClassroomEmbedState, setInteractiveClassroomEmbedState] =
    useState<InteractiveClassroomEmbedState>('idle')
  const [iframeKey, setIframeKey] = useState(0)

  const pollTokenRef = useRef(0)
  const transientPollErrorCountRef = useRef(0)
  const embedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const classroomUrlRef = useRef<string | null>(null)

  const hasSendableContent = useMemo(
    () => removeDrawioXml(content).trim().length > 0,
    [content]
  )

  const hasSession = Boolean(interactiveClassroomJob || interactiveClassroomUrl)

  const clearEmbedTimeout = useCallback(() => {
    if (embedTimeoutRef.current) {
      clearTimeout(embedTimeoutRef.current)
      embedTimeoutRef.current = null
    }
  }, [])

  const armEmbedTimeout = useCallback(() => {
    clearEmbedTimeout()
    embedTimeoutRef.current = setTimeout(() => {
      setInteractiveClassroomEmbedState((currentState) =>
        currentState === 'ready' ? currentState : 'failed'
      )
    }, EMBED_TIMEOUT_MS)
  }, [clearEmbedTimeout])

  const cancelPolling = useCallback(() => {
    pollTokenRef.current += 1
    transientPollErrorCountRef.current = 0
  }, [])

  const beginEmbed = useCallback(
    (url: string) => {
      classroomUrlRef.current = url
      setInteractiveClassroomUrl(url)
      setIframeKey((currentKey) => currentKey + 1)
      setInteractiveClassroomEmbedState('loading')
      armEmbedTimeout()
    },
    [armEmbedTimeout]
  )

  const reportError = useCallback(
    (message: string) => {
      toast({
        title: copy.failedLabel,
        description: message,
        variant: 'destructive',
      })
    },
    [copy.failedLabel, toast]
  )

  const pollJobStatus = useCallback(
    async (jobId: string, token: number) => {
      while (pollTokenRef.current === token) {
        let nextPollDelayMs = DEFAULT_POLL_INTERVAL_MS

        try {
          const nextStatus = await interactiveClassroomApi.getJobStatus(jobId)
          if (pollTokenRef.current !== token) {
            return
          }

          transientPollErrorCountRef.current = 0
          setInteractiveClassroomJob(nextStatus)

          if (
            nextStatus.result_url &&
            nextStatus.result_url !== classroomUrlRef.current
          ) {
            beginEmbed(nextStatus.result_url)
          }

          if (nextStatus.done) {
            return
          }

          if (
            typeof nextStatus.poll_interval_ms === 'number' &&
            nextStatus.poll_interval_ms > 0
          ) {
            nextPollDelayMs = nextStatus.poll_interval_ms
          }
        } catch (error) {
          if (pollTokenRef.current !== token) {
            return
          }

          const message = formatApiError(error)

          transientPollErrorCountRef.current += 1
          if (transientPollErrorCountRef.current >= MAX_TRANSIENT_POLL_ERRORS) {
            setInteractiveClassroomJob((currentStatus) =>
              currentStatus
                ? {
                    ...currentStatus,
                    status: 'failed',
                    message,
                    error: message,
                    done: true,
                  }
                : {
                    job_id: jobId,
                    status: 'failed',
                    message,
                    error: message,
                    done: true,
                  }
            )
            reportError(message)
            return
          }

          nextPollDelayMs =
            DEFAULT_POLL_INTERVAL_MS * transientPollErrorCountRef.current
        }

        await new Promise((resolve) => setTimeout(resolve, nextPollDelayMs))
      }
    },
    [beginEmbed, reportError]
  )

  const startSummaryGeneration = useCallback(async () => {
    const localCleanedContent = removeDrawioXml(content).trim()
    if (!localCleanedContent) {
      reportError(copy.emptyContentError)
      return false
    }

    setIsSummaryDialogOpen(true)
    setIsGeneratingSummary(true)
    setSummaryDraft('')
    setCleanedContent(localCleanedContent)

    try {
      const response = await interactiveClassroomApi.generateSummary({
        title: title.trim() || undefined,
        content,
        language: normalizedLanguage,
      })
      setSummaryDraft(response.summary)
      setCleanedContent(response.cleaned_content)
      return true
    } catch (error) {
      setIsSummaryDialogOpen(false)
      reportError(formatApiError(error))
      return false
    } finally {
      setIsGeneratingSummary(false)
    }
  }, [
    content,
    copy.emptyContentError,
    normalizedLanguage,
    reportError,
    title,
  ])

  const submitSummary = useCallback(async () => {
    const trimmedSummary = summaryDraft.trim()
    if (!trimmedSummary) {
      reportError(copy.emptySummaryError)
      return false
    }

    if (!cleanedContent.trim()) {
      reportError(copy.emptyContentError)
      return false
    }

    cancelPolling()
    clearEmbedTimeout()
    setIsCreatingJob(true)

    try {
      const createdJob = await interactiveClassroomApi.createJob({
        summary: trimmedSummary,
        original_content: cleanedContent,
        language: normalizedLanguage,
      })

      classroomUrlRef.current = null
      setInteractiveClassroomUrl(null)
      setInteractiveClassroomEmbedState('idle')
      setInteractiveClassroomJob(createdJob)
      setIsSummaryDialogOpen(false)

      if (createdJob.result_url) {
        beginEmbed(createdJob.result_url)
      }

      if (!createdJob.done) {
        const token = pollTokenRef.current + 1
        pollTokenRef.current = token
        void pollJobStatus(createdJob.job_id, token)
      }

      return true
    } catch (error) {
      reportError(formatApiError(error))
      return false
    } finally {
      setIsCreatingJob(false)
    }
  }, [
    beginEmbed,
    cancelPolling,
    cleanedContent,
    clearEmbedTimeout,
    copy.emptyContentError,
    copy.emptySummaryError,
    normalizedLanguage,
    pollJobStatus,
    reportError,
    summaryDraft,
  ])

  const markEmbedLoaded = useCallback(() => {
    clearEmbedTimeout()
    setInteractiveClassroomEmbedState('ready')
  }, [clearEmbedTimeout])

  const retryEmbed = useCallback(() => {
    if (!classroomUrlRef.current) {
      return
    }

    setIframeKey((currentKey) => currentKey + 1)
    setInteractiveClassroomEmbedState('loading')
    armEmbedTimeout()
  }, [armEmbedTimeout])

  const openInNewTab = useCallback(() => {
    if (!classroomUrlRef.current || typeof window === 'undefined') {
      return
    }

    window.open(classroomUrlRef.current, '_blank', 'noopener,noreferrer')
  }, [])

  useEffect(() => {
    classroomUrlRef.current = interactiveClassroomUrl
  }, [interactiveClassroomUrl])

  useEffect(() => {
    return () => {
      cancelPolling()
      clearEmbedTimeout()
    }
  }, [cancelPolling, clearEmbedTimeout])

  return {
    copy,
    hasSendableContent,
    hasSession,
    iframeKey,
    isCreatingJob,
    isGeneratingSummary,
    isSummaryDialogOpen,
    interactiveClassroomEmbedState,
    interactiveClassroomJob,
    interactiveClassroomUrl,
    openInNewTab,
    retryEmbed,
    setIsSummaryDialogOpen,
    setSummaryDraft,
    startSummaryGeneration,
    submitSummary,
    summaryDraft,
    markEmbedLoaded,
  }
}
