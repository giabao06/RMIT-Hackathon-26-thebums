import express from "express";
import { rateLimit } from "express-rate-limit";
import { serviceAuth } from "./middleware/serviceAuth";
import { requireRole } from "./middleware/tideAuth";
import { casesRouter } from "./routes/cases";
import { investigatorRouter } from "./routes/investigator";
import { stewardRouter } from "./routes/steward";
import { reportsRouter, type Rpc } from "./routes/reports";

export function createApp(db: Rpc, pepper: Buffer) {
  const app = express();
  app.use(express.json({ limit: "28mb" })); // base64 of a 20 MB sealed bundle
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // In-memory only: nothing about the caller is stored or logged.
  app.use("/reports", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  app.use("/reports", reportsRouter(db, pepper));
  app.use("/cases", serviceAuth(), casesRouter(db));
  app.use("/steward", requireRole("steward"), stewardRouter(db));
  app.use("/investigator", requireRole("investigator"), investigatorRouter(db));
  return app;
}
