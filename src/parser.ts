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

  /**
   * Feed a single raw line of stdio traffic in. Direction tells us whether
   * this line is a request heading to the MCP server, or a response/notification
   * heading back to the AI client.
   */
  handleLine(line: string, direction: Direction): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch {
      // Malformed JSON is forwarded untouched by the proxy either way —
      // we just can't log it as a structured call. Don't crash.
      return;
    }

    if (direction === "to-server") {
      this.handleRequest(message);
    } else {
      this.handleResponse(message);
    }
  }

  private handleRequest(message: any): void {
    if (message.id === undefined || message.id === null) return; // notification
    if (message.method !== "tools/call") return; // V1 only audits tool invocations

    this.pending.set(message.id, {
      toolName: message.params?.name ?? "unknown",
      input: message.params?.arguments ?? {},
      startedAt: Date.now(),
    });
  }

  private handleResponse(message: any): void {
    if (message.id === undefined || message.id === null) return;

    const call = this.pending.get(message.id);
    if (!call) return; // response to something we weren't tracking

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