import { EditorContent, useEditor } from '@tiptap/react'
import type { RichDoc } from '@/escrow/richDoc'
import { richExtensions } from './extensions'

/** Shows decrypted report text through the same schema, read-only. No HTML is ever injected. */
export function RichViewer({ doc }: { doc: RichDoc }) {
  const editor = useEditor({ extensions: richExtensions, content: doc, editable: false }, [doc])
  return <EditorContent editor={editor} className="rich-text text-[15px] leading-relaxed" />
}
