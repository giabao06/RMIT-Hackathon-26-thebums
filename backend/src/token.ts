import { createHmac } from "node:crypto";

export function loadPepper(hex = process.env.TOKEN_PEPPER ?? ""): Buffer {
  if (!/^[0-9a-f]{64,}$/i.test(hex)) throw new Error("TOKEN_PEPPER must be at least 32 bytes of hex");
  return Buffer.from(hex, "hex");
}

/** Keyed, so a leaked database cannot be tested against a staff list. Never log or return it. */
export function blindToken(canonical: string, pepper: Buffer): Buffer {
  return createHmac("sha256", pepper).update(canonical).digest();
}
