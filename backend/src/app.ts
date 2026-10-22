import express from "express";
import { rateLimit } from "express-rate-limit";
import { reportsRouter, type Rpc } from "./routes/reports";

export function createApp(db: Rpc, pepper: Buffer) {
  const app = express();
  app.use(express.json({ limit: "28mb" })); // base64 of a 20 MB sealed bundle
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // In-memory only: nothing about the caller is stored or logged.
  app.use("/reports", rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
  app.use("/reports", reportsRouter(db, pepper));
  return app;
}
