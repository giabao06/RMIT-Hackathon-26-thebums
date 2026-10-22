import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { RequestHandler } from "express";
import { createLocalJWKSet, decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";

declare module "express-serve-static-core" {
  interface Request {
    tideUserId?: string;
  }
}

interface TideConfig {
  realm: string;
  "auth-server-url": string;
  resource: string;
  jwk: { keys: JWK[] };
}

// Lazy, so the server still starts (and /reports works) before a realm is bootstrapped.
let loaded: { config: TideConfig; jwks: ReturnType<typeof createLocalJWKSet> } | null = null;

function tide() {
  if (!loaded) {
    const path = process.env.TIDECLOAK_CONFIG;
    if (!path) throw new Error("TIDECLOAK_CONFIG is not set");
    const config = JSON.parse(readFileSync(path, "utf8")) as TideConfig;
    if (!config.jwk) throw new Error("adapter JSON has no jwk field"); // embedded keys only, never remote JWKS
    loaded = { config, jwks: createLocalJWKSet(config.jwk) };
  }
  return loaded;
}

// shortcut: per-process jti cache, so replay across several instances is not caught; share it (Redis) when scaling out.
const seen = new Map<string, number>();

function thumbprint(jwk: JWK): string {
  const canonical =
    jwk.kty === "EC"
      ? `{"crv":"${jwk.crv}","kty":"EC","x":"${jwk.x}","y":"${jwk.y}"}`
      : `{"crv":"${jwk.crv}","kty":"OKP","x":"${jwk.x}"}`;
  return createHash("sha256").update(canonical).digest("base64url");
}

/** RFC 9449 proof check: signature by the key in its own header, method, url, freshness, replay, token binding. */
async function verifyDpop(req: Parameters<RequestHandler>[0], token: string, jkt: string): Promise<void> {
  const proof = req.header("dpop");
  if (!proof) throw new Error("DPoP proof required");
  const header = decodeProtectedHeader(proof);
  if (header.typ !== "dpop+jwt" || !header.jwk || !["ES256", "EdDSA"].includes(header.alg ?? "")) throw new Error("bad proof");
  const { payload } = await jwtVerify(proof, await importJWK(header.jwk, header.alg), { algorithms: [header.alg!] });

  const proto = req.header("x-forwarded-proto") ?? req.protocol; // trust only behind a proxy you control
  const host = req.header("x-forwarded-host") ?? req.header("host");
  const ath = createHash("sha256").update(token).digest("base64url");
  const now = Math.floor(Date.now() / 1000);
  if (payload.htm !== req.method || payload.htu !== `${proto}://${host}${req.baseUrl}${req.path}`) throw new Error("proof mismatch");
  if (payload.ath !== ath || !payload.iat || Math.abs(payload.iat - now) > 120) throw new Error("proof mismatch");
  if (!payload.jti || seen.has(payload.jti)) throw new Error("proof replayed");
  if (thumbprint(header.jwk) !== jkt) throw new Error("token not bound to this key");

  seen.set(payload.jti, Date.now() + 120_000);
  for (const [id, expires] of seen) if (expires < Date.now()) seen.delete(id);
}

/** Verifies the Tide access token (and its DPoP proof) and requires the realm role. Sets req.tideUserId. */
export function requireRole(role: string): RequestHandler {
  return async (req, res, next) => {
    try {
      const [scheme, token] = (req.header("authorization") ?? "").split(" ");
      if (!/^(Bearer|DPoP)$/i.test(scheme) || !token) return res.status(401).json({ error: "unauthorized" });

      const { config, jwks } = tide();
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${config["auth-server-url"].replace(/\/+$/, "")}/realms/${config.realm}`,
        clockTolerance: 5,
      });
      if (payload.azp !== config.resource || !payload.sub) return res.status(401).json({ error: "unauthorized" });

      // Tokens are DPoP-bound by the realm; an unbound token is a downgrade attempt.
      const jkt = (payload.cnf as { jkt?: string } | undefined)?.jkt;
      if (!jkt) return res.status(401).json({ error: "unauthorized" });
      await verifyDpop(req, token, jkt);

      const roles = (payload.realm_access as { roles?: string[] } | undefined)?.roles ?? [];
      if (!roles.includes(role)) return res.status(403).json({ error: "forbidden" });

      req.tideUserId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" }); // no detail: nothing about the caller is logged
    }
  };
}
