import type { Rpc } from "../routes/reports";

export type CaseAction = "approve" | "release" | "close";

export interface CaseRow {
  id: string;
  status: string;
  report_count: number;
  eligible_at: string | null;
}

export async function listCases(db: Rpc): Promise<CaseRow[]> {
  const { data, error } = await db.rpc("list_cases");
  if (error) throw new Error("could not list cases");
  return data as CaseRow[];
}

/** New status, "invalid" for a wrong-state jump, or null for an unknown case. */
export async function transition(db: Rpc, id: string, action: CaseAction): Promise<string | null> {
  const { data, error } = await db.rpc("case_transition", { p_case: id, p_action: action });
  if (error) throw new Error("could not change case");
  return data as string | null;
}
