import { InteractiveClassroomLanguage } from '@/lib/types/interactive-classroom'

export function normalizeInteractiveClassroomLanguage(
  language?: string
): InteractiveClassroomLanguage {
  return language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function getInteractiveClassroomCopy(language?: string) {
  const normalized = normalizeInteractiveClassroomLanguage(language)
  const isChinese = normalized === 'zh-CN'

  return {
    buttonLabel: isChinese ? '交互网课' : 'Interactive Classroom',
    buttonTitle: isChinese ? '生成并嵌入交互网课' : 'Generate and embed an interactive classroom',
    panelTitle: isChinese ? '交互网课' : 'Interactive Classroom',
    panelIdleDescription: isChinese
      ? '点击顶部“交互网课”生成当前笔记对应的课堂。'
      : 'Use the top toolbar button to generate a classroom from this note.',
    summaryTitle: isChinese ? '课程需求总结' : 'Classroom Requirement Summary',
    summaryDescription: isChinese
      ? '系统会先总结当前笔记，你可以在发送到交互网课前继续修改。'
      : 'The note is summarized first. You can edit it before sending it to the classroom generator.',
    summaryPlaceholder: isChinese
      ? '课堂需求总结将在这里生成。'
      : 'The classroom requirement summary will appear here.',
    cancel: isChinese ? '取消' : 'Cancel',
    generatingSummary: isChinese ? '正在生成课程需求总结…' : 'Generating classroom requirement summary...',
    submitSummary: isChinese ? '生成课堂' : 'Generate Classroom',
    preparingJob: isChinese ? '正在创建课堂任务…' : 'Creating classroom job...',
    emptyContentError: isChinese
      ? '当前笔记没有可发送的正文内容。'
      : 'This note does not have any body content to send.',
    emptySummaryError: isChinese
      ? '课堂需求总结不能为空。'
      : 'The classroom requirement summary cannot be empty.',
    loadTimeoutTitle: isChinese ? '嵌入失败' : 'Embed failed',
    loadTimeoutDescription: isChinese
      ? '课堂页面未能在限定时间内完成加载。你可以重试嵌入，或改为新标签打开。'
      : 'The classroom page did not finish loading in time. Retry the embed or open it in a new tab.',
    retryEmbed: isChinese ? '重试嵌入' : 'Retry Embed',
    reload: isChinese ? '重新加载' : 'Reload',
    openInNewTab: isChinese ? '在新标签打开' : 'Open in New Tab',
    close: isChinese ? '关闭课堂' : 'Close Classroom',
    progressLabel: isChinese ? '任务进度' : 'Job Progress',
    progressWaiting: isChinese ? '等待课堂生成结果…' : 'Waiting for classroom generation...',
    readyLabel: isChinese ? '课堂已就绪' : 'Classroom Ready',
    failedLabel: isChinese ? '生成失败' : 'Generation Failed',
    loadingLabel: isChinese ? '课堂加载中' : 'Loading Classroom',
    iframeHint: isChinese
      ? '课堂将在当前页面右侧内嵌显示。'
      : 'The generated classroom is embedded on the right side of this page.',
  }
}
