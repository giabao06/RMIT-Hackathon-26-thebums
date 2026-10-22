import { createHash } from "node:crypto";
import { Router } from "express";
import { SubjectError, canonicalSubject } from "../subject";
import { logRefusal } from "../services/audit";
import { blindToken } from "../token";

export interface Rpc {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32 = /^[0-9a-f]{64}$/i; // SHA-256 digest / PBKDF2 proof
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_CIPHERTEXT = 20 * 1024 * 1024;

const bytea = (buf: Buffer) => `\\x${buf.toString("hex")}`;
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function reportsRouter(db: Rpc, pepper: Buffer): Router {
  const r = Router();
  const hashProof = (proof: unknown) =>
    HEX32.test(str(proof)) ? bytea(createHash("sha256").update(Buffer.from(str(proof), "hex")).digest()) : null;

  r.post("/", async (req, res) => {
    const { org, subject, ciphertext, contact, withdrawHash, lifespanMonths } = req.body ?? {};
    const months = lifespanMonths === undefined ? null : Number(lifespanMonths);
    if (
      !UUID.test(str(org)) ||
      !HEX32.test(str(withdrawHash)) ||
      !B64.test(str(ciphertext)) ||
      (contact !== undefined && !B64.test(str(contact))) ||
      (months !== null && !Number.isInteger(months))
    ) {
      return res.status(400).json({ error: "invalid report" });
    }
    const data = Buffer.from(str(ciphertext), "base64");
    if (data.length === 0 || data.length > MAX_CIPHERTEXT) return res.status(400).json({ error: "invalid report" });

    let canonical: string;
    try {
      canonical = canonicalSubject({
        identifier: str(subject?.identifier),
        name: str(subject?.name),
        unit: str(subject?.unit),
      });
    } catch (e) {
      if (e instanceof SubjectError) return res.status(400).json({ error: e.message });
      throw e;
    }

    const { data: rows, error } = await db.rpc("submit_report", {
      p_org: org,
      p_token: bytea(blindToken(canonical, pepper)),
      p_ciphertext: bytea(data),
      p_withdraw_hash: `\\x${str(withdrawHash)}`,
      p_months: months,
      p_contact: contact === undefined ? null : bytea(Buffer.from(str(contact), "base64")),
    });
    const row = (rows as { report_id: string; expires_at: string }[] | null)?.[0];
    if (error || !row) return res.status(400).json({ error: "could not store report" });
    res.status(201).json({ reportId: row.report_id, expiresAt: row.expires_at });
  });

  // POST, not GET, so the proof never lands in a URL or an access log.
  r.post("/:id/status", async (req, res) => {
    const hash = hashProof(req.body?.proof);
    if (!UUID.test(req.params.id) || !hash) return res.status(404).json({ error: "not found" });
    const { data: status } = await db.rpc("get_report_status", { p_report: req.params.id, p_withdraw_hash: hash });
    if (!status) return res.status(404).json({ error: "not found" });
    // Past the threshold shows as eligible; the reporter learns no more than that.
    res.json({ status: status === "sealed" ? "sealed" : "eligible" });
  });

  r.delete("/:id", async (req, res) => {
    const hash = hashProof(req.body?.proof);
    if (!UUID.test(req.params.id) || !hash) return res.status(404).json({ error: "not found" });
    const { data: deleted } = await db.rpc("withdraw_report", { p_report: req.params.id, p_withdraw_hash: hash });
    if (deleted === true) return res.status(204).end();
    const { data: status } = await db.rpc("get_report_status", { p_report: req.params.id, p_withdraw_hash: hash });
    if (status === "locked") {
      // Past approval only the optional contact details can go.
      const { data: removed } = await db.rpc("withdraw_identity", { p_report: req.params.id, p_withdraw_hash: hash });
      return res.json({ removed: removed === "removed" ? "contact" : "nothing" });
    }
    logRefusal(db, "forgery_refused"); // well-formed id and proof that match no report
    res.status(404).json({ error: "not found" });
  });

  return r;
}
