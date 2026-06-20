import chalk from "chalk";
import { loadSessionLog } from "./session-log.js";

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffSessions(pathA: string, pathB: string): void {
  const a = loadSessionLog(pathA);
  const b = loadSessionLog(pathB);

  console.log(chalk.bold(`${pathA} (${a.calls.length} calls) vs ${pathB} (${b.calls.length} calls)`));
  console.log(chalk.dim("─".repeat(60)));

  // aligned by index, not by tool name — sessions are usually the same
  // script run twice, so position is a better signal than name matching,
  // which falls apart the moment a tool gets called more than once
  const maxLen = Math.max(a.calls.length, b.calls.length);
  let changedCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const callA = a.calls[i];
    const callB = b.calls[i];

    if (!callA) {
      console.log(`${chalk.green(`+ [${i}]`)} ${callB.tool} — only in B`);
      changedCount++;
      continue;
    }
    if (!callB) {
      console.log(`${chalk.red(`- [${i}]`)} ${callA.tool} — only in A`);
      changedCount++;
      continue;
    }

    const diffs: string[] = [];
    if (callA.tool !== callB.tool) diffs.push(`tool: ${callA.tool} → ${callB.tool}`);
    if (!deepEqual(callA.input, callB.input)) diffs.push("input changed");
    if (!deepEqual(callA.output, callB.output)) diffs.push("output changed");
    if (Boolean(callA.error) !== Boolean(callB.error)) {
      diffs.push(callB.error ? "started erroring" : "stopped erroring");
    }

    if (diffs.length === 0) {
      console.log(`${chalk.dim(`  [${i}]`)} ${chalk.dim(callA.tool)} — unchanged (${callA.duration_ms}ms → ${callB.duration_ms}ms)`);
    } else {
      console.log(`${chalk.yellow(`~ [${i}]`)} ${callA.tool} — ${diffs.join(", ")}`);
      changedCount++;
    }
  }

  console.log(chalk.dim("─".repeat(60)));
  console.log(
    changedCount === 0
      ? chalk.green("No behavioral differences.")
      : chalk.yellow(`${changedCount} call(s) differ.`)
  );
}