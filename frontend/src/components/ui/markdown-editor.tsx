'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'

export interface MarkdownEditorProps {
  value?: string
  onChange?: (value?: string) => void
  placeholder?: string
  height?: number
  preview?: 'live' | 'edit' | 'preview'
  hideToolbar?: boolean
  textareaId?: string
  name?: string
  className?: string
  readonly?: boolean
}

export interface MarkdownEditorRef {
  getMarkdown: () => string
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(
  ({ value = '', onChange, placeholder, height = 300, className, readonly = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const crepeRef = useRef<Crepe | null>(null)
    const onChangeRef = useRef(onChange)
    const isInternalUpdate = useRef(false)
    const isCreating = useRef(false)
    const [editorReady, setEditorReady] = useState(false)

    // Keep the onChange ref up to date
    onChangeRef.current = onChange

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        try {
          if (crepeRef.current && editorReady) {
            return crepeRef.current.getMarkdown()
          }
        } catch {
          // Editor view may not be available yet
        }
        return value || ''
      },
    }), [editorReady, value])

    // Initialize editor — only once on mount
    useEffect(() => {
      const container = containerRef.current
      if (!container || isCreating.current) return

      isCreating.current = true

      // Build config — only pass defaultValue when we have actual content.
      // Passing empty string or '\n' causes ProseMirror's
      // "Empty text nodes are not allowed" error.
      // When omitted, Crepe creates a valid empty document automatically.
      const crepeConfig: ConstructorParameters<typeof Crepe>[0] = {
        root: container,
        features: {
          [CrepeFeature.CodeMirror]: true,
          [CrepeFeature.ListItem]: true,
          [CrepeFeature.LinkTooltip]: true,
          [CrepeFeature.ImageBlock]: true,
          [CrepeFeature.BlockEdit]: true,
          [CrepeFeature.Placeholder]: true,
          [CrepeFeature.Toolbar]: true,
          [CrepeFeature.Table]: true,
          [CrepeFeature.Cursor]: true,
        },
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: placeholder || 'Start writing...',
          },
        },
      }

      // Only pass defaultValue if there's actual content
      if (value && value.trim().length > 0) {
        crepeConfig.defaultValue = value
      }

      const crepe = new Crepe(crepeConfig)

      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          isInternalUpdate.current = true
          onChangeRef.current?.(markdown)
          setTimeout(() => {
            isInternalUpdate.current = false
          }, 0)
        })
      })

      crepe.create().then(() => {
        crepeRef.current = crepe
        setEditorReady(true)
        if (readonly) {
          crepe.setReadonly(true)
        }
      }).catch((err) => {
        console.error('Milkdown Crepe initialization failed:', err)
        isCreating.current = false
      })

      return () => {
        try {
          crepe.destroy()
        } catch {
          // Ignore destroy errors during unmount
        }
        crepeRef.current = null
        isCreating.current = false
        setEditorReady(false)
      }
      // Only run on mount/unmount — value is captured via closure for initial render
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Handle readonly changes
    useEffect(() => {
      if (crepeRef.current && editorReady) {
        try {
          crepeRef.current.setReadonly(readonly)
        } catch {
          // Editor may not be fully ready
        }
      }
    }, [readonly, editorReady])

    return (
      <div className={className}>
        <div
          ref={containerRef}
          style={{ minHeight: height }}
          className="milkdown-editor-wrapper"
        />
      </div>
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'