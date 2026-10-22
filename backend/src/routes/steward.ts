import { Router } from "express";
import { b64, bytea, keyRoutes } from "./keys";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

// Mounted behind requireRole("steward"), so req.userId is always set.
export function stewardRouter(db: Rpc): Router {
  const r = Router();
  keyRoutes(r, db, "steward");

  r.get("/cases", async (req, res) => {
    const { data, error } = await db.rpc("steward_cases", { p_tide_user: req.userId });
    if (error) return res.status(500).json({ error: "could not list cases" });
    res.json(data);
  });

  // This steward's wrapped shares for the case, and the assigned investigator's public key to re-wrap to.
  r.get("/cases/:id/shares", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "not found" });
    const { data, error } = await db.rpc("steward_shares", { p_tide_user: req.userId, p_case: req.params.id });
    if (error) return res.status(500).json({ error: "could not load shares" });
    const rows = data as { report_id: string; wrapped_share: string; investigator_public_key: string; steward_id: string }[];
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json({
      stewardId: rows[0].steward_id,
      investigatorKey: b64(rows[0].investigator_public_key),
      shares: rows.map((x) => ({ report: x.report_id, share: b64(x.wrapped_share) })),
    });
  });

  // Approval IS the release of this steward's shares: they arrive re-wrapped to the investigator.
  r.post("/cases/:id/approve", async (req, res) => {
    const shares: unknown = req.body?.shares;
    const ok =
      Array.isArray(shares) && shares.length > 0 && shares.length <= 200 &&
      shares.every((x) => typeof x?.report === "string" && UUID.test(x.report) && typeof x?.share === "string" && B64.test(x.share) && x.share.length <= 1024);
    if (!UUID.test(req.params.id) || !ok) return res.status(400).json({ error: "bad request" });
    const { data, error } = await db.rpc("steward_approve", {
      p_tide_user: req.userId,
      p_case: req.params.id,
      p_shares: (shares as { report: string; share: string }[]).map((x) => ({ report: x.report, share: bytea(x.share).slice(2) })),
    });
    if (error) return res.status(500).json({ error: "could not record approval" });
    if (data === null) return res.status(404).json({ error: "not found" });
    if (data === "invalid") return res.status(409).json({ error: "case is not awaiting approval" });
    res.json({ status: data });
  });

  return r;
}
