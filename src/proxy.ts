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
  // cross-spawn resolves Windows .cmd/.bat shims (npx, npm, pnpm, etc.)
  // correctly and safely — plain child_process.spawn() throws ENOENT for
  // these on Windows, and the naive shell:true workaround is both
  // deprecated (DEP0190) and an argument-escaping risk.
  const child = spawn(opts.command, opts.args, { stdio: ["pipe", "pipe", "pipe"] });

  // We explicitly requested pipe/pipe/pipe above, so these streams are
  // guaranteed to exist at runtime. cross-spawn's type definitions don't
  // narrow based on the stdio option the way Node's built-in spawn
  // overloads do, hence the non-null assertions below.
  const childStdin = child.stdin!;
  const childStdout = child.stdout!;
  const childStderr = child.stderr!;

  const parser = new JsonRpcParser((record) => opts.logger.recordCall(record));

  // AI client's stdin -> MCP server's stdin (requests heading out)
  const clientToServer = createInterface({ input: process.stdin });
  clientToServer.on("line", (line) => {
    parser.handleLine(line, "to-server");
    childStdin.write(line + "\n");
  });

  // MCP server's stdout -> AI client's stdout (responses heading back)
  const serverToClient = createInterface({ input: childStdout });
  serverToClient.on("line", (line) => {
    parser.handleLine(line, "to-client");
    process.stdout.write(line + "\n");
  });

  // Server-level errors are forwarded untouched — this is not audit data,
  // it's the server's own diagnostic output.
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