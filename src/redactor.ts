export function compileRedactionPatterns(patterns: string[]): RegExp[] {
  return patterns.map((p) => {
    try {
      return new RegExp(p, "gi");
    } catch (err) {
      throw new Error(`Invalid --redact pattern "${p}": ${(err as Error).message}`);
    }
  });
}

export function redactValue(
  value: unknown,
  patterns: RegExp[]
): { value: unknown; matched: boolean } {
  let matched = false;

  function walk(v: unknown): unknown {
    if (typeof v === "string") {
      let result = v;
      for (const pattern of patterns) {
        // diff before/after instead of pattern.test() first — a shared
        // global regex's lastIndex persists across leaves and can make
        // .test() miss a match silently; .replace() always rescans clean
        const next = result.replace(pattern, "[REDACTED]");
        if (next !== result) matched = true;
        result = next;
      }
      return result;
    }
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v)) {
        out[key] = walk(val);
      }
      return out;
    }
    return v;
  }

  return { value: walk(value), matched };
}