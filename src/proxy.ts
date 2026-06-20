import spawn from "cross-spawn";
import type { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import chalk from "chalk";
import { JsonRpcParser } from "./parser.js";
import { Logger } from "./logger.js";

export interface ProxyOptions {
  command: string;
  args: string[];
  logger: Logger;
}

export function startProxy(opts: ProxyOptions): ChildProcess {
  // cross-spawn, not child_process.spawn — plain spawn() throws ENOENT
  // on Windows for .cmd shims like npx, and shell:true is both deprecated
  // and an argument-escaping risk
  const child = spawn(opts.command, opts.args, { stdio: ["pipe", "pipe", "pipe"] });

  // guaranteed non-null at runtime (pipe/pipe/pipe was requested above) —
  // cross-spawn's types just don't narrow on stdio the way node's do
  const childStdin = child.stdin!;
  const childStdout = child.stdout!;
  const childStderr = child.stderr!;

  const parser = new JsonRpcParser((record) => opts.logger.recordCall(record));

  const clientToServer = createInterface({ input: process.stdin });
  clientToServer.on("line", (line) => {
    parser.handleLine(line, "to-server");
    childStdin.write(line + "\n");
  });

  const serverToClient = createInterface({ input: childStdout });
  serverToClient.on("line", (line) => {
    parser.handleLine(line, "to-client");
    process.stdout.write(line + "\n");
  });

  // not audit data — the server's own diagnostics, forwarded as-is
  childStderr.on("data", (chunk) => process.stderr.write(chunk));

  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      opts.logger.logCrash(code, signal);
    }
    opts.logger.flush();
    process.exit(code ?? 1);
  });

  child.on("error", (err) => {
    console.error(chalk.red(`Failed to start MCP server: ${err.message}`));
    opts.logger.flush();
    process.exit(1);
  });

  return child;
}