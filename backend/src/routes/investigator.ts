import { Router } from "express";
import { b64, keyRoutes } from "./keys";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReportRow {
  id: string;
  created_at: string;
  ciphertext: string;
  contact_ciphertext: string | null;
}

// Mounted behind requireRole("investigator"), so req.userId is always set.
export function investigatorRouter(db: Rpc): Router {
  const r = Router();
  keyRoutes(r, db, "investigator");

  r.get("/cases", async (req, res) => {
    const { data, error } = await db.rpc("investigator_cases", { p_tide_user: req.userId });
    if (error) return res.status(500).json({ error: "could not list cases" });
    res.json(data);
  });

  // Ciphertext only: the investigator decrypts on their device from the stewards' shares.
  r.get("/cases/:id/reports", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "not found" });
    const { data, error } = await db.rpc("investigator_reports", { p_tide_user: req.userId, p_case: req.params.id });
    if (error) return res.status(500).json({ error: "could not load reports" });
    const rows = data as ReportRow[];
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(
      rows.map((x) => ({ id: x.id, sealedAt: x.created_at, ciphertext: b64(x.ciphertext), contact: b64(x.contact_ciphertext) })),
    );
  });

  // The stewards' re-wrapped shares: only the assigned investigator's key can unwrap them.
  r.get("/cases/:id/shares", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "not found" });
    const { data, error } = await db.rpc("investigator_shares", { p_tide_user: req.userId, p_case: req.params.id });
    if (error) return res.status(500).json({ error: "could not load shares" });
    const rows = data as { report_id: string; steward_id: string; wrapped_share: string }[];
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows.map((x) => ({ reportId: x.report_id, stewardId: x.steward_id, share: b64(x.wrapped_share) })));
  });

  return r;
}
