import { AdminLive } from './AdminLive'

const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** Org admins work against the real backend; the server checks the org-admin role on every call. */
export function AdminPortal() {
  if (!API_URL) return <p role="alert" className="text-[14px] text-danger-ink">VITE_API_URL is not set, so the admin portal has no backend.</p>
  return <AdminLive apiUrl={API_URL} />
}
