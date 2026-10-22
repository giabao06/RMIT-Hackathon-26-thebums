import StarterKit from '@tiptap/starter-kit'

/**
 * One schema for writing and for reading. Links, code and headings are off: a report needs
 * emphasis and lists, and a smaller schema is a smaller surface when decrypted content is shown.
 */
export const richExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    strike: false,
  }),
]
