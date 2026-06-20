export interface CallRecord {
  id: string | number;
  tool: string;
  input: unknown;
  output: unknown;
  duration_ms: number;
  timestamp: string;
  error: { code: number; message: string; data?: unknown } | null;
}

interface PendingCall {
  toolName: string;
  input: unknown;
  startedAt: number;
}

type CallRecordHandler = (record: CallRecord) => void;

export type Direction = "to-server" | "to-client";

export class JsonRpcParser {
  private pending = new Map<string | number, PendingCall>();
  private onCallRecord: CallRecordHandler;

  constructor(onCallRecord: CallRecordHandler) {
    this.onCallRecord = onCallRecord;
  }

  handleLine(line: string, direction: Direction): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch {
      // proxy still forwards the raw line either way — we just have
      // nothing structured to log it as
      return;
    }

    if (direction === "to-server") {
      this.handleRequest(message);
    } else {
      this.handleResponse(message);
    }
  }

  private handleRequest(message: any): void {
    // no id means no response is coming, so there's nothing to pair later
    if (message.id === undefined || message.id === null) return;
    // only tool calls produce side effects worth auditing — everything
    // else (resources, prompts, notifications) passes through unlogged
    if (message.method !== "tools/call") return;

    this.pending.set(message.id, {
      toolName: message.params?.name ?? "unknown",
      input: message.params?.arguments ?? {},
      startedAt: Date.now(),
    });
  }

  private handleResponse(message: any): void {
    if (message.id === undefined || message.id === null) return;

    const call = this.pending.get(message.id);
    // nothing pending under this id — ignore rather than guess at a pairing
    if (!call) return;

    this.pending.delete(message.id);

    const error = message.error
      ? { code: message.error.code, message: message.error.message, data: message.error.data }
      : null;

    this.onCallRecord({
      id: message.id,
      tool: call.toolName,
      input: call.input,
      output: error ? null : message.result,
      duration_ms: Date.now() - call.startedAt,
      timestamp: new Date().toISOString(),
      error,
    });
  }
}