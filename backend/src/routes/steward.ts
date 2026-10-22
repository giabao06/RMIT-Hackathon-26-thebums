import { Router } from "express";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mounted behind requireRole("steward"), so req.tideUserId is always set.
export function stewardRouter(db: Rpc): Router {
  const r = Router();

  r.get("/cases", async (req, res) => {
    const { data, error } = await db.rpc("steward_cases", { p_tide_user: req.tideUserId });
    if (error) return res.status(500).json({ error: "could not list cases" });
    res.json(data);
  });

  r.post("/cases/:id/approve", async (req, res) => {
    const signature = typeof req.body?.signature === "string" ? req.body.signature : "";
    if (!UUID.test(req.params.id) || !signature || signature.length > 8192) return res.status(400).json({ error: "bad request" });
    const { data, error } = await db.rpc("steward_approve", {
      p_tide_user: req.tideUserId,
      p_case: req.params.id,
      p_signature: signature,
    });
    if (error) return res.status(500).json({ error: "could not record approval" });
    if (data === null) return res.status(404).json({ error: "not found" });
    if (data === "invalid") return res.status(409).json({ error: "case is not awaiting approval" });
    res.json({ status: data });
  });

  return r;
}
