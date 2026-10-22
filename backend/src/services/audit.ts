import type { Rpc } from "../routes/reports";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

// shortcut: per-process cap, so several instances allow more; move it into the database when scaling out.
let stamps: number[] = [];

/** Records a refused attempt. Fire and forget: logging must never break or slow the request. */
export function logRefusal(db: Rpc, event: "forgery_refused" | "escalation_refused"): void {
  const now = Date.now();
  stamps = stamps.filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) return; // junk traffic must not flood the public log
  stamps.push(now);
  void db.rpc("log_refusal", { p_event: event }).then(undefined, () => {});
}
