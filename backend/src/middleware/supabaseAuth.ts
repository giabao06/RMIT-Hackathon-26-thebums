import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Rpc } from "../routes/reports";
import { logRefusal } from "../services/audit";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export type Role = "steward" | "investigator" | "org-admin";

// Lazy, so the server still starts (and /reports works) before auth is configured.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Verifies the Supabase Auth access token, then requires an active row for the role (steward,
 * investigator or org-admin). The role is never read from the token, so a forged or stale claim
 * grants nothing. Sets req.userId.
 */
export function requireRole(role: Role, db: Rpc): RequestHandler {
  return async (req, res, next) => {
    // A presented credential that fails any check is a forgery; the audit row holds no caller detail.
    const forged = () => {
      logRefusal(db, "forgery_refused");
      return res.status(401).json({ error: "unauthorized" });
    };
    try {
      const [scheme, token] = (req.header("authorization") ?? "").split(" ");
      if (!/^Bearer$/i.test(scheme) || !token) return res.status(401).json({ error: "unauthorized" });

      const url = process.env.SUPABASE_URL;
      const jwksUrl = process.env.SUPABASE_JWKS_URL;
      if (!url || !jwksUrl) throw new Error("SUPABASE_URL and SUPABASE_JWKS_URL are required");
      jwks ??= createRemoteJWKSet(new URL(jwksUrl));
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${url.replace(/\/+$/, "")}/auth/v1`,
        audience: "authenticated",
        clockTolerance: 5,
      });
      if (!payload.sub) return forged();

      const { data, error } = await db.rpc("has_role", { p_user: payload.sub, p_role: role });
      if (error) return res.status(500).json({ error: "could not check role" });
      if (data !== true) {
        logRefusal(db, "escalation_refused");
        return res.status(403).json({ error: "forbidden" });
      }

      req.userId = payload.sub;
      next();
    } catch {
      forged(); // no detail: nothing about the caller is logged
    }
  };
}
