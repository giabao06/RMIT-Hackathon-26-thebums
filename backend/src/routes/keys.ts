import { Router } from "express";
import type { Rpc } from "./reports";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

// PostgREST returns bytea as "\x<hex>".
export const b64 = (hex: string | null) => (hex ? Buffer.from(hex.slice(2), "hex").toString("base64") : null);
export const bytea = (b64Text: string) => `\\x${Buffer.from(b64Text, "base64").toString("hex")}`;

/** Public: the stewards' public keys and the threshold a reporter needs to seal. Public keys are not secret. */
export function stewardKeysRouter(db: Rpc): Router {
  const r = Router();
  r.get("/stewards", async (req, res) => {
    const org = String(req.query.org ?? "");
    if (!UUID.test(org)) return res.status(400).json({ error: "bad request" });
    const { data, error } = await db.rpc("steward_keys", { p_org: org });
    const rows = data as { id: string; public_key: string; quorum_m: number }[] | null;
    if (error || !rows?.length) return res.status(404).json({ error: "stewards are not set up" });
    res.json({ threshold: rows[0].quorum_m, stewards: rows.map((x) => ({ id: x.id, publicKey: b64(x.public_key) })) });
  });
  return r;
}

/** Adds GET/PUT /key to a role router: the caller's public key and passphrase-wrapped private-key backup. */
export function keyRoutes(r: Router, db: Rpc, role: "steward" | "investigator"): void {
  r.get("/key", async (req, res) => {
    const { data, error } = await db.rpc("my_key", { p_user: req.userId, p_role: role });
    if (error) return res.status(500).json({ error: "could not load key" });
    const row = (data as { public_key: string | null; key_backup: string | null }[])[0];
    res.json({ publicKey: b64(row?.public_key ?? null), backup: b64(row?.key_backup ?? null) });
  });

  r.put("/key", async (req, res) => {
    const { publicKey, backup } = req.body ?? {};
    if (typeof publicKey !== "string" || typeof backup !== "string" || !B64.test(publicKey) || !B64.test(backup) || publicKey.length > 200 || backup.length > 8192) {
      return res.status(400).json({ error: "bad request" });
    }
    const { data, error } = await db.rpc("enrol_key", { p_user: req.userId, p_role: role, p_public: bytea(publicKey), p_backup: bytea(backup) });
    if (error || data !== true) return res.status(500).json({ error: "could not save key" });
    res.status(204).end();
  });
}
