'use client'

import { useState } from 'react'
import { Keyboard, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShortcutItem {
    keys: string[]
    description: string
}

const shortcuts: ShortcutItem[] = [
    { keys: ['Ctrl', 'B'], description: '加粗' },
    { keys: ['Ctrl', 'I'], description: '斜体' },
    { keys: ['Ctrl', 'U'], description: '下划线' },
    { keys: ['Ctrl', 'E'], description: '行内代码' },
    { keys: ['Ctrl', 'Shift', 'X'], description: '删除线' },
    { keys: ['Ctrl', 'K'], description: '插入链接' },
    { keys: ['Ctrl', 'Enter'], description: '分割线' },
    { keys: ['#', 'Space'], description: '一级标题' },
    { keys: ['##', 'Space'], description: '二级标题' },
    { keys: ['###', 'Space'], description: '三级标题' },
    { keys: ['-', 'Space'], description: '无序列表' },
    { keys: ['1.', 'Space'], description: '有序列表' },
    { keys: ['>', 'Space'], description: '引用块' },
    { keys: ['```'], description: '代码块' },
    { keys: ['/', ''], description: '斜杠命令菜单' },
    { keys: ['Tab'], description: '增加缩进' },
    { keys: ['Shift', 'Tab'], description: '减少缩进' },
]

export function KeyboardShortcuts() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="border-b">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-6 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
                <Keyboard className="h-3.5 w-3.5" />
                <span>快捷键</span>
                {isOpen ? (
                    <ChevronUp className="h-3 w-3 ml-auto" />
                ) : (
                    <ChevronDown className="h-3 w-3 ml-auto" />
                )}
            </button>

            {isOpen && (
                <div className="px-6 pb-3 pt-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-1.5">
                        {shortcuts.map((shortcut, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="flex items-center gap-0.5 shrink-0">
                                    {shortcut.keys.map((key, j) => (
                                        <span key={j} className="flex items-center">
                                            {j > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
                                            <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded border border-border bg-muted font-mono text-[10px] text-muted-foreground shadow-sm">
                                                {key}
                                            </kbd>
                                        </span>
                                    ))}
                                </span>
                                <span className="text-muted-foreground truncate">{shortcut.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
