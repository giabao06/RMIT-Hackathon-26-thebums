import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { cn } from 'cn'
import type { RichDoc } from '@/escrow/richDoc'
import { richExtensions } from './extensions'

export function RichEditor({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string
  value: RichDoc
  onChange: (doc: RichDoc, text: string) => void
  describedBy?: string
}) {
  const editor = useEditor({
    extensions: richExtensions,
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDoc, editor.getText()),
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'What happened',
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
        class: 'px-3.5 py-3 text-[15px] leading-relaxed',
      },
    },
  })

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      underline: editor?.isActive('underline') ?? false,
      bulletList: editor?.isActive('bulletList') ?? false,
      orderedList: editor?.isActive('orderedList') ?? false,
    }),
  })

  const tools = [
    { key: 'bold', label: 'Bold', icon: Bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: 'italic', label: 'Italic', icon: Italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: 'underline', label: 'Underline', icon: Underline, run: () => editor?.chain().focus().toggleUnderline().run() },
    { key: 'bulletList', label: 'Bulleted list', icon: List, run: () => editor?.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', label: 'Numbered list', icon: ListOrdered, run: () => editor?.chain().focus().toggleOrderedList().run() },
  ] as const

  return (
    <div className="overflow-hidden rounded-[10px] border border-input bg-white focus-within:border-ink">
      <div role="toolbar" aria-label="Formatting" className="flex gap-0.5 border-b border-rule px-1.5 py-1">
        {tools.map(({ key, label, icon: Icon, run }) => (
          <button
            key={key}
            type="button"
            onClick={run}
            aria-label={label}
            aria-pressed={active?.[key] ?? false}
            title={label}
            className={cn(
              'grid size-8 place-items-center rounded-md text-slate transition-colors hover:bg-panel hover:text-ink',
              active?.[key] && 'bg-[#e2e8f0] text-ink',
            )}
          >
            <Icon className="size-4" strokeWidth={2} aria-hidden />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="rich-text" />
    </div>
  )
}
