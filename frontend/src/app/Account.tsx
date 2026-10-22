import { Button } from '@/components/ui/button'
import { Link } from './Link'
import { useAuth } from './auth'
import { ROUTES } from './router'

/** Top-bar sign-in state for staff (stewards, investigators, admins). Reporters need no account. */
export function Account() {
  const { loading, session, signOut } = useAuth()
  if (loading) return null
  if (!session) {
    return (
      <Link href={ROUTES.signIn} className="text-[13px] font-medium underline underline-offset-2">
        Staff sign in
      </Link>
    )
  }
  return (
    <span className="flex items-center gap-3 text-[13px]">
      <span className="text-chrome-muted">{session.user.email}</span>
      <Button variant="ghost" size="sm" onClick={() => void signOut()}>
        Sign out
      </Button>
    </span>
  )
}
