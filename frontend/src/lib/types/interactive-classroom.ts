export type InteractiveClassroomLanguage = 'zh-CN' | 'en-US'

export interface InteractiveClassroomSummaryRequest {
  title?: string
  content: string
  language: InteractiveClassroomLanguage
}

export interface InteractiveClassroomSummaryResponse {
  summary: string
  cleaned_content: string
  language: InteractiveClassroomLanguage
}

export interface InteractiveClassroomJobCreateRequest {
  summary: string
  original_content: string
  language: InteractiveClassroomLanguage
}

export interface InteractiveClassroomJobStatus {
  job_id: string
  status: string
  step?: string | null
  message?: string | null
  progress?: number | null
  poll_interval_ms?: number | null
  done: boolean
  result_url?: string | null
  error?: string | null
}
