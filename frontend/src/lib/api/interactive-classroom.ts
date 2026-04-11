import apiClient from './client'
import {
  InteractiveClassroomJobCreateRequest,
  InteractiveClassroomJobStatus,
  InteractiveClassroomSummaryRequest,
  InteractiveClassroomSummaryResponse,
} from '@/lib/types/interactive-classroom'

export const interactiveClassroomApi = {
  generateSummary: async (data: InteractiveClassroomSummaryRequest) => {
    const response = await apiClient.post<InteractiveClassroomSummaryResponse>(
      '/interactive-classroom/summary',
      data
    )
    return response.data
  },

  createJob: async (data: InteractiveClassroomJobCreateRequest) => {
    const response = await apiClient.post<InteractiveClassroomJobStatus>(
      '/interactive-classroom/jobs',
      data
    )
    return response.data
  },

  getJobStatus: async (jobId: string) => {
    const response = await apiClient.get<InteractiveClassroomJobStatus>(
      `/interactive-classroom/jobs/${jobId}`
    )
    return response.data
  },
}
