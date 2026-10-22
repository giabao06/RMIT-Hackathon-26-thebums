/**
 * The incident description is stored as a rich-text document in the ProseMirror JSON shape
 * the editor produces. The engine treats it as data: it is encrypted, decrypted and handed
 * back to a read-only editor, never inserted into the page as HTML.
 */

export interface RichNode {
  type: string
  text?: string
  content?: RichNode[]
  marks?: { type: string }[]
  attrs?: Record<string, unknown>
}

export interface RichDoc extends RichNode {
  type: 'doc'
}

export function textDoc(paragraphs: string[]): RichDoc {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
  }
}

/** All the text in a document, paragraphs separated by newlines. */
export function plainText(node: RichNode): string {
  if (node.type === 'text') return node.text ?? ''
  const parts = (node.content ?? []).map(plainText)
  const block = ['doc', 'bulletList', 'orderedList'].includes(node.type)
  return parts.join(block ? '\n' : '')
}

export function isRichDoc(value: unknown): value is RichDoc {
  return typeof value === 'object' && value !== null && (value as RichNode).type === 'doc'
}
