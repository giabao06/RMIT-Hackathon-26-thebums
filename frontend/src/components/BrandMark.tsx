/** The product mark: a padlock whose body holds the two report slots, one already sealed. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="7" fill="#000054" />
      <path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="8" y="14" width="16" height="11" rx="2.5" fill="#FFFFFF" />
      <circle cx="13" cy="19.5" r="1.8" fill="#E60028" />
      <circle cx="19" cy="19.5" r="1.8" fill="#000054" />
    </svg>
  )
}
