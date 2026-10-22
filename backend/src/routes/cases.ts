import { Router } from "express";
import { assignInvestigator, listCases, transition, type CaseAction } from "../services/cases";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS: CaseAction[] = ["approve", "release", "close"];

export function casesRouter(db: Rpc): Router {
  const r = Router();

  r.get("/", async (_req, res) => {
    try {
      res.json(await listCases(db));
    } catch {
      res.status(500).json({ error: "could not list cases" });
    }
  });

  r.post("/:id/assign", async (req, res) => {
    const investigator = typeof req.body?.investigator === "string" ? req.body.investigator : "";
    if (!UUID.test(req.params.id) || !investigator || investigator.length > 256) return res.status(400).json({ error: "bad request" });
    try {
      const result = await assignInvestigator(db, req.params.id, investigator);
      if (result === null) return res.status(404).json({ error: "not found" });
      if (result === "invalid") return res.status(409).json({ error: "case is not released" });
      res.json({ status: result });
    } catch {
      res.status(500).json({ error: "could not assign investigator" });
    }
  });

  r.post("/:id/:action", async (req, res) => {
    const action = req.params.action as CaseAction;
    if (!UUID.test(req.params.id) || !ACTIONS.includes(action)) return res.status(404).json({ error: "not found" });
    try {
      const result = await transition(db, req.params.id, action);
      if (result === null) return res.status(404).json({ error: "not found" });
      if (result === "invalid") return res.status(409).json({ error: "invalid state change" });
      res.json({ status: result });
    } catch {
      res.status(500).json({ error: "could not change case" });
    }
  });

  return r;
}
