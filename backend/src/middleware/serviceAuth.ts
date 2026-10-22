import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { Rpc } from "../routes/reports";
import { logRefusal } from "../services/audit";

// Service-to-service gate for /cases (list, assign, close); people use Supabase Auth roles instead.
export function serviceAuth(db: Rpc, secret = process.env.SERVICE_API_KEY ?? ""): RequestHandler {
  if (secret.length < 32) throw new Error("SERVICE_API_KEY must be at least 32 characters");
  const want = Buffer.from(secret);
  return (req, res, next) => {
    const sent = req.header("x-service-key");
    const got = Buffer.from(String(sent ?? ""));
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      if (sent !== undefined) logRefusal(db, "forgery_refused");
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  };
}
