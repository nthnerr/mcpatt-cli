# Contributing to mcpatt-cli

## Before you open a PR

Read the scope section of the README first. This project stays intentionally narrow: proxy, parse, log. If your idea doesn't fit cleanly into one of those areas, open an issue before writing code.

Things I will probably say no to without a very good reason: anything that adds a runtime dependency on a database, anything that phones home, anything that tries to be a dashboard. There's a V2 list in the original spec doc (session diffing, redaction, a live TUI) — those are fine to attempt, but they're scoped as separate, optional pieces, not bolted onto the core proxy path.

## Setup

```bash
git clone https://github.com/nthnerr/mcpatt-cli.git
cd mcpatt-cli
npm install
```

Run it straight from source, no build step:

```bash
npx tsx src/index.ts --name test -- npx @modelcontextprotocol/server-filesystem /some/path
```

## Layout

| File | Owns |
|---|---|
| `src/index.ts` | CLI flags, session lifecycle, signal handlers |
| `src/proxy.ts` | spawning the wrapped server, piping stdio both ways |
| `src/parser.ts` | JSON-RPC parsing, request/response pairing by `id` |
| `src/logger.ts` | terminal output, truncation, JSON file writes |
| `src/redactor.ts` | compile redaction regex and apply patterns to logged values |
| `src/diff.ts` | compare two session logs |
| `src/tokens.ts` | estimate token usage for a recorded session |
| `src/replay.ts` | replay a session log against a fresh server |

`proxy.ts` is the one to be careful with. Everything else assumes it's forwarding stdio correctly and unmodified; a bug there breaks the protocol silently rather than throwing.

## Testing a change

There's no test suite yet (open to a PR for that, see below). The manual loop:

```bash
npm install -g @wong2/mcp-cli @modelcontextprotocol/server-filesystem
```

`mcp-cli` can't attach to an already-running stdio process — it has to spawn the process itself. Don't run mcpatt-cli in one terminal and `mcp-cli` in another; that setup does not work. Use a config file instead:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["tsx", "src/index.ts", "--name", "filesystem", "--", "npx", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

```bash
npx @wong2/mcp-cli -c test-config.json
```

That gets you an interactive tool picker with the proxy's log running alongside it in the same terminal. Fire a few tool calls, check the JSON file got written, check it matches what you'd expect.

If your change touches the build (`package.json`'s `scripts.build` or the bundling setup), run the bundle directly before assuming it works. `tsx` and the esbuild output can differ. In this project, keep the bundle format as `cjs`, and avoid generating duplicate shebangs from both the source file and esbuild flags.

## Code style

Strict TypeScript, no loosening `tsconfig.json` to make something compile. `any` is allowed exactly at the boundary where you're parsing untyped JSON-RPC off the wire and nowhere else — if `any` is leaking past `parser.ts`, that's a bug, not a style choice.

Short variable names are fine and preferred for anything local and obvious (`i`, `e`, `el`) — this isn't a place that needs `currentIndexValue`. Comments explain *why*, not *what*; if a comment just restates the line below it, delete the comment.

## Submitting

Small, focused PRs. One change, one reason. If a PR touches `proxy.ts`, `parser.ts`, and `logger.ts` at once, it's probably actually three PRs that got stuck together — split it, even if it's more work for you, because it's a lot more work for me to review and a lot easier to silently break something that way.

Describe what you tested it against and how, in the PR description. "I added X" without "and here's how I confirmed it doesn't break Y" gets a question, not a merge.

## License

Contributions are accepted under the same MIT license as the rest of the project. By opening a PR you're agreeing to that; there's no separate CLA.
