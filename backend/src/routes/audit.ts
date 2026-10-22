import { Router } from "express";
import type { Rpc } from "./reports";

interface Row {
  id: number;
  case_id: string | null;
  event: string;
  created_at: string;
  prev_hash: string | null;
  hash: string;
}

// Public and unauthenticated by design: events only, never content, tokens or actors.
export function auditRouter(db: Rpc): Router {
  const r = Router();

  // shortcut: verifies the whole chain per request; cache it if the log grows past a few hundred thousand rows.
  r.get("/", async (_req, res) => {
    const [entries, broken] = await Promise.all([db.rpc("audit_entries", { p_limit: 500 }), db.rpc("audit_verify")]);
    if (entries.error || broken.error) return res.status(500).json({ error: "could not read audit log" });
    const rows = entries.data as Row[];
    res.json({
      intact: broken.data === null,
      brokenAt: broken.data,
      head: rows[0]?.hash ?? null,
      entries: rows.map((x) => ({
        seq: x.id,
        at: x.created_at,
        event: x.event,
        caseId: x.case_id,
        prevHash: x.prev_hash,
        hash: x.hash,
      })),
    });
  });

  return r;
}
