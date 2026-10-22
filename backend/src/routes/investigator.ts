import { Router } from "express";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST returns bytea as "\x<hex>".
const b64 = (hex: string | null) => (hex ? Buffer.from(hex.slice(2), "hex").toString("base64") : null);

interface ReportRow {
  id: string;
  created_at: string;
  ciphertext: string;
  contact_ciphertext: string | null;
}

// Mounted behind requireRole("investigator"), so req.tideUserId is always set.
export function investigatorRouter(db: Rpc): Router {
  const r = Router();

  r.get("/cases", async (req, res) => {
    const { data, error } = await db.rpc("investigator_cases", { p_tide_user: req.tideUserId });
    if (error) return res.status(500).json({ error: "could not list cases" });
    res.json(data);
  });

  // Ciphertext only: the investigator decrypts on their device through the Tide quorum.
  r.get("/cases/:id/reports", async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: "not found" });
    const { data, error } = await db.rpc("investigator_reports", { p_tide_user: req.tideUserId, p_case: req.params.id });
    if (error) return res.status(500).json({ error: "could not load reports" });
    const rows = data as ReportRow[];
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(
      rows.map((x) => ({ id: x.id, sealedAt: x.created_at, ciphertext: b64(x.ciphertext), contact: b64(x.contact_ciphertext) })),
    );
  });

  return r;
}
