import chalk from "chalk";
import { writeFileSync } from "node:fs";
import type { CallRecord } from "./parser.js";

export interface LoggerOptions {
  serverName: string;
  sessionId: string;
  logFilePath: string | null; // null when --no-file is passed
  printToTerminal: boolean; // false when --json-only is passed
  truncateAt: number;
}

export class Logger {
  private opts: LoggerOptions;
  private calls: CallRecord[] = [];
  private startedAt = new Date().toISOString();

  constructor(opts: LoggerOptions) {
    this.opts = opts;
  }

  sessionStart(): void {
    if (!this.opts.printToTerminal) return;
    // All human-readable output goes to stderr, never stdout — stdout is
    // reserved exclusively for forwarded JSON-RPC traffic between the AI
    // client and the wrapped MCP server. Mixing the two would corrupt the
    // protocol stream.
    console.error(chalk.bold.cyan("◆ MCPATT-CLI session started"));
    console.error(`  ${chalk.dim("Server")}  : ${this.opts.serverName}`);
    console.error(`  ${chalk.dim("Session")} : ${this.opts.sessionId}`);
    if (this.opts.logFilePath) {
      console.error(`  ${chalk.dim("Log file")}: ${this.opts.logFilePath}`);
    }
    console.error(chalk.dim("─".repeat(48)));
  }

  recordCall(record: CallRecord): void {
    this.calls.push(record);
    if (this.opts.printToTerminal) this.printCall(record);
  }

  private printCall(record: CallRecord): void {
    const time = new Date(record.timestamp).toLocaleTimeString();
    const label = `${chalk.yellow(this.opts.serverName)} :: ${chalk.bold(record.tool)}`;

    console.error(`${chalk.green("→")} [${time}] ${label}`);
    console.error(`  ${chalk.dim("Input:")} ${this.formatValue(record.input)}`);

    if (record.error) {
      console.error(`${chalk.red("←")} [${time}] ${label} ${chalk.red(`(${record.duration_ms}ms)`)}`);
      console.error(`  ${chalk.red("Error:")} ${record.error.message}`);
    } else {
      console.error(`${chalk.green("←")} [${time}] ${label} ${chalk.dim(`(${record.duration_ms}ms)`)}`);
      console.error(`  ${chalk.dim("Output:")} ${this.formatValue(record.output)}`);
    }
  }

  private formatValue(value: unknown): string {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    if (str.length <= this.opts.truncateAt) return str;
    const truncated = str.slice(0, this.opts.truncateAt);
    const remaining = str.length - this.opts.truncateAt;
    return `${truncated}... ${chalk.dim(`[+${remaining} chars truncated]`)}`;
  }

  sessionEnd(): void {
    const endedAt = new Date().toISOString();

    if (this.opts.printToTerminal) {
      const seconds = Math.round((Date.parse(endedAt) - Date.parse(this.startedAt)) / 1000);
      console.error(chalk.dim("─".repeat(48)));
      console.error(chalk.bold.cyan("◆ MCPATT-CLI session ended"));
      console.error(`  ${chalk.dim("Total calls")} : ${this.calls.length}`);
      console.error(`  ${chalk.dim("Duration")}    : ${this.formatDuration(seconds)}`);
      if (this.opts.logFilePath) {
        console.error(`  ${chalk.dim("Log written")} : ${this.opts.logFilePath}`);
      }
    }

    this.flush(endedAt);
  }

  logCrash(exitCode: number | null, signal: string | null): void {
    if (!this.opts.printToTerminal) return;
    console.error(chalk.red.bold("◆ MCP server exited unexpectedly"));
    console.error(`  ${chalk.dim("Exit code")} : ${exitCode ?? "null"}`);
    console.error(`  ${chalk.dim("Signal")}    : ${signal ?? "none"}`);
  }

  flush(endedAt?: string): void {
    if (!this.opts.logFilePath) return;

    const payload = {
      session_id: this.opts.sessionId,
      server_name: this.opts.serverName,
      started_at: this.startedAt,
      ended_at: endedAt ?? new Date().toISOString(),
      total_calls: this.calls.length,
      calls: this.calls,
    };

    try {
      writeFileSync(this.opts.logFilePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
      console.error(chalk.red(`Failed to write log file: ${(err as Error).message}`));
    }
  }

  private formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  }
}