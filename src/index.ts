#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { Logger } from "./logger.js";
import { startProxy } from "./proxy.js";
import { compileRedactionPatterns } from "./redactor.js";
import { diffSessions } from "./diff.js";
import { estimateSessionTokens } from "./tokens.js";
import { replaySession } from "./replay.js";

const program = new Command();

program
  .name("mcpatt-cli")
  .description("Transparent audit-trail proxy for MCP servers")
  .requiredOption("--name <name>", "Human-readable label for this server")
  .option("--json-only", "Suppress terminal output, write JSON file only")
  .option("--no-file", "Suppress JSON file, terminal output only")
  .option("--truncate <n>", "Override terminal truncation character limit", "500")
  .option("--log-dir <path>", "Directory to write the JSON session log into (defaults to the current working directory)")
  .option(
    "--redact <pattern>",
    "Regex pattern to redact from logged input/output (repeatable)",
    (val: string, prev: string[]) => prev.concat([val]),
    [] as string[]
  )
  // optional, not required — commander's own "missing required argument"
  // error would otherwise fire before our nicer, specific one below gets
  // a chance to
  .argument("[command...]", "The MCP server command to wrap, after --")
  .action((serverCommand: string[], opts) => {
    if (serverCommand.length === 0) {
      console.error(
        "Error: no server command provided.\nUsage: mcpatt-cli --name <name> -- <command> [args...]"
      );
      process.exit(1);
    }

    let redactPatterns: RegExp[];
    try {
      redactPatterns = compileRedactionPatterns(opts.redact ?? []);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }

    const [command, ...args] = serverCommand;
    const sessionId = String(Math.floor(Date.now() / 1000));
    const logFileName = `mcpatt-${opts.name}-${sessionId}.json`;
    // "." keeps the old cwd-relative behavior when --log-dir is omitted
    const logFilePath = opts.file === false ? null : path.join(opts.logDir ?? ".", logFileName);

    const logger = new Logger({
      serverName: opts.name,
      sessionId,
      logFilePath,
      printToTerminal: !opts.jsonOnly,
      truncateAt: parseInt(opts.truncate, 10),
      redactPatterns,
    });

    logger.sessionStart();
    const child = startProxy({ command, args, logger });

    function shutdown(): void {
      logger.sessionEnd();
      child.kill();
      process.exit(0);
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

program
  .command("diff <sessionA> <sessionB>")
  .description("Compare two session logs and show what changed between them")
  .action((sessionA: string, sessionB: string) => {
    try {
      diffSessions(sessionA, sessionB);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("tokens <sessionLog>")
  .description("Estimate token usage for a recorded session")
  .action((sessionLog: string) => {
    try {
      estimateSessionTokens(sessionLog);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("replay <sessionLog>")
  .description("Re-fire a recorded session's tool calls against a fresh server instance")
  .argument("[command...]", "The MCP server command to replay against, after --")
  .action((sessionLog: string, serverCommand: string[]) => {
    if (serverCommand.length === 0) {
      console.error(
        "Error: no server command provided.\nUsage: mcpatt-cli replay <session.json> -- <command> [args...]"
      );
      process.exit(1);
    }
    const [command, ...args] = serverCommand;
    try {
      replaySession(sessionLog, command, args);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);