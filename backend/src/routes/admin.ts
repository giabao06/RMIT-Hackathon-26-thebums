import { Router } from "express";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODIES = ["union", "ngo", "oversight"];

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const int = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const email = (v: unknown) => (typeof v === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) && v.length <= 200 ? v.trim().toLowerCase() : null);

/** Resolves an email to a Supabase Auth user id (inviting them if they have no account yet). */
export interface Directory {
  userIdForEmail(email: string): Promise<string | null>;
}

// Builds the payload for a change kind from the request body; null if any field is invalid.
// Only whitelisted fields are forwarded, so nothing else can reach the database.
function payloadFor(kind: unknown, p: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const b = p ?? {};
  const fields: Record<string, unknown> | null =
    kind === "set_settings" ? { retention_months: int(b.retention_months), quorum_m: int(b.quorum_m), quorum_n: int(b.quorum_n) }
    : kind === "add_steward" ? { email: email(b.email), display_name: str(b.display_name), body: BODIES.includes(b.body as string) ? b.body : null }
    : kind === "remove_steward" || kind === "remove_investigator" ? { id: uuid(b.id) }
    : kind === "rotate_steward" ? { id: uuid(b.id), email: email(b.email), display_name: str(b.display_name) }
    : kind === "add_investigator" ? { email: email(b.email), name: str(b.name) }
    : null;
  return fields && Object.values(fields).every((v) => v !== null) ? fields : null;
}

// Mounted behind requireRole("org-admin"), so req.userId is always set. The SQL functions
// also require an active org_admins row, and none of them can read ciphertext, tokens or keys.
export function adminRouter(db: Rpc, dir: Directory): Router {
  const r = Router();

  r.get("/overview", async (req, res) => {
    const { data, error } = await db.rpc("admin_overview", { p_tide_user: req.userId });
    if (error) return res.status(500).json({ error: "could not load overview" });
    if (data === null) return res.status(403).json({ error: "forbidden" });
    res.json(data);
  });

  // 200 means accepted, not applied: the body says pending or applied, and the client re-reads /overview.
  r.post("/changes", async (req, res) => {
    const payload = payloadFor(req.body?.kind, req.body?.payload);
    if (!payload) return res.status(400).json({ error: "bad request" });
    if (typeof payload.email === "string") {
      // The email is only used to find the account; the database stores the user id, never the address.
      const userId = await dir.userIdForEmail(payload.email).catch(() => null);
      if (!userId) return res.status(400).json({ error: "no account for that email" });
      delete payload.email;
      payload.tide_user_id = userId;
    }
    const { data, error } = await db.rpc("admin_propose", { p_tide_user: req.userId, p_kind: req.body.kind, p_payload: payload });
    if (error) return res.status(500).json({ error: "could not record change" });
    if (data === null) return res.status(403).json({ error: "forbidden" });
    res.json(data);
  });

  for (const [action, fn] of [["approve", "admin_approve"], ["reject", "admin_reject"]] as const) {
    r.post(`/changes/:id/${action}`, async (req, res) => {
      if (!UUID.test(req.params.id)) return res.status(400).json({ error: "bad request" });
      const { data, error } = await db.rpc(fn, { p_tide_user: req.userId, p_change: req.params.id });
      if (error) return res.status(500).json({ error: "could not record vote" });
      if (data === null) return res.status(404).json({ error: "not found" });
      if (data === "invalid") return res.status(409).json({ error: "change is not pending" });
      res.json({ status: data });
    });
  }

  r.post("/cases/:id/assign", async (req, res) => {
    const investigator = uuid(req.body?.investigator);
    if (!UUID.test(req.params.id) || !investigator) return res.status(400).json({ error: "bad request" });
    const { data, error } = await db.rpc("admin_assign", { p_tide_user: req.userId, p_case: req.params.id, p_investigator: investigator });
    if (error) return res.status(500).json({ error: "could not assign" });
    if (data === null) return res.status(404).json({ error: "not found" });
    if (data === "invalid") return res.status(409).json({ error: "case is not released" });
    res.json({ status: data });
  });

  return r;
}
