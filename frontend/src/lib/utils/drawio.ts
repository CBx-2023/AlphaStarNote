/**
 * Helper utilities for embedding/extracting draw.io XML data
 * within note markdown content using HTML comment markers.
 *
 * Format in note content:
 *   <!-- drawio:start -->
 *   <mxfile>...</mxfile>
 *   <!-- drawio:end -->
 */

const DRAWIO_START = '<!-- drawio:start -->'
const DRAWIO_END = '<!-- drawio:end -->'
const DRAWIO_REGEX = /<!-- drawio:start -->\n([\s\S]*?)\n<!-- drawio:end -->/

/**
 * Extract draw.io XML from a note's content string.
 * Returns empty string if no diagram is found.
 */
export function extractDrawioXml(content: string): string {
    const match = content.match(DRAWIO_REGEX)
    return match ? match[1].trim() : ''
}

/**
 * Embed draw.io XML into a note's content string.
 * If a diagram already exists, it is replaced; otherwise it is appended.
 */
export function embedDrawioXml(content: string, xml: string): string {
    const block = `${DRAWIO_START}\n${xml}\n${DRAWIO_END}`

    if (DRAWIO_REGEX.test(content)) {
        return content.replace(DRAWIO_REGEX, block)
    }

    // Append at the end with a blank line separator
    const trimmed = content.trimEnd()
    return trimmed ? `${trimmed}\n\n${block}` : block
}

/**
 * Remove draw.io XML block from note content.
 */
export function removeDrawioXml(content: string): string {
    return content.replace(DRAWIO_REGEX, '').trim()
}

/**
 * Check if note content has an embedded diagram.
 */
export function hasDrawioXml(content: string): boolean {
    return DRAWIO_REGEX.test(content)
}
