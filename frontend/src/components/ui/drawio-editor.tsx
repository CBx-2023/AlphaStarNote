'use client'

import { useCallback, useEffect, useRef } from 'react'

export interface DrawioEditorProps {
    /** Initial XML data to load into the editor */
    initialXml?: string
    /** Called when the user saves the diagram */
    onSave?: (xml: string) => void
    /** Called when the user exits/closes the editor */
    onExit?: () => void
    /** Additional class names */
    className?: string
}

/**
 * DrawioEditor — wraps draw.io in an iframe using the embed postMessage protocol.
 *
 * Communication flow:
 * 1. iframe loads draw.io with ?embed=1&proto=json
 * 2. draw.io sends { event: 'init' }
 * 3. We send { action: 'load', xml: '...' }
 * 4. User edits, draw.io sends { event: 'save', xml: '...' } or { event: 'exit' }
 */
export function DrawioEditor({ initialXml, onSave, onExit, className }: DrawioEditorProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const xmlRef = useRef(initialXml || '')

    // Keep xmlRef in sync if initialXml changes before init
    useEffect(() => {
        xmlRef.current = initialXml || ''
    }, [initialXml])

    const handleMessage = useCallback(
        (evt: MessageEvent) => {
            // Only handle messages from our iframe
            if (iframeRef.current && evt.source !== iframeRef.current.contentWindow) {
                return
            }

            let msg: { event?: string; action?: string; xml?: string }
            try {
                msg = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data
            } catch {
                return // not a JSON message, ignore
            }

            switch (msg.event) {
                case 'init':
                    // Editor is ready — send the diagram data
                    iframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({
                            action: 'load',
                            xml: xmlRef.current || '',
                            autosave: 1,
                        }),
                        '*'
                    )
                    break

                case 'save':
                    if (msg.xml) {
                        xmlRef.current = msg.xml
                        onSave?.(msg.xml)
                    }
                    break

                case 'autosave':
                    if (msg.xml) {
                        xmlRef.current = msg.xml
                        onSave?.(msg.xml)
                    }
                    break

                case 'exit':
                    onExit?.()
                    break
            }
        },
        [onSave, onExit]
    )

    useEffect(() => {
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [handleMessage])

    // Build the iframe URL
    const drawioUrl = '/drawio/index.html?embed=1&proto=json&spin=1&noSaveBtn=0&saveAndExit=1&noExitBtn=0&dark=auto'

    return (
        <iframe
            ref={iframeRef}
            src={drawioUrl}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
            }}
            allow="clipboard-read; clipboard-write"
        />
    )
}
