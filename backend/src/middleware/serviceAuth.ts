import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

// Interim server-side gate until TideCloak role checks (steward/investigator) replace it.
export function serviceAuth(secret = process.env.SERVICE_API_KEY ?? ""): RequestHandler {
  if (secret.length < 32) throw new Error("SERVICE_API_KEY must be at least 32 characters");
  const want = Buffer.from(secret);
  return (req, res, next) => {
    const got = Buffer.from(String(req.header("x-service-key") ?? ""));
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  };
}
