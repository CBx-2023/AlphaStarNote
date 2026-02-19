'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'
import { GripVertical, GripHorizontal, Columns2, Rows2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SplitDirection = 'horizontal' | 'vertical'

interface ResizablePanelProps {
    /** First panel content */
    first: ReactNode
    /** Second panel content */
    second: ReactNode
    /** Split direction: 'horizontal' (left-right) or 'vertical' (top-bottom) */
    direction: SplitDirection
    /** Callback to toggle direction */
    onDirectionChange?: (dir: SplitDirection) => void
    /** Initial split ratio (0-1), default 0.5 */
    defaultRatio?: number
    /** Minimum size in pixels for each panel */
    minSize?: number
    /** Additional class names */
    className?: string
}

/**
 * ResizablePanel — a two-panel layout with a draggable divider.
 * Supports horizontal (left | right) and vertical (top | bottom) split,
 * with a toggle button on the divider to switch between directions.
 */
export function ResizablePanel({
    first,
    second,
    direction,
    onDirectionChange,
    defaultRatio = 0.5,
    minSize = 150,
    className,
}: ResizablePanelProps) {
    const [ratio, setRatio] = useState(defaultRatio)
    const containerRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            isDragging.current = true

            const container = containerRef.current
            if (!container) return

            const rect = container.getBoundingClientRect()

            const onMouseMove = (moveEvt: MouseEvent) => {
                if (!isDragging.current) return

                let newRatio: number
                if (direction === 'horizontal') {
                    newRatio = (moveEvt.clientX - rect.left) / rect.width
                } else {
                    newRatio = (moveEvt.clientY - rect.top) / rect.height
                }

                // Clamp to prevent panels from becoming too small
                const totalSize = direction === 'horizontal' ? rect.width : rect.height
                const minRatio = minSize / totalSize
                const maxRatio = 1 - minRatio

                newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio))
                setRatio(newRatio)
            }

            const onMouseUp = () => {
                isDragging.current = false
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
            document.body.style.userSelect = 'none'
        },
        [direction, minSize]
    )

    const handleDoubleClick = useCallback(() => {
        setRatio(defaultRatio)
    }, [defaultRatio])

    const isHorizontal = direction === 'horizontal'

    return (
        <div
            ref={containerRef}
            className={cn(
                'flex overflow-hidden',
                isHorizontal ? 'flex-row' : 'flex-col',
                className
            )}
        >
            {/* First panel */}
            <div
                className="overflow-auto"
                style={{
                    [isHorizontal ? 'width' : 'height']: `${ratio * 100}%`,
                    flexShrink: 0,
                }}
            >
                {first}
            </div>

            {/* Divider */}
            <div
                className={cn(
                    'flex items-center justify-center bg-border hover:bg-primary/20 transition-colors shrink-0 relative group',
                    isHorizontal
                        ? 'w-2 cursor-col-resize flex-col'
                        : 'h-2 cursor-row-resize flex-row'
                )}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title="拖拽调整大小，双击重置"
            >
                {/* Grip icon */}
                {isHorizontal ? (
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                ) : (
                    <GripHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {/* Direction toggle button */}
                {onDirectionChange && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'absolute z-10 h-6 w-6 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity',
                            isHorizontal ? 'top-2' : 'left-2'
                        )}
                        onClick={(e) => {
                            e.stopPropagation()
                            onDirectionChange(isHorizontal ? 'vertical' : 'horizontal')
                        }}
                        title={isHorizontal ? '切换为上下分栏' : '切换为左右分栏'}
                    >
                        {isHorizontal ? (
                            <Rows2 className="h-3 w-3" />
                        ) : (
                            <Columns2 className="h-3 w-3" />
                        )}
                    </Button>
                )}
            </div>

            {/* Second panel */}
            <div
                className="overflow-auto"
                style={{
                    [isHorizontal ? 'width' : 'height']: `${(1 - ratio) * 100}%`,
                    flexShrink: 0,
                }}
            >
                {second}
            </div>
        </div>
    )
}
