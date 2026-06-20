import chalk from "chalk";
import { loadSessionLog } from "./session-log.js";

// ~4 chars/token is a crude approximation, not a real tokenizer — chosen
// specifically to avoid pulling in a tokenizer dependency for what's
// explicitly an estimate. good enough to flag an expensive call; not
// good enough to bill against
function estimateTokens(value: unknown): number {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(str.length / 4);
}

export function estimateSessionTokens(filePath: string): void {
  const log = loadSessionLog(filePath);

  console.log(chalk.bold(`${filePath} — ${log.calls.length} calls`));
  console.log(chalk.dim("─".repeat(60)));

  let total = 0;
  for (const call of log.calls) {
    const inputTokens = estimateTokens(call.input);
    const outputTokens = estimateTokens(call.output);
    const callTotal = inputTokens + outputTokens;
    total += callTotal;
    console.log(
      `${chalk.yellow(call.tool.padEnd(24))} in:${String(inputTokens).padStart(6)}  out:${String(outputTokens).padStart(6)}  total:${String(callTotal).padStart(6)}`
    );
  }

  console.log(chalk.dim("─".repeat(60)));
  console.log(chalk.bold(`Estimated total: ~${total} tokens`));
}