#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { Logger } from "./logger.js";
import { startProxy } from "./proxy.js";

const program = new Command();

program
  .name("mcpatt-cli")
  .description("Transparent audit-trail proxy for MCP servers")
  .requiredOption("--name <name>", "Human-readable label for this server")
  .option("--json-only", "Suppress terminal output, write JSON file only")
  .option("--no-file", "Suppress JSON file, terminal output only")
  .option("--truncate <n>", "Override terminal truncation character limit", "500")
  .option("--log-dir <path>", "Directory to write the JSON session log into (defaults to the current working directory)")
  .argument("<command...>", "The MCP server command to wrap, after --")
  .parse(process.argv);

const opts = program.opts();
const serverCommand = program.args;

if (serverCommand.length === 0) {
  console.error(
    "Error: no server command provided.\nUsage: mcpatt-cli --name <name> -- <command> [args...]"
  );
  process.exit(1);
}

const [command, ...args] = serverCommand;
const sessionId = String(Math.floor(Date.now() / 1000));
const logFileName = `mcpatt-${opts.name}-${sessionId}.json`;
const logFilePath = opts.file === false ? null : path.join(opts.logDir ?? ".", logFileName);

const logger = new Logger({
  serverName: opts.name,
  sessionId,
  logFilePath,
  printToTerminal: !opts.jsonOnly,
  truncateAt: parseInt(opts.truncate, 10),
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