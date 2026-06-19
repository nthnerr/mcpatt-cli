# mcpatt-cli

A transparent stdio proxy for MCP servers. It sits between an MCP client and a server, forwards everything unchanged, and writes down what passed through: which tool got called, with what arguments, what came back, and how long it took.

## Why

MCP clients call tools on your behalf, sometimes dozens of times in a session, and you don't see any of it. You see the final answer. You don't see which file got read, what query hit your database, or whether a call quietly failed. If you installed a server from a GitHub gist or a Discord link, you have no idea what it's actually doing at runtime.

This doesn't fix that. It just makes it visible.

## How it works

mcpatt-cli spawns the real server as a child process and pipes stdio through itself in both directions:
```
client  <-- stdio -->  mcpatt-cli  <-- stdio -->  real server
|
+-- parses each JSON-RPC line, pairs requests
with responses by id, logs the pair
```

Neither side knows it's there. If you remove mcpatt-cli from the chain, nothing about the client or the server has to change.

## Install

As a CLI tool, wrapping any local MCP server:

```bash
npm install -g mcpatt-cli
```

Or run it without installing:

```bash
npx mcpatt-cli --name <label> -- <server-command> [server-args...]
```

As a Claude Desktop extension, wrapping the official filesystem server specifically: grab the `.mcpb` from [Releases](https://github.com/nthnerr/mcpatt-cli/releases) and install it under Settings → Extensions → Advanced settings → Extension Developer. You'll be asked to pick which directories the filesystem server can touch and where the session log should go.

The extension and the CLI are the same underlying code. The extension just hardcodes which server it wraps and adds a config UI for the two things you'd otherwise pass as flags.

## Usage

```bash
mcpatt-cli --name <label> [options] -- <command> [args...]
```

Everything after `--` is the server you're wrapping, command and arguments, untouched. mcpatt-cli's own flags go before it.

| Flag | Default | Does |
|---|---|---|
| `--name <name>` | *(required)* | Label for this server in logs and filenames |
| `--log-dir <path>` | cwd | Where the JSON log gets written |
| `--no-file` | off | Skip the JSON file, terminal only |
| `--json-only` | off | Skip terminal output, file only |
| `--truncate <n>` | 500 | Characters shown per value before truncating in the terminal |

`--no-file` and `--json-only` are mutually pointless together — if you pass both you get no output at all, which is allowed but not useful.

## Output

Terminal (stderr — see [why](#a-note-on-stderr) below):
```
◆ MCPATT-CLI session started
Server  : filesystem
Session : 1781679575
Log file: ./mcpatt-filesystem-1781679575.json
────────────────────────────────────────────────
→ [3:45:12 PM] filesystem :: list_directory
Input: {"path":"C:\Users\you\Temp"}
← [3:45:12 PM] filesystem :: list_directory (5ms)
Output: {"content":[...]} [+7632 chars truncated]
```
JSON file, rewritten after every call (not just at session end — the process doesn't always get a clean shutdown):

```json
{
  "session_id": "1781679575",
  "server_name": "filesystem",
  "started_at": "2026-06-17T16:48:01.300Z",
  "ended_at": "2026-06-17T16:48:35.094Z",
  "total_calls": 1,
  "calls": [
    {
      "id": 2,
      "tool": "list_directory",
      "input": { "path": "C:\\Users\\you\\Temp" },
      "output": { "content": [ { "type": "text", "text": "..." } ] },
      "duration_ms": 5,
      "timestamp": "2026-06-17T16:48:35.094Z",
      "error": null
    }
  ]
}
```

#### A note on stderr

All human-readable output goes to stderr, not stdout. stdout is the actual JSON-RPC channel between client and server — anything else written there corrupts the protocol stream. If you redirect mcpatt-cli's stdout, you get clean protocol traffic and nothing else. If you want the colored log, that's stderr.

## What this doesn't do

It only logs `tools/call`. Notifications, `resources/*`, `prompts/*` — all pass through the proxy fine, none of it shows up in the log. That's deliberate, not an oversight: tool calls are where the actual side effects happen, which is the thing this was built to make visible. If you need broader coverage, the parser is one file and the method check is one line — fork it.

It doesn't redact anything. Full inputs and outputs land in the JSON file as-is. Don't point this at a server handling credentials or anything else you wouldn't want sitting in plaintext on disk.

It assumes one server per process. If you're wrapping three servers, you run mcpatt-cli three times.

## Requirements

Node 18+. If you're wrapping something invoked via `npx` (the filesystem server, for instance), `npx` needs to be reachable on PATH at runtime — the bundled build doesn't vendor whatever you're wrapping.

## License

MIT. See [LICENSE](LICENSE).
