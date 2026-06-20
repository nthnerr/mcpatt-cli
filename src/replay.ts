import spawn from "cross-spawn";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { loadSessionLog } from "./session-log.js";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function replaySession(logPath: string, command: string, args: string[]): void {
  const log = loadSessionLog(logPath);
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });

  const stdin = child.stdin!;
  const stdout = child.stdout!;
  child.stderr!.on("data", (chunk) => process.stderr.write(chunk));
  child.on("error", (err) => {
    console.error(chalk.red(`Failed to start server: ${err.message}`));
    process.exit(1);
  });

  let nextId = 0;
  const pending = new Map<number, (result: unknown, error: unknown) => void>();

  function send(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (result, error) => (error ? reject(error) : resolve(result)));
      stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  function notify(method: string, params?: unknown): void {
    stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  createInterface({ input: stdout }).on("line", (line) => {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      return; // not every line a server writes is guaranteed parseable; skip rather than abort mid-replay
    }
    if (message.id === undefined) return; // a notification from the server — nothing here is waiting on it
    pending.get(message.id)?.(message.result, message.error);
    pending.delete(message.id);
  });

  async function run(): Promise<void> {
    console.log(chalk.bold(`Replaying ${log.calls.length} call(s) from ${logPath}`));
    console.log(chalk.dim("─".repeat(60)));

    // real handshake, not a shortcut — most servers reject tools/call
    // before they've seen initialize + notifications/initialized
    await send("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "mcpatt-cli-replay", version: "1.0.0" },
    });
    notify("notifications/initialized");

    let mismatches = 0;
    for (const call of log.calls) {
      const startedAt = Date.now();
      try {
        const result = await send("tools/call", { name: call.tool, arguments: call.input });
        const duration = Date.now() - startedAt;
        if (deepEqual(result, call.output)) {
          console.log(`${chalk.green("✓")} ${call.tool} — matches (${duration}ms, was ${call.duration_ms}ms)`);
        } else {
          mismatches++;
          console.log(`${chalk.red("✗")} ${call.tool} — output differs (${duration}ms, was ${call.duration_ms}ms)`);
        }
      } catch (err) {
        mismatches++;
        const message = (err as { message?: string })?.message ?? String(err);
        console.log(`${chalk.red("✗")} ${call.tool} — errored this time: ${message}`);
      }
    }

    console.log(chalk.dim("─".repeat(60)));
    console.log(
      mismatches === 0
        ? chalk.green("Every call reproduced exactly.")
        : chalk.yellow(`${mismatches} call(s) didn't match the logged run.`)
    );

    child.kill();
    process.exit(mismatches === 0 ? 0 : 1);
  }

  run().catch((err) => {
    console.error(chalk.red(`Replay failed: ${(err as Error).message}`));
    child.kill();
    process.exit(1);
  });
}