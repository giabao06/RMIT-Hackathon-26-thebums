import express from "express";
import { rateLimit } from "express-rate-limit";
import { serviceAuth } from "./middleware/serviceAuth";
import { requireRole } from "./middleware/supabaseAuth";
import { adminRouter, type Directory } from "./routes/admin";
import { auditRouter } from "./routes/audit";
import { casesRouter } from "./routes/cases";
import { investigatorRouter } from "./routes/investigator";
import { stewardKeysRouter } from "./routes/keys";
import { stewardRouter } from "./routes/steward";
import { reportsRouter, type Rpc } from "./routes/reports";

export function createApp(db: Rpc, pepper: Buffer, dir: Directory) {
  const app = express();
  app.use(express.json({ limit: "28mb" })); // base64 of a 20 MB sealed bundle
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // In-memory only: nothing about the caller is stored or logged.
  app.use("/reports", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  app.use("/reports", reportsRouter(db, pepper));
  app.use("/keys", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), stewardKeysRouter(db));
  app.use("/audit", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false }), auditRouter(db));
  app.use("/cases", serviceAuth(db), casesRouter(db));
  app.use("/admin", requireRole("org-admin", db), adminRouter(db, dir));
  app.use("/steward", requireRole("steward", db), stewardRouter(db));
  app.use("/investigator", requireRole("investigator", db), investigatorRouter(db));
  return app;
}
