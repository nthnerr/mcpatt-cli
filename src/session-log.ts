import { readFileSync } from "node:fs";
import type { CallRecord } from "./parser.js";

export interface SessionLog {
  session_id: string;
  server_name: string;
  started_at: string;
  ended_at: string;
  redaction_patterns: string[];
  calls: CallRecord[];
}

export function loadSessionLog(filePath: string): SessionLog {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Can't read ${filePath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${filePath} isn't valid JSON: ${(err as Error).message}`);
  }

  const log = parsed as Partial<SessionLog>;
  // duck-typed, not schema-validated — a hand-edited log missing one
  // optional field should still be usable, not rejected outright
  if (!Array.isArray(log.calls)) {
    throw new Error(`${filePath} doesn't look like an mcpatt-cli session log (no "calls" array)`);
  }

  return {
    session_id: log.session_id ?? "unknown",
    server_name: log.server_name ?? "unknown",
    started_at: log.started_at ?? "unknown",
    ended_at: log.ended_at ?? "unknown",
    redaction_patterns: log.redaction_patterns ?? [],
    calls: log.calls,
  };
}